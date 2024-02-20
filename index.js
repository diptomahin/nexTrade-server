const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const {
  MongoClient,
  ServerApiVersion,
  ObjectId,
} = require('mongodb');
const app = express();
require("dotenv").config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;


// firebase admin
const serviceAccount = require('./firebase-admin-sdk.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'nextrade-f82fb.firebaseapp.com' // Update with your Firebase project URL
});

//middleware
app.use(cors());
app.use(express.json());
// app.use(bodyParser.json());




// const uri = `mongodb+srv://NexTrade:pDR8dZkQhk65einI@nextradecluster.nvmjgdy.mongodb.net/?retryWrites=true&w=majority`;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@nextradecluster.nvmjgdy.mongodb.net/?retryWrites=true&w=majority`;



const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});




async function run() {
  try {

    const nexTrade = client.db('nexTrade');

    // mongodb collections
    const usersCollection = nexTrade.collection('all-users');
    const watchListCollection = nexTrade.collection('watchlist');
    const purchasedCollection = nexTrade.collection('purchasedAssets');
    const spotTradingCollection = nexTrade.collection('spotTrading');
    const allCoinCollection = nexTrade.collection('allCoins');
    const depositWithdrawCollection = nexTrade.collection('depositWithdraw');
    const invoicesCollection = nexTrade.collection('invoices');
    const articleCollection = nexTrade.collection('articles');
    const notificationsCollection = nexTrade.collection('notifications');


    // stripe //

    // checkout api
    app.post('/v1/api/checkout-session', async (req, res) => {
      try {
        const {
          email,
          sessionId
        } = req.body;

        // Validate request body
        if (!email || typeof email !== 'string' || !sessionId || typeof sessionId !== 'string') {
          return res.status(400).send({
            error: 'Invalid request body. Both email and sessionId are required and must be strings.'
          });
        }

        // Retrieve session information
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        // Check if session is valid
        if (!session || !session.id) {
          return res.status(400).send({
            error: 'Invalid session ID. Session not found.'
          });
        }

        // Retrieve invoice information
        const invoice = await stripe.invoices.retrieve(session.invoice, {
          expand: ['payment_intent'],
        });

        // Retrieve customer information
        const customer = await stripe.customers.retrieve(session.customer);

        // Retrieve subscription information
        const subscription = await stripe.subscriptions.retrieve(session.subscription);

        // Retrieve product details
        const product = await stripe.products.retrieve(subscription.plan.product);

        const query = {
          email
        };

        // Insert invoice data
        const invoiceData = {
          email,
          session,
          invoice,
          customer,
          subscription,
          product
        };
        const invoiceResult = await invoicesCollection.insertOne(invoiceData);

        // Check if invoice data was inserted successfully
        if (!invoiceResult.insertedId) {
          return res.status(500).send({
            error: 'Failed to insert invoice data.'
          });
        }

        // Update user status
        const userUpdateData = {
          $set: {
            status: product.name
          }
        };
        const userResult = await usersCollection.updateOne(query, userUpdateData);

        res.send({
          product,
          success: true,
        });
      } catch (error) {
        res.status(500).send({
          error: 'An unexpected error occurred while processing the checkout session.'
        });
      }
    });


    // secret api
    app.post('/create-payment-intent', async (req, res) => {
      try {
        const {
          price
        } = req.body;

        if (price === 0) {

        }
        const amount = price ? parseInt(price * 100) : 50;

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card'],
        });

        res.send({
          clientSecret: paymentIntent.client_secret
        });
      } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).send({
          error: "Error creating payment intent."
        });
      }
    });


    // user related api starts form here

    // post a user in usersCollection
    app.post('/v1/api/all-users', async (req, res) => {
      const userInfo = req.body;
      const existingUser = await usersCollection.findOne({
        email: userInfo.email
      })
      if (existingUser) {
        return res.send({
          message: 'user already exists',
          insertedId: null
        })
      }
      const result = await usersCollection.insertOne(userInfo);
      res.send(result)
    })

    // get all user
    app.get('/v1/api/all-users', async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })


    // put method
    app.put('/v1/api/update-user/:email', async (req, res) => {

      const email = req.params.email;
      console.log(email);
      const userDetails = req.body;
      const query = {
        email: email
      }

      const updateUserDetails = {
        $set: {
          name: userDetails.name,
          username: userDetails.username,
          phone: userDetails.phone,
          address: userDetails.address,
          currency: userDetails.currency,
          photo: userDetails.photo,
          lastUpdate: userDetails.lastUpdate
        }
      }

      const result = await usersCollection.updateOne(query, updateUserDetails)
      res.send(result)

    })

    // promote or demote user
    app.patch('/v1/api/all-users/:email/:role', async (req, res) => {
      const userEmail = req.params.email;
      const userRole = req.params.role
      const filter = {
        email: userEmail
      };
      const updatedDoc = {
        $set: {
          role: userRole
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })

    // delete user from firebase
    app.post('/v1/api/deleteUserFromFirebase/:userID', async (req, res) => {
      const uid = req.params.userID;
      try {
        await admin.auth().deleteUser(uid);
        res.send({
          success: true,
          message: `User ${uid} successfully deleted.`
        });
      } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
          success: false,
          message: 'Error deleting user.'
        });
      }
    });

    // delete user account
    app.delete('/v1/api/all-users/:userId', async (req, res) => {
      const userId = req.params.userId;
      console.log(userId)
      const query = {
        _id: new ObjectId(userId)
      };
      const result = await usersCollection.deleteOne(query)
      res.send(result);
    })


    // get individual users info
    app.get('/v1/api/all-users/:email', async (req, res) => {
      const userEmail = req.params.email;
      const query = {
        email: userEmail
      }
      const result = await usersCollection.find(query).sort({
        _id: -1
      }).toArray(); // get user in lifo methods
      res.send(result)
    })

    // get individual users info
    app.get('/v1/api/user/:email', async (req, res) => {
      const userEmail = req.params.email;
      const query = {
        email: userEmail
      }
      const result = await usersCollection.findOne(query)
      res.send(result)
    })



    /// ======> Md. Nuruzzaman <====== ///

    // get all deposit and withdraw data
    app.get('/v1/api/deposit-withdraw/:email', async (req, res) => {
      const userEmail = req.params.email;
      const query = {
        email: userEmail
      }

      const result = await depositWithdrawCollection.find(query).toArray()
      res.send(result)

    })

    // get specific searched deposit and withdraw data
    app.get('/v1/api/deposit-withdraw/specific/:email', async (req, res) => {
      const email = req.params.email;
      const filter = req.query;

      const query = {
        email: email
      };

      if (filter.search && filter.search !== '') {
        if (!isNaN(filter.search)) {
          // If search parameter is a number
          const searchValue = parseFloat(filter.search);
          query.$or = [{
            email: email,
            amount: searchValue
          }, {
            email: email,
            'date.day': searchValue
          }, {
            email: email,
            'date.month': searchValue
          }, {
            email: email,
            'date.year': searchValue
          }];
        } else {
          // If search parameter is not a number, treat it as a string
          const searchRegex = {
            $regex: filter.search,
            $options: 'i',
          };

          query.$or = [{
            email: email,
            currency: searchRegex
          }, {
            email: email,
            action: searchRegex
          }];
        }
      }

      const result = await depositWithdrawCollection.find(query).toArray();
      res.send(result);
    });


    // post deposit data
    app.post('/v1/api/deposit/:email', async (req, res) => {
      try {
        const userEmail = req.params.email;
        const depositData = req.body;
        const query = {
          email: userEmail
        };
        const userData = await usersCollection.findOne(query);

        if (!userData) {
          // If user data is not found, return an error response
          return res.status(404).json({
            error: "User not found"
          });
        }

        const depositInfo = {
          $set: {
            balance: parseFloat(userData.balance) + parseFloat(depositData.amount)
          },
        };
        const balanceResult = await usersCollection.updateOne(query, depositInfo);

        if (balanceResult.modifiedCount > 0) {
          const result = await depositWithdrawCollection.insertOne(depositData);
          return res.send(result);
        } else {
          // If balance is not updated, return an error response
          return res.status(500).json({
            error: "Failed to update balance"
          });
        }
      } catch (error) {
        // If an unexpected error occurs, return a general error response
        console.error("Error:", error);
        return res.status(500).json({
          error: "Internal server error"
        });
      }
    });


    //  post withdraw data
    app.post('/v1/api/withdraw/:email', async (req, res) => {
      try {
        const userEmail = req.params.email;
        const withdrawData = req.body;
        const query = {
          email: userEmail
        };
        const userData = await usersCollection.findOne(query);

        if (!userData) {
          // If user data is not found, return an error response
          return res.status(404).json({
            error: "User not found"
          });
        }

        const newBalance = parseFloat(userData.balance) - parseFloat(withdrawData.amount);

        if (newBalance < 0) {
          // If withdrawal amount exceeds balance, return an error response
          return res.status(400).json({
            error: "Insufficient balance"
          });
        }

        const withdrawInfo = {
          $set: {
            balance: newBalance
          }
        };
        const balanceResult = await usersCollection.updateOne(query, withdrawInfo);

        if (balanceResult.modifiedCount > 0) {
          const result = await depositWithdrawCollection.insertOne(withdrawData);
          res.send(result);
          return;
        } else {
          // If balance is not updated, return an error response
          return res.status(500).json({
            error: "Failed to update balance"
          });
        }
      } catch (error) {
        // If an unexpected error occurs, return a general error response
        console.error("Error:", error);
        res.status(500).json({
          error: "Internal server error"
        });
      }
    });




    // user related api ends here

    // manage coin related api

    // add coin
    app.post('/v1/api/allCoins', async (req, res) => {
      const assetInfo = req.body;
      const result = await allCoinCollection.insertOne(assetInfo);
      res.send(result)
    })

    // get all coin in market page
    app.get('/v1/api/allCoins', async (req, res) => {
      console.log(req.query)
      try {
        const searchText = req.query.search;
        if (searchText !== "") {
          const coins = await allCoinCollection.find({
            name: {
              $regex: searchText,
              $options: 'i'
            }
          }).toArray(); // Perform case-insensitive search
          res.send(coins);
          console.log(searchText);
        } else {
          const result = await allCoinCollection.find().toArray();
          res.send(result);
        }
      } catch (error) {
        console.error('Error retrieving coins:', error);
        res.status(500).json({
          message: 'Internal Server Error'
        });
      }
    });

    // get all coin in manage coin page
    app.get('/v1/api/manageAllCoins', async (req, res) => {
      const result = await allCoinCollection.find().toArray();
      res.send(result);
    });

    // delete coin
    app.delete('/v1/api/allCoins/:id', async (req, res) => {
      const assetId = req.params.id;
      const query = {
        _id: new ObjectId(assetId)
      };
      const result = await allCoinCollection.deleteOne(query);
      res.send(result);
    });

    // update coin
    app.put('/v1/api/allCoins/:id', async (req, res) => {
      const assetId = req.params.id;
      const updatedCoin = req.body
      const filter = {
        _id: new ObjectId(assetId)
      };
      const updatedDoc = {
        $set: updatedCoin
      }
      const result = await allCoinCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })



    // watchList related api starts from here

    // add an asset to watchist
    app.post('/v1/api/watchlist', async (req, res) => {
      const assetInfo = req.body;
      const result = await watchListCollection.insertOne(assetInfo);
      res.send(result)
    })

    // get watchilst info for individual user
    app.get('/v1/api/watchlist', async (req, res) => {
      const email = req.query.email
      const query = {
        email: email
      };
      const result = await watchListCollection.find(query).sort({
        _id: -1
      }).toArray()
      res.send(result)
    })


    // --------Julfiker Ali-------- //
    // Delete asset from watchList
    app.delete('/v1/api/watchlist/:id', async (req, res) => {
      const assetId = req.params.id;
      const query = {
        _id: new ObjectId(assetId)
      };
      const result = await watchListCollection.deleteOne(query);
      res.send(result);
    });

    // watchList related api ends here

    // buy related api starts from here

    app.post('/v1/api/purchasedAssets/:remainingBalance', async (req, res) => {
      const asset = req.body;
      console.log(asset)
      const remainingBalance = req.params.remainingBalance
      // console.log(remainingBalance);

      const filter = {
        email: asset.assetBuyerEmail
      };
      const updatedDoc = {
        $set: {
          balance: remainingBalance
        }
      };
      const result1 = await usersCollection.updateOne(filter, updatedDoc);
      const result = await purchasedCollection.insertOne(asset)
      res.send(result);
    });

    app.get('/v1/api/purchasedAssets', async (req, res) => {
      const userEmail = req.query.email;
      const query = {
        assetBuyerEmail: userEmail
      }
      const result = await purchasedCollection.find(query).toArray()
      res.send(result)
    })


    // Ariful's API's

    // article API's
    app.post('/v1/api/articles', async (req, res) => {
      const articleInfo = req.body;
      const result = await articleCollection.insertOne(articleInfo);
      res.send(result)
    })

    // Read articles API's
    app.get('/v1/api/articles', async (req, res) => {
      const result = await articleCollection.find().toArray()
      res.send(result)
    })

    // Read Single Article API's
    app.get('/v1/api/articles/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      }
      const result = await articleCollection.findOne(query);
      res.send(result)
    })

    app.patch('/v1/api/articles/viewCount/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      }
      const update = {
        $inc: {
          viewCount: 1
        }
      };
      const result = await articleCollection.updateOne(query, update);
      res.send(result)
    })

    // Notifications data 

     // post a user in notificationsCollection
     app.post('/v1/api/notifications', async (req, res) => {
      const userInfo = req.body;
      const existingUser = await notificationsCollection.findOne({
        email: userInfo.email
      })
      if (existingUser) {
        return res.send({
          message: 'user already exists',
          insertedId: null
        })
      }
      const result = await notificationsCollection.insertOne(userInfo);
      res.send(result)
    })

    // get all notifications form data
    app.get('/v1/api/notifications', async (req, res) => {
      const result = await notificationsCollection.find().toArray()
      res.send(result)
    })

    //----Mahin--------

    //spot trading

    app.post('/v1/api/spotTrading', async (req, res) => {
      const asset = req.body;
      const result = await spotTradingCollection.insertOne(asset)
      res.send(result);
    });

    app.delete('/v1/api/spotTrading/:id', async (req, res) => {
      const assetId = req.params.id;
      const query = {
        _id: new ObjectId(assetId)
      };
      const result = await spotTradingCollection.deleteOne(query);
      res.send(result);
    });

    app.get('/v1/api/spotTrading', async (req, res) => {
      const result = await spotTradingCollection.find().toArray()
      res.send(result)
    })

 




    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({
      ping: 1
    });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('nexTrade server in running ')
});

app.listen(port, () => {
  console.log(`nexTrade server is running on port http://localhost:${port}`)
})
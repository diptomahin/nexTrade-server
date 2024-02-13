const express = require('express');
const cors = require('cors');
const {
  MongoClient,
  ServerApiVersion,
} = require('mongodb');
const app = express();
require("dotenv").config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());
// app.use(bodyParser.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pwyhut1.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
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
    const purchasedCollection = nexTrade.collection('purchasedAssets')


    // stripe //
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


    // get all users from usersCollection
    app.get('/v1/api/all-users', async (req, res) => {
      const userEmail = req.params.email;
      const query = {
        email: userEmail
      }
      const result = await usersCollection.find(query).toArray()
      res.send(result)
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


    // put
    app.put('/v1/api/all-users/deposit/:email', async (req, res) => {
      const userEmail = req.params.email;
      const depositData = req.body;
      const query = {
        email: userEmail
      }
      const userData = await usersCollection.findOne(query)

      const depositInfo = {
        $set: {
          balance: parseFloat(userData.balance) + parseFloat(depositData.deposit),
          depositWithdrawData: userData.hasOwnProperty('depositWithdrawData') ? [...userData.depositWithdrawData, depositData] : [depositData]
        },
      }
      const result = await usersCollection.updateOne(query, depositInfo);
      res.send(result)
    })

    // put
    app.put('/v1/api/all-users/withdraw/:email', async (req, res) => {
      const userEmail = req.params.email;
      const withdrawData = req.body;
      const query = {
        email: userEmail
      }
      const userData = await usersCollection.findOne(query)

      const withdrawInfo = {
        $set: {
          balance: parseFloat(userData.balance) - parseFloat(withdrawData.withdraw),
          depositWithdrawData: userData.hasOwnProperty('depositWithdrawData') ? [...userData.depositWithdrawData, withdrawData] : [withdrawData]
        },
      }
      const result = await usersCollection.updateOne(query, withdrawInfo);
      res.send(result)
    })

    // user related api ends here


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
      const query = { email: email };
      const result = await watchListCollection.find(query).sort({ _id: -1 }).toArray()
      res.send(result)
    })

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
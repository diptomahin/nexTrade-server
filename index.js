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
    const assetsCollection = nexTrade.collection('assets');
    const usersCollection = nexTrade.collection('all-users');
    const walletCollection = nexTrade.collection('wallet');


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

    app.get('/v1/api/all-users/:email', async (req, res) => {
      const userEmail = req.params.email;
      const query = {
        email: userEmail
      }
      const result = await usersCollection.find(query).sort({
        _id: -1
      }).toArray(); // get users in lifo methods
      res.send(result)
    })

    app.put('/v1/api/all-users', async (req, res) => {
      const asset = req.body;
      console.log(asset);

      const filter = {
        email: asset.assetBuyerEmail
      };
      const userInfo = await usersCollection.findOne(filter);

      // Update the portfolio field with the new array
      const updatedPortfolio = [...userInfo.portfolio, asset];

      const updatedDoc = {
        $set: {
          portfolio: updatedPortfolio
        }
      };

      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

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
          balance: userData.balance + depositData.deposit,
          depositData: [...userData.depositData, depositData]
        }
      }
      const result = await usersCollection.updateOne(query, depositInfo);
      res.send(result)
    })

    // get users assets
    app.get("/v1/api/assets/:email", async (req, res) => {
      const userEmail = req.params.email;
      const query = {
        assetBuyerEmail: userEmail
      }
      const result = await assetsCollection.find(query).toArray();
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
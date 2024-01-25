const express = require('express');
const cors = require('cors');
const {
  MongoClient,
  ServerApiVersion
} = require('mongodb');
const app = express();
require("dotenv").config();
// const bodyParser = require('body-parser');
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

    app.post('api/v1/deposit', async (req, res) => {
      // const email = req.params.email;
      const depositData = req.body;
      // const query = {
      //   email: email
      // };
      // const depositInfo = {
      //   $set: {
      //     transaction: depositData.paymentIntent,
      //     date: depositData.date,
      //     time: depositData.time,
      //     deposit: depositData.amount,
      //     email: depositData.user.email,
      //     name: depositData.user.displayName,
      //   }
      // }
      const result = await walletCollection.insertOne(depositData)
      console.log(result);
      res.send(result)
    })

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
      const result = await usersCollection.find().sort({
        _id: -1
      }).toArray(); // get users in lifo methods
      res.send(result)
    })

    // user related api ends here




    //Assets
    app.get('/v1/api/assets', async (req, res) => {
      const cursor = assetsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })


    app.post("/v1/api/assets", async (req, res) => {
      const assets = req.body;
      const result = await assetsCollection.insertOne(assets)
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
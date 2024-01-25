const express = require('express');
const  cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
require ("dotenv").config();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());





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
    const assetsCollection = nexTrade.collection('assets');

    //Assets
    app.get('/assets', async (req, res) => {
    const cursor = assetsCollection.find();
    const result = await cursor.toArray();
    res.send(result);
    })


    app.post("/assets", async (req, res) => {
      const assets = req.body;
      const result = await assetsCollection.insertOne(assets)
      res.send(result)
    })








    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
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

app.listen(port,()=>{
    console.log(`nexTrade server is running on port ${port}`)
})

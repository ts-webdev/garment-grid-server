const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

// ===== middleware =====
app.use(cors());
app.use(express.json());

// ===== Mongo URI =====
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.b6ihxc4.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db("garment_grid_db");
    const productCollection = db.collection("products");

    

    // ===== ping =====
    await client.db("admin").command({ ping: 1 });
    console.log("✅ MongoDB connected successfully");
  } finally {
    // keep alive
  }
}

run().catch(console.dir);

// ===== listen =====
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

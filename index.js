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

    // =====================================================
    // ✅ POST — Add Product
    // =====================================================
    app.post("/products", async (req, res) => {
      try {
        const product = req.body;

        if (!product?.name) {
          return res.status(400).send({
            success: false,
            message: "Product name is required",
          });
        }

        const result = await productCollection.insertOne({
          ...product,
          createdAt: new Date(),
        });

        res.send({
          success: true,
          message: "Product added successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("POST /products error:", error);
        res.status(500).send({
          success: false,
          message: "Failed to add product",
        });
      }
    });

    // =====================================================
    // ✅ GET — All Products (with pagination)
    // =====================================================
    app.get("/products", async (req, res) => {
      try {
        const { page = 1, limit = 10 } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const products = await productCollection
          .find()
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .toArray();

        const total = await productCollection.countDocuments();

        res.send({
          success: true,
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          data: products,
        });
      } catch (error) {
        console.error("GET /products error:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch products",
        });
      }
    });

    // =====================================================
    // ✅ GET — Single Product
    // =====================================================
    app.get("/products/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const product = await productCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!product) {
          return res.status(404).send({
            success: false,
            message: "Product not found",
          });
        }

        res.send(product);
      } catch (error) {
        console.error("GET /products/:id error:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch product",
        });
      }
    });

    // =====================================================
    // ✅ ROOT
    // =====================================================
    app.get("/", (req, res) => {
      res.send("Garment-Grid Server is Running...");
    });

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

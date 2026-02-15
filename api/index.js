// server/index.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 3000;

// ===== middleware =====
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://garment-grid-two.vercel.app",
    ],
    credentials: true,
  })
);


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
    // Connect to MongoDB
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const db = client.db("garment_grid_db");
    const productCollection = db.collection("products");
    const bookingCollection = db.collection("bookings");
    const userCollection = db.collection("users");

    // =====================================================
    // ✅ POST — Save User to Database (Register)
    // =====================================================
    app.post("/users", async (req, res) => {
      try {
        const userData = req.body;

        // Check required fields
        if (!userData?.email) {
          return res.status(400).send({
            success: false,
            message: "Email is required",
          });
        }

        // Check if user already exists
        const existingUser = await userCollection.findOne({
          email: userData.email,
        });

        if (existingUser) {
          // Update existing user
          await userCollection.updateOne(
            { email: userData.email },
            { $set: { ...userData, updatedAt: new Date() } },
          );
          return res.send({
            success: true,
            message: "User updated successfully",
          });
        }

        // Insert new user
        const result = await userCollection.insertOne({
          ...userData,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        res.send({
          success: true,
          message: "User created successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("POST /users error:", error);
        res.status(500).send({
          success: false,
          message: "Failed to save user",
        });
      }
    });

    // =====================================================
    // ✅ GET — User by Email
    // =====================================================
    app.get("/users/:email", async (req, res) => {
      try {
        const { email } = req.params;

        const user = await userCollection.findOne({ email });

        if (!user) {
          return res.status(404).send({
            success: false,
            message: "User not found",
          });
        }

        res.send({
          success: true,
          data: user,
        });
      } catch (error) {
        console.error("GET /users/:email error:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch user",
        });
      }
    });

    // =====================================================
    // ✅ PATCH — Update User
    // =====================================================
    app.patch("/users/:email", async (req, res) => {
      try {
        const { email } = req.params;
        const updates = req.body;

        const result = await userCollection.updateOne(
          { email },
          { $set: { ...updates, updatedAt: new Date() } },
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "User not found",
          });
        }

        res.send({
          success: true,
          message: "User updated successfully",
        });
      } catch (error) {
        console.error("PATCH /users/:email error:", error);
        res.status(500).send({
          success: false,
          message: "Failed to update user",
        });
      }
    });

    // =====================================================
    // ✅ GET — User Stats
    // =====================================================
    app.get("/users/:email/stats", async (req, res) => {
      try {
        const { email } = req.params;

        const totalOrders = await bookingCollection.countDocuments({ email });
        const completedOrders = await bookingCollection.countDocuments({
          email,
          status: "delivered",
        });
        const pendingOrders = await bookingCollection.countDocuments({
          email,
          status: "pending",
        });

        const orders = await bookingCollection.find({ email }).toArray();

        const totalSpent = orders.reduce(
          (sum, order) => sum + (order.totalPrice || 0),
          0,
        );

        res.send({
          success: true,
          data: {
            totalOrders,
            completedOrders,
            pendingOrders,
            totalSpent,
            wishlistCount: 5,
          },
        });
      } catch (error) {
        console.error("GET /users/:email/stats error:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch user stats",
        });
      }
    });

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

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid product ID format",
          });
        }

        const product = await productCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!product) {
          return res.status(404).send({
            success: false,
            message: "Product not found",
          });
        }

        res.send({
          success: true,
          data: product,
        });
      } catch (error) {
        console.error("GET /products/:id error:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch product",
        });
      }
    });

    // =====================================================
    // ✅ POST — Create Booking (Order)
    // =====================================================
    app.post("/bookings", async (req, res) => {
      try {
        const booking = req.body;

        // Validate required fields
        const requiredFields = [
          "productId",
          "productName",
          "pricePerPiece",
          "quantity",
          "totalPrice",
          "email",
          "firstName",
          "lastName",
          "contactNumber",
          "deliveryAddress",
          "paymentMethod",
        ];

        for (const field of requiredFields) {
          if (!booking[field]) {
            return res.status(400).send({
              success: false,
              message: `${field} is required`,
            });
          }
        }

        const result = await bookingCollection.insertOne({
          ...booking,
          status:
            booking.paymentMethod === "Cash on Delivery"
              ? "confirmed"
              : "pending",
          paymentStatus:
            booking.paymentMethod === "Cash on Delivery" ? "pending" : "paid",
          createdAt: new Date(),
          updatedAt: new Date(),
          tracking: [
            {
              stage: "Order Placed",
              location: "Online",
              date: new Date(),
              note: "Order has been placed successfully",
            },
          ],
        });

        // Update product quantity
        if (booking.paymentMethod !== "Cash on Delivery") {
          await productCollection.updateOne(
            { _id: new ObjectId(booking.productId) },
            { $inc: { "inventory.available": -booking.quantity } },
          );
        }

        res.send({
          success: true,
          message: "Booking created successfully",
          bookingId: result.insertedId,
        });
      } catch (error) {
        console.error("POST /bookings error:", error);
        res.status(500).send({
          success: false,
          message: "Failed to create booking",
        });
      }
    });

    // =====================================================
    // ✅ GET — User's Bookings (My Orders)
    // =====================================================
    app.get("/bookings/user/:email", async (req, res) => {
      try {
        const { email } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const bookings = await bookingCollection
          .find({ email })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .toArray();

        const total = await bookingCollection.countDocuments({ email });

        res.send({
          success: true,
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          data: bookings,
        });
      } catch (error) {
        console.error("GET /bookings/user/:email error:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch bookings",
        });
      }
    });

    // =====================================================
    // ✅ GET — Single Booking
    // =====================================================
    app.get("/bookings/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid booking ID format",
          });
        }

        const booking = await bookingCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!booking) {
          return res.status(404).send({
            success: false,
            message: "Booking not found",
          });
        }

        res.send({
          success: true,
          data: booking,
        });
      } catch (error) {
        console.error("GET /bookings/:id error:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch booking",
        });
      }
    });

    // =====================================================
    // ✅ POST — Create Payment Intent (Stripe)
    // =====================================================
    app.post("/create-payment-intent", async (req, res) => {
      try {
        const { amount, currency = "usd", bookingData } = req.body;

        if (!amount || amount <= 0) {
          return res.status(400).send({
            success: false,
            message: "Valid amount is required",
          });
        }

        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100),
          currency,
          metadata: {
            productName: bookingData?.productName || "",
            quantity: bookingData?.quantity?.toString() || "0",
            customerEmail: bookingData?.email || "",
            customerName:
              `${bookingData?.firstName || ""} ${bookingData?.lastName || ""}`.trim(),
          },
        });

        res.send({
          success: true,
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        console.error("POST /create-payment-intent error:", error);
        res.status(500).send({
          success: false,
          message: error.message || "Failed to create payment intent",
        });
      }
    });

    // =====================================================
    // ✅ POST — Confirm Payment
    // =====================================================
    app.post("/payment-confirmation", async (req, res) => {
      try {
        const { paymentIntentId, bookingId } = req.body;

        const paymentIntent =
          await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status === "succeeded") {
          await bookingCollection.updateOne(
            { _id: new ObjectId(bookingId) },
            {
              $set: {
                paymentStatus: "paid",
                status: "confirmed",
                updatedAt: new Date(),
              },
              $push: {
                tracking: {
                  stage: "Payment Confirmed",
                  location: "Online",
                  date: new Date(),
                  note: "Payment has been confirmed",
                },
              },
            },
          );

          res.send({
            success: true,
            message: "Payment confirmed successfully",
          });
        } else {
          res.status(400).send({
            success: false,
            message: "Payment not successful",
          });
        }
      } catch (error) {
        console.error("POST /payment-confirmation error:", error);
        res.status(500).send({
          success: false,
          message: "Failed to confirm payment",
        });
      }
    });

    // =====================================================
    // ✅ PATCH — Update Booking Status
    // =====================================================
    app.patch("/bookings/:id/status", async (req, res) => {
      try {
        const id = req.params.id;
        const { status } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid booking ID format",
          });
        }

        const validStatuses = [
          "pending",
          "confirmed",
          "processing",
          "shipped",
          "delivered",
          "cancelled",
        ];

        if (!validStatuses.includes(status)) {
          return res.status(400).send({
            success: false,
            message: "Invalid status",
          });
        }

        const result = await bookingCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status,
              updatedAt: new Date(),
            },
          },
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Booking not found",
          });
        }

        res.send({
          success: true,
          message: "Booking status updated successfully",
        });
      } catch (error) {
        console.error("PATCH /bookings/:id/status error:", error);
        res.status(500).send({
          success: false,
          message: "Failed to update booking status",
        });
      }
    });

    // =====================================================
    // ✅ DELETE — Cancel Booking (Only if pending)
    // =====================================================
    app.delete("/bookings/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid booking ID format",
          });
        }

        const booking = await bookingCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!booking) {
          return res.status(404).send({
            success: false,
            message: "Booking not found",
          });
        }

        // Only allow cancellation if status is 'pending'
        if (booking.status !== "pending") {
          return res.status(400).send({
            success: false,
            message: "Cannot cancel order after it's confirmed",
          });
        }

        const result = await bookingCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Booking not found",
          });
        }

        res.send({
          success: true,
          message: "Booking cancelled successfully",
        });
      } catch (error) {
        console.error("DELETE /bookings/:id error:", error);
        res.status(500).send({
          success: false,
          message: "Failed to cancel booking",
        });
      }
    });

    // =====================================================
    // ✅ POST — Add Tracking Info
    // =====================================================
    app.post("/bookings/:id/tracking", async (req, res) => {
      try {
        const id = req.params.id;
        const trackingData = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid booking ID format",
          });
        }

        const result = await bookingCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $push: {
              tracking: {
                ...trackingData,
                date: new Date(),
              },
            },
            $set: {
              updatedAt: new Date(),
            },
          },
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Booking not found",
          });
        }

        res.send({
          success: true,
          message: "Tracking info added successfully",
        });
      } catch (error) {
        console.error("POST /bookings/:id/tracking error:", error);
        res.status(500).send({
          success: false,
          message: "Failed to add tracking info",
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
    console.log("✅ MongoDB connection verified");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
  }
}

run().catch(console.dir);

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error:", err);
  res.status(500).send({
    success: false,
    message: "Internal server error",
  });
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

module.exports = app;

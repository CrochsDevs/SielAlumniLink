    import { MongoClient, ServerApiVersion } from 'mongodb';
    import dotenv from 'dotenv';

    dotenv.config();

    const client = new MongoClient(process.env.MONGO_URI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
    });

    export async function connectDB() {
    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("✅ Successfully connected to MongoDB Compass!");
        return client;
    } catch (error) {
        console.error("❌ MongoDB connection failed:", error);
        process.exit(1);
    }
    }

    export { client };
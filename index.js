const express = require('express');
const cors = require('cors');
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json());


const verifyJwt = (req, res, next) => {
    const authorization = req.headers.authorization;
    if(!authorization){
        return res.status(401).send({error: true, message:"Unauthorized Access"});
    }
    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded)=>{
        if(err){
            return res.status(401).send({error: true, message:"Unauthorized Access"});
        }
        req.decoded = decoded;
        next();
    })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.v9m7cjb.mongodb.net/?retryWrites=true&w=majority`;

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
        // Connect the client to the server	(optional starting in v4.7)
        client.connect();
        // Default route
        app.get('/', (req, res) => {
            res.send("Boss Is Running");
        });
        // Collection
        const usersCollection = client.db("bistroBossDB").collection("users");
        const menuCollection = client.db("bistroBossDB").collection("menu");
        const reviewCollection = client.db("bistroBossDB").collection("reviews");
        const cartCollection = client.db("bistroBossDB").collection("carts");

        // jwt node bellow code for generate secret key
        // require("crypto").randomBytes(64).toString("hex")
        // ACCESS_TOKEN=eb6c0546ff5cd88909b71f01eb729e951d86bfa604ddc0263b239ad20c195f1efdbaf721818d6abc2916b460eaecb8ddb18d0b252a68df326f85c105e8beee39
        app.post("/jwt", (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN, 
                { expiresIn: '1h' });
                res.send({token});
        })

        // Verify Admin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = {email: email};
            const user = await usersCollection.findOne(query);
            if(user?.role !== 'admin'){
                return res.status(403).send({error: true, message: "Forbidden User"})
            }
            next();
        }

        // User Related Api

        app.get("/users", verifyJwt, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        app.post("/users", async (req, res) => {
            const user = req.body;
            // console.log(user);
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);
            // console.log("existing user", existingUser);
            if (existingUser) {
                return res.send({ message: 'User already exists' })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        app.get("/users/admin/:email", verifyJwt, async (req, res) => {
            const email = req.params.email;
            if(req.decoded.email !== email) {
                res.send({admin : false})
            }
            // console.log(email);
            const query = {email: email};
            const user = await usersCollection.findOne(query);
            const result = {admin: user?.role === 'admin'};
            res.send(result);
        })

        app.patch("/users/admin/:id", async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const filter = { _id: new ObjectId(id) };
            // const options = {upsert: true};
            const updateDoc = {
                $set: {
                    role: "admin"
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc)
            res.send(result);
        })

        app.delete("/users/admin/:id", async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const query = { _id: new ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })


        // get all menu items
        app.get("/menu", async (req, res) => {
            const result = await menuCollection.find().toArray();
            res.send(result);
        });

        // get all review items
        app.get("/review", async (req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result);
        });

        // get all cart items form cart collection
        app.get("/carts", verifyJwt, async (req, res) => {
            const email = req.query.email;
            if(!email) {
                res.send([]);
            }
            const decodedEmail = req.decoded.email;
            if(email !== decodedEmail) {
                return res.status(401).send({error: true, message:"Forbidden Access"});
            }
            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result);
        });


        // Post a new cart
        app.post("/carts", async (req, res) => {
            const item = req.body;
            const result = await cartCollection.insertOne(item);
            res.send(result);
        });
        // Delete a cart
        app.delete("/carts/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
            // console.log(id);

        });


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.listen(port, () => {
    console.log("listening on port " + port);
})


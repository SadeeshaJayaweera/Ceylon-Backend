const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const app = express();
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require("multer");
const path = require("path");
const jwt = require("jsonwebtoken");
const fs = require('fs');

// Import the Post model
const Post = require('./models/Post');
const JWT_SECRET = 'Ab#12345@45awe';
const ADMIN_EMAIL = 'admin@gmail.com';
const ADMIN_PASSWORD = 'admin';

app.use(express.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // Generate a unique iconic name based on current timestamp and a random string
        const iconicName = Date.now() + '_' + Math.random().toString(36).substr(2, 9) + path.extname(file.originalname);
        cb(null, iconicName);
    },
});

const upload = multer({ storage });

// API endpoint for uploading images
app.post('/upload', upload.array('images', 3), async (req, res) => {
    try {
        const imagePaths = req.files.map(file => file.path);

        const post = new Post({

            adTitle: req.body.adTitle,
            adDescription: req.body.adDescription,
            adpropertyType: req.body.adpropertyType,
            rentType: req.body.rentType,
            district: req.body.district,
            area: req.body.area,
            rooms: req.body.rooms,
            bathrooms: req.body.bathrooms,
            price: req.body.price,
            telephone: req.body.telephone,
            email: req.body.email,
            uploaderName: req.body.uploaderName,
            pending: req.body.pending,
            imagePaths: imagePaths,
        });

        await post.save();

        res.status(201).send({ message: 'Images uploaded successfully', post });
    } catch (error) {
        res.status(500).send({ message: 'Error uploading images', error });
    }
});

// Api for conditions
app.get('/posts', async (req, res) => {
    try {
        // Create a query object to hold the filters
        const query = {pending: false};

        // Add filters to the query object based on the query parameters
        if (req.query.adpropertyType) {
            query.adpropertyType = req.query.adpropertyType;
        }
        if (req.query.rentType) {
            query.rentType = req.query.rentType;
        }
        if (req.query.district) {
            query.district = req.query.district;
        }

        // Fetch the posts with the applied filters
        const posts = await Post.find(query);
        res.status(200).json(posts);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching posts', error });
    }
});

// api for fetch other post
app.get('/posts/other', async (req, res) => {
    try {
        // Create a query object to hold the filters
        const query = { pending: false, adpropertyType: "other" };

        // Fetch the posts with the applied filters
        const posts = await Post.find(query);
        res.status(200).json(posts);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching posts', error });
    }
});

// Login route
app.post('/admin/login', async (req, res) => {
    const { email, password } = req.body;

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
        return res.status(401).send({ message: 'Invalid email or password' });
    }

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1h' });

    res.send({ token });
});


// Middleware to check JWT
const authenticateJWT = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) {
        return res.status(401).send({ message: 'Access denied, no token provided' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (error) {
        res.status(401).send({ message: 'Invalid token' });
    }
};

// Api for fetching all pending posts
app.get('/posts/pending', authenticateJWT, async (req, res) => {
    try {
        // Fetch all posts with pending: true from the database, sorted by createdAt in descending order
        const pendingPosts = await Post.find({ pending: true }).sort({ createdAt: -1 });
        res.status(200).json(pendingPosts);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching pending posts', error });
    }
});

// Api for fetching all posts
app.get('/posts/all', authenticateJWT, async (req, res) => {
    try {
        // Fetch all posts with pending: true from the database, sorted by createdAt in descending order
        const pendingPosts = await Post.find({ pending: false }).sort({ createdAt: -1 });
        res.status(200).json(pendingPosts);
    } catch (error) {
        res.status(500).send({ message: 'Error fetching pending posts', error });
    }
});


// Api for changing the pending status to true
app.put('/posts/:id/pending', authenticateJWT, async (req, res) => {
    try {
        const postId = req.params.id;
        const updatedPost = await Post.findByIdAndUpdate(
            postId,
            { pending: false }, // Update the pending status to false
            { new: true }
        );
        if (!updatedPost) {
            return res.status(404).send({ message: 'Post not found' });
        }
        res.status(200).json(updatedPost);
    } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).send({ message: 'Error updating post', error });
    }
});

// API for deleting a post
// app.delete('/posts/:id', authenticateJWT, async (req, res) => {
//     try {
//         const postId = req.params.id;
//         const deletedPost = await Post.findByIdAndDelete(postId);
//         if (!deletedPost) {
//             return res.status(404).send({ message: 'Post not found' });
//         }
//         res.status(200).send({ message: 'Post deleted successfully' });
//     } catch (error) {
//         res.status(500).send({ message: 'Error deleting post', error });
//     }
// });


// API for deleting a post with images
app.delete('/posts/:id', authenticateJWT, async (req, res) => {
    try {
        const postId = req.params.id;
        const deletedPost = await Post.findByIdAndDelete(postId);
        if (!deletedPost) {
            return res.status(404).send({ message: 'Post not found' });
        }
        
        // Delete associated images from the server
        const imagePaths = deletedPost.imagePaths;
        await Promise.all(imagePaths.map(async (imagePath) => {
            try {
                await fs.promises.unlink(imagePath); // Use fs.promises.unlink to return a promise
            } catch (error) {
                console.error('Error deleting image:', error);
                throw error; // Rethrow the error to be caught by the catch block below
            }
        }));

        res.status(200).send({ message: 'Post and associated images deleted successfully' });
    } catch (error) {
        res.status(500).send({ message: 'Error deleting post', error });
    }
});

// API for editing a post
app.put('/posts/:id',authenticateJWT, async (req, res) => {
    try {
        const postId = req.params.id;
        const updatedPostData = req.body; // New data for the post

        // Find the post by ID and update it with the new data
        const updatedPost = await Post.findByIdAndUpdate(postId, updatedPostData, { new: true });

        if (!updatedPost) {
            return res.status(404).send({ message: 'Post not found' });
        }

        res.status(200).json(updatedPost);
    } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).send({ message: 'Error updating post', error });
    }
});

// API for fetching a post by ID
app.get('/posts/:id', async (req, res) => {
    try {
        const postId = req.params.id;
        
        // Find the post by ID in the database
        const post = await Post.findById(postId);
        
        if (!post) {
            return res.status(404).send({ message: 'Post not found' });
        }
        
        res.status(200).json(post);
    } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).send({ message: 'Error fetching post', error });
    }
});



























mongoose
    .connect("mongodb+srv://kaushalyahansana:RMEuKuQldonJOiyA@ceylon-homes.qiq2zlb.mongodb.net/?retryWrites=true&w=majority&appName=ceylon-homes/test")
    .then(() => {
        console.log("Connected to MongoDB");

        // Use the port from the environment variable or default to 3000
        const PORT = process.env.PORT || 3000;

        // Start the HTTP server
        app.listen(PORT, () => {
            console.log(`Node app is running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error("Error connecting to MongoDB:", error);
    });

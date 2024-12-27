const express = require('express');
const cors = require('cors');
const path = require('path');
const syntaxRoutes = require('./routes/syntax');

const app = express();

// CORS configuration
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', "https://vidcode.fly.dev"],  
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// Body parser
app.use(express.json());

// Serve the temp_videos directory as static
app.use('/temp_videos', express.static(path.join(__dirname, 'controllers/temp_videos')));

// API routes
app.use('/api', syntaxRoutes);

// Static files
app.use(express.static(path.join(__dirname, 'client/dist')));

// Disk space check
const { execSync } = require('child_process');
try {
    const diskSpace = execSync('df -h').toString();
    console.log('Disk space available:', diskSpace);
} catch (error) {
    console.error('Error checking disk space:', error);
}

// Catch-all route - should be last
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist', 'index.html')); 
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

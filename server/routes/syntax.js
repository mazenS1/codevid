const express = require('express');
const router = express.Router();
const { generateSyntaxVideo } = require('../controllers/syntaxController');

router.post('/generate-syntax-video', generateSyntaxVideo);

module.exports = router;

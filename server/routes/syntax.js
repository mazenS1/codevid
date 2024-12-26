const express = require('express');
const router = express.Router();
const { generateSyntaxVideo , downloadVideo} = require('../controllers/syntaxController');

router.post('/generate-syntax-video', generateSyntaxVideo);
router.get('/download-video/:videoId', downloadVideo);

module.exports = router;

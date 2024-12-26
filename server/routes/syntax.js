const express = require('express');
const router = express.Router();
const { generateSyntaxVideo , downloadVideo, streamVideo} = require('../controllers/syntaxController');

router.post('/generate-syntax-video', generateSyntaxVideo);
router.get('/download-video/:videoId', downloadVideo);
router.get('/stream-video/:videoId', streamVideo);
module.exports = router;

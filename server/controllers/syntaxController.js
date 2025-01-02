const puppeteer = require('puppeteer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const prism = require('prismjs');
const loadLanguages = require('prismjs/components/');
loadLanguages(['javascript', 'python', 'html', 'css']);
const { logger } = require('../utils/logger');

// Initialize cleanup interval once
const videoDir = path.join(__dirname, 'temp_videos');
if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true });
}

const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes
const FILE_EXPIRY = 5 * 60 * 1000; // 5 minutes

// Global cleanup interval
setInterval(() => {
    if (!fs.existsSync(videoDir)) return;
    
    fs.readdir(videoDir, (err, files) => {
        if (err) return;

        const now = Date.now();
        files.forEach(file => {
            const filePath = path.join(videoDir, file);
            fs.stat(filePath, (statErr, stats) => {
                if (statErr) return;
                if (now - stats.mtimeMs > FILE_EXPIRY) {
                    fs.unlink(filePath, () => {});
                }
            });
        });
    });
}, CLEANUP_INTERVAL);

const generateSyntaxVideo = async (req, res) => {
    const framesDir = path.join(__dirname, 'syntax-frames');
    
    try {
        logger.info('Generating syntax video', { 
            code: req.body.code, 
            language: req.body.language, 
            typingSpeed: req.body.typingSpeed, 
            theme: req.body.theme, 
            frameRate: req.body.frameRate, 
            selectedBackground: req.body.selectedBackground 
        });
        
        const { code, language, typingSpeed, theme, frameRate, selectedBackground } = req.body;
        console.log( "code: ", code);
        console.log( "language: ", language);
        console.log( "typingSpeed: ", typingSpeed);
        console.log( "theme: ", theme);
        console.log( "frameRate: ", frameRate);
        console.log( "selectedBackground: ", selectedBackground);

        if (frameRate > 30) {
            frameRate = 30;
        }

        // Ensure directories exist with proper permissions
        [framesDir, videoDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
            }
        });

        const videoId = Date.now().toString();
        const outputPath = path.join(videoDir, `${videoId}.mp4`);

        const themeMap = {
            tomorrow: 'prism-tomorrow',
            dark: 'prism-dark',
            okaidia: 'prism-okaidia',
            twilight: 'prism-twilight',
            coy: 'prism-coy',
            solarizedlight: 'prism-solarizedlight',
            funky: 'prism-funky'
        };

        const selectedTheme = themeMap[theme] || 'prism-tomorrow';

        // Reuse browser instance between requests
        if (!global.browser) {
            global.browser = await puppeteer.launch({
                executablePath: '/usr/bin/google-chrome',
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
                defaultViewport: {
                    width: 1280,
                    height: 720,
                    deviceScaleFactor: 1,
                }
            });
        }

        const page = await global.browser.newPage();
        
        // Optimize performance with page settings
        await page.setCacheEnabled(true);
        await page.setRequestInterception(true);
        page.on('request', request => {
            if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
                request.continue();
            } else {
                request.abort();
            }
        });

        const htmlTemplate = `
            <html>
            <head>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/${selectedTheme}.min.css">
            <style>
            body {
            background: ${!selectedBackground ? 
                (theme === 'solarizedlight' ? '#fdf6e3' : 
                theme === 'tomorrow' ? '#2d2d2d' :
                theme === 'dark' ? '#1e1e1e' :
                theme === 'okaidia' ? '#272822' :
                theme === 'twilight' ? '#141414' :
                theme === 'coy' ? '#fdfdfd' :
                theme === 'funky' ? '#333' : '#000000') : 
                selectedBackground};
            padding: 40px;
            font-family: 'Courier New', monospace;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            }
            pre {
            font-size: 24px;
            line-height: 1.5;
            margin: 0;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0,0,0,0.3);
            width: 90%;
            max-width: 1600px;
            }
            .cursor {
            border-right: 3px solid ${theme === 'solarizedlight' || theme === 'coy' ? '#000' : '#fff'};
            margin-right: -3px;
            animation: blink 1s infinite;
            }
            @keyframes blink {
            50% { opacity: 0; }
            }
            </style>
            </head>
            <body>
            <pre><code class="language-${language}">CONTENT_PLACEHOLDER</code></pre>
            </body>
            </html>
        `;

        // Initial page load with template
        await page.setContent(htmlTemplate);

        // Pre-tokenize the code
        const tokens = [];
        const processToken = (token) => {
            if (typeof token === 'string') {
                tokens.push(...token.split('').map(char => ({ type: 'text', content: char })));
            } else if (Array.isArray(token.content)) {
                token.content.forEach(subToken => processToken(subToken));
            } else if (typeof token.content === 'string') {
                tokens.push(...token.content.split('').map(char => ({ type: token.type, content: char })));
            }
        };

        prism.tokenize(code, prism.languages[language]).forEach(processToken);

        let frameIndex = 0;
        // Invert the relationship - slower typing speed = more frames per char
        const framesPerChar = Math.max(1, Math.floor((1000 / typingSpeed) * (frameRate / 30)));
        let displayedTokens = [];

        // Process frames while maintaining typing effect
        for (let i = 0; i < tokens.length; i++) {
            displayedTokens.push(tokens[i]);
            const htmlContent = displayedTokens.map(token => 
                `<span class="token ${token.type}">${token.content}</span>`
            ).join('');

            const content = htmlTemplate.replace('CONTENT_PLACEHOLDER', 
                `${htmlContent}<span class="cursor">&nbsp;</span>`);
            
            await page.setContent(content);

            // Take screenshots for this character
            const framePromises = [];
            const currentFrameIndex = frameIndex;
            for (let j = 0; j < framesPerChar; j++) {
                const framePath = `${framesDir}/frame_${String(frameIndex).padStart(4, '0')}.jpg`;
                framePromises.push(
                    page.screenshot({ 
                        path: framePath,
                        quality: 80,
                        type: 'jpeg'
                    })
                );
                frameIndex++;
            }
            await Promise.all(framePromises);
        }

        // Add final frames with cursor
        const finalFrames = [];
        for (let i = 0; i < 10; i++) {
            const framePath = `${framesDir}/frame_${String(frameIndex).padStart(4, '0')}.jpg`;
            finalFrames.push(
                page.screenshot({ 
                    path: framePath,
                    quality: 80,
                    type: 'jpeg'
                })
            );
            frameIndex++;
        }
        await Promise.all(finalFrames);

        // Verify frames before FFmpeg
        const framesBeforeFFmpeg = fs.readdirSync(framesDir);

        // Optimized FFmpeg settings
        await new Promise((resolve, reject) => {
            // First verify frames exist
            const frames = fs.readdirSync(framesDir);
            if (frames.length === 0) {
                reject(new Error('No frames found in frames directory'));
                return;
            }

            const firstFrame = path.join(framesDir, frames[0]);
            if (!fs.existsSync(firstFrame)) {
                reject(new Error('First frame does not exist'));
                return;
            }

            const command = ffmpeg()
                .addInput(`${framesDir}/frame_%04d.jpg`)
                .inputFPS(frameRate)
                .outputOptions([
                    '-c:v libx264',
                    '-preset medium',
                    '-crf 23',
                    '-pix_fmt yuv420p',
                    '-movflags +faststart',
                    '-threads 0',
                    '-profile:v baseline',
                    '-level 3.0',
                    '-maxrate 2M',
                    '-bufsize 2M'
                ]);

            command.on('end', async () => {
                resolve();
            });

            command.on('error', (err, stdout, stderr) => {
                console.error('FFmpeg error:', err);
                console.error('FFmpeg stdout:', stdout);
                console.error('FFmpeg stderr:', stderr);
                reject(err);
            });

            // Start the FFmpeg process
            command.save(outputPath);
        });

        // Final verification
        if (!fs.existsSync(outputPath)) {
            throw new Error('Video file was not created');
        }

        const videoStats = fs.statSync(outputPath);
        if (videoStats.size < 1000) { 
            throw new Error('Generated video file is too small, likely corrupted');
        }

        const downloadLink = `/api/download-video/${videoId}`;	
        logger.info('Syntax video generated successfully', { 
            downloadLink, 
            videoId, 
            expirein: '24h' 
        });
        res.json({
            downloadLink,
            message: 'Video generated successfully',
            expirein: '24h'
        });

    } catch (error) {
        logger.error('Error during video generation:', {
            error: error.message,
            stack: error.stack,
            code: req.body.code,
            language: req.body.language,
            typingSpeed: req.body.typingSpeed,
            theme: req.body.theme,
            frameRate: req.body.frameRate,
            selectedBackground: req.body.selectedBackground
        });
        res.status(500).send('Error generating syntax highlighted video');
    } finally {
        // Only delete frames directory if it exists
        if (fs.existsSync(framesDir)) {
            try {
                fs.rmSync(framesDir, { recursive: true, force: true });
            } catch (err) {
                console.error('Error cleaning up frames directory:', err);
            }
        }
    }
};

const downloadVideo = (req, res) => {
    try {
        const { videoId } = req.params;
        const videoPath = path.join(videoDir, `${videoId}.mp4`);

        if (!fs.existsSync(videoPath)) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const stat = fs.statSync(videoPath);
        if (stat.size < 1000) {
            return res.status(500).json({ error: 'Video file appears to be corrupted' });
        }

        // Redirect to the static file URL
        const staticVideoUrl = `/temp_videos/${videoId}.mp4`;
        logger.info('Video downloaded successfully', { 
            videoId, 
            staticVideoUrl 
        });
        res.json({ downloadUrl: staticVideoUrl });
    } catch (error) {
        logger.error('Error in downloadVideo:', {
            error: error.message,
            stack: error.stack,
            videoId: req.params.videoId
        });
        res.status(500).json({ error: 'Internal server error' });
    }
};

const streamVideo = (req, res) => {
    const { videoId } = req.params;
    const videoPath = path.join(videoDir, `${videoId}.mp4`);
    
    if (!fs.existsSync(videoPath)) {
        return res.status(404).send('Video not found');
    }

    const stat = fs.statSync(videoPath);
    const range = req.headers.range;

    try {
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size-1;
            const chunksize = (end-start)+1;
            
            if (start >= stat.size) {
                res.status(416).send('Requested range not satisfiable');
                return;
            }

            const file = fs.createReadStream(videoPath, {start, end});
            const head = {
                'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4',
                'Cache-Control': 'no-cache'
            };
            
            res.writeHead(206, head);
            
            file.on('error', (error) => {
                logger.error('Error streaming video:', {
                    error: error.message,
                    stack: error.stack,
                    videoId: req.params.videoId
                });
                if (!res.headersSent) {
                    res.status(500).send('Error streaming video');
                }
                res.end();
            });

            file.on('end', () => {
                logger.info('Video stream ended successfully', { 
                    videoId: req.params.videoId 
                });
            });

            file.pipe(res);
        } else {
            const head = {
                'Content-Length': stat.size,
                'Content-Type': 'video/mp4',
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'no-cache'
            };
            
            res.writeHead(200, head);
            
            const file = fs.createReadStream(videoPath);
            
            file.on('error', (error) => {
                logger.error('Error streaming video:', {
                    error: error.message,
                    stack: error.stack,
                    videoId: req.params.videoId
                });
                if (!res.headersSent) {
                    res.status(500).send('Error streaming video');
                }
                res.end();
            });

            file.on('end', () => {
                logger.info('Video stream ended successfully', { 
                    videoId: req.params.videoId 
                });
            });

            file.pipe(res);
        }
    } catch (error) {
        logger.error('Unexpected error in stream video:', {
            error: error.message,
            stack: error.stack,
            videoId: req.params.videoId
        });
        if (!res.headersSent) {
            res.status(500).send('Internal server error');
        }
        res.end();
    }
};

module.exports = {
    generateSyntaxVideo,
    downloadVideo,
    streamVideo
};

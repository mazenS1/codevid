const puppeteer = require('puppeteer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const prism = require('prismjs');
const loadLanguages = require('prismjs/components/');
loadLanguages(['javascript', 'python', 'html', 'css']);

// Initialize cleanup interval once
const videoDir = path.join(__dirname, 'temp_videos');
if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true });
    console.log('Created video directory:', videoDir);
}

const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes
const FILE_EXPIRY = 10 * 60 * 1000; // 10 minutes

// Global cleanup interval
setInterval(() => {
    if (!fs.existsSync(videoDir)) {
        console.log('Video directory does not exist:', videoDir);
        return;
    }
    
    fs.readdir(videoDir, (err, files) => {
        if (err) {
            console.error('Cleanup error:', err);
            return;
        }

        console.log('Checking for expired files in:', videoDir);
        console.log('Number of files found:', files.length);

        const now = Date.now();
        files.forEach(file => {
            const filePath = path.join(videoDir, file);
            fs.stat(filePath, (statErr, stats) => {
                if (statErr) {
                    console.error('Error getting file stats:', statErr);
                    return;
                }
                // Delete files older than 15 minutes
                if (now - stats.mtimeMs > FILE_EXPIRY) {
                    fs.unlink(filePath, err => {
                        if (err) console.error('Error deleting old file:', err);
                        else console.log('Successfully deleted expired file:', filePath);
                    });
                }
            });
        });
    });
}, CLEANUP_INTERVAL);

const generateSyntaxVideo = async (req, res) => {
    console.log('Starting video generation with parameters:', {
        language: req.body.language,
        typingSpeed: req.body.typingSpeed,
        theme: req.body.theme,
        frameRate: req.body.frameRate
    });

    // Create a temporary directory for videos if it doesn't exist
    const { code, language, typingSpeed, theme, frameRate, selectedBackground } = req.body;
    const framesDir = path.join(__dirname, 'syntax-frames');

    if (frameRate > 30) {
        frameRate = 30;
    }

    // Ensure directories exist with proper permissions
    [framesDir, videoDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
            console.log('Created directory:', dir);
        }
    });

    const videoId = Date.now().toString();
    const outputPath = path.join(videoDir, `${videoId}.mp4`);
    console.log('Video will be saved to:', outputPath);

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

    try {
        console.log('Starting video generation process...');
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
        const framesPerChar = Math.max(1, Math.floor(typingSpeed / 100));
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
            console.log(`Generating frames ${currentFrameIndex} to ${currentFrameIndex + framesPerChar - 1} for character ${i + 1}/${tokens.length}`);

            for (let j = 0; j < framesPerChar; j++) {
                const framePath = `${framesDir}/frame_${String(frameIndex).padStart(4, '0')}.jpg`;
                framePromises.push(
                    page.screenshot({ 
                        path: framePath,
                        quality: 80,
                        type: 'jpeg'
                    }).then(() => {
                        // Verify frame was created
                        if (fs.existsSync(framePath)) {
                            const stats = fs.statSync(framePath);
                            console.log(`Frame ${frameIndex} created: ${stats.size} bytes`);
                        } else {
                            console.error(`Failed to create frame ${frameIndex}`);
                        }
                    })
                );
                frameIndex++;
            }
            await Promise.all(framePromises);
        }

        // Add final frames with cursor
        const finalFrames = [];
        console.log('Generating final frames');
        for (let i = 0; i < 10; i++) {
            const framePath = `${framesDir}/frame_${String(frameIndex).padStart(4, '0')}.jpg`;
            finalFrames.push(
                page.screenshot({ 
                    path: framePath,
                    quality: 80,
                    type: 'jpeg'
                }).then(() => {
                    if (fs.existsSync(framePath)) {
                        const stats = fs.statSync(framePath);
                        console.log(`Final frame ${frameIndex} created: ${stats.size} bytes`);
                    } else {
                        console.error(`Failed to create final frame ${frameIndex}`);
                    }
                })
            );
            frameIndex++;
        }
        await Promise.all(finalFrames);

        // Verify frames before FFmpeg
        const framesBeforeFFmpeg = fs.readdirSync(framesDir);
        console.log(`Total frames before FFmpeg: ${framesBeforeFFmpeg.length}`);
        console.log('Frame sizes:', framesBeforeFFmpeg.map(frame => {
            const stats = fs.statSync(path.join(framesDir, frame));
            return `${frame}: ${stats.size} bytes`;
        }).join('\n'));

        console.log('Starting FFmpeg process...');
        // Optimized FFmpeg settings
        await new Promise((resolve, reject) => {
            // First verify frames exist
            const frames = fs.readdirSync(framesDir);
            if (frames.length === 0) {
                reject(new Error('No frames found in frames directory'));
                return;
            }

            console.log(`Found ${frames.length} frames to process`);
            const firstFrame = path.join(framesDir, frames[0]);
            if (!fs.existsSync(firstFrame)) {
                reject(new Error('First frame does not exist'));
                return;
            }

            const frameStats = fs.statSync(firstFrame);
            console.log(`First frame size: ${frameStats.size} bytes`);

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

            // Log all FFmpeg events
            command.on('start', (commandLine) => {
                console.log('FFmpeg command:', commandLine);
            });

            command.on('progress', (progress) => {
                console.log('FFmpeg progress:', progress);
            });

            command.on('stderr', (stderrLine) => {
                console.log('FFmpeg stderr:', stderrLine);
            });

            command.on('error', (err, stdout, stderr) => {
                console.error('FFmpeg error:', err);
                console.error('FFmpeg stdout:', stdout);
                console.error('FFmpeg stderr:', stderr);
                reject(err);
            });

            command.on('end', async () => {
                console.log('FFmpeg process completed successfully.');
                
                // Verify the output video immediately
                try {
                    const stats = fs.statSync(outputPath);
                    console.log('Output video stats:', {
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime
                    });

                    if (stats.size < 1000) {
                        reject(new Error(`Video file too small: ${stats.size} bytes`));
                        return;
                    }

                    // Try to probe the video
                    const metadata = await new Promise((resolveProbe, rejectProbe) => {
                        ffmpeg.ffprobe(outputPath, (err, metadata) => {
                            if (err) {
                                console.error('FFprobe error:', err);
                                rejectProbe(err);
                                return;
                            }
                            resolveProbe(metadata);
                        });
                    });

                    console.log('Video metadata:', JSON.stringify(metadata.streams[0], null, 2));
                    resolve();
                } catch (error) {
                    console.error('Error verifying output video:', error);
                    reject(error);
                }
            });

            // Start the FFmpeg process
            command.save(outputPath);
        });

        // Final verification
        if (!fs.existsSync(outputPath)) {
            throw new Error('Video file was not created');
        }

        const videoStats = fs.statSync(outputPath);
        console.log('Final video stats:', {
            path: outputPath,
            size: videoStats.size,
            created: videoStats.birthtime,
            modified: videoStats.mtime
        });
        
        if (videoStats.size < 1000) { 
            throw new Error('Generated video file is too small, likely corrupted');
        }

        try {
            const probe = await new Promise((resolve, reject) => {
                ffmpeg.ffprobe(outputPath, (err, metadata) => {
                    if (err) {
                        console.error('FFprobe error:', err);
                        reject(err);
                        return;
                    }
                    resolve(metadata);
                });
            });
            console.log('Video metadata:', JSON.stringify(probe.streams[0], null, 2));
        } catch (error) {
            console.error('Error probing video file:', error);
        }

        const downloadLink = `/api/download-video/${videoId}`;	
        res.json({
            downloadLink,
            message: 'Video generated successfully',
            expirein: '24h'
        });

    } catch (error) {
        console.error('Error during video generation:', error);
        res.status(500).send('Error generating syntax highlighted video');
    } finally {
        // Only delete frames directory if it exists
        if (fs.existsSync(framesDir)) {
            try {
                fs.rmSync(framesDir, { recursive: true, force: true });
                console.log('Frames directory cleaned up successfully');
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
        console.log('Video path:', videoPath);

        if (!fs.existsSync(videoPath)) {
            console.error('Video file not found:', videoPath);
            return res.status(404).json({ error: 'Video not found' });
        }

        const stat = fs.statSync(videoPath);
        console.log('Video file stats:', {
            size: stat.size,
            created: stat.birthtime,
            modified: stat.mtime
        });

        if (stat.size < 1000) {
            console.error('Video file is too small:', stat.size);
            return res.status(500).json({ error: 'Video file appears to be corrupted' });
        }

        // Redirect to the static file URL
        const staticVideoUrl = `/temp_videos/${videoId}.mp4`;
        res.json({ downloadUrl: staticVideoUrl });
    } catch (error) {
        console.error('Error in downloadVideo:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const streamVideo = (req, res) => {
    console.log('Stream video function called');
    console.log('Request params:', req.params);
    const { videoId } = req.params;
    const videoPath = path.join(videoDir, `${videoId}.mp4`);
    console.log('Attempting to stream video:');
    console.log('Video ID:', videoId);
    console.log('Video Path:', videoPath);
    
    if (!fs.existsSync(videoPath)) {
        console.error('Video not found:', videoPath);
        return res.status(404).send('Video not found');
    }

    const stat = fs.statSync(videoPath);
    console.log('Video file size:', stat.size, 'bytes');
    const range = req.headers.range;

    try {
        if (range) {
            console.log('Range header present:', range);
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size-1;
            const chunksize = (end-start)+1;
            
            if (start >= stat.size) {
                res.status(416).send('Requested range not satisfiable');
                return;
            }

            console.log(`Streaming bytes ${start}-${end} of ${stat.size}`);
            const file = fs.createReadStream(videoPath, {start, end});
            const head = {
                'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4',
                'Cache-Control': 'no-cache'
            };
            
            console.log('Response headers:', head);
            res.writeHead(206, head);
            
            file.on('error', (error) => {
                console.error('Error streaming video:', error);
                if (!res.headersSent) {
                    res.status(500).send('Error streaming video');
                }
                res.end();
            });

            file.on('end', () => {
                console.log('Stream ended successfully');
            });

            file.pipe(res);
        } else {
            console.log('No range header, streaming entire video');
            const head = {
                'Content-Length': stat.size,
                'Content-Type': 'video/mp4',
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'no-cache'
            };
            
            console.log('Response headers:', head);
            res.writeHead(200, head);
            
            const file = fs.createReadStream(videoPath);
            
            file.on('error', (error) => {
                console.error('Error streaming video:', error);
                if (!res.headersSent) {
                    res.status(500).send('Error streaming video');
                }
                res.end();
            });

            file.on('end', () => {
                console.log('Stream ended successfully');
            });

            file.pipe(res);
        }
    } catch (error) {
        console.error('Unexpected error in stream video:', error);
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

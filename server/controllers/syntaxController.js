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
}

// Global cleanup interval
setInterval(() => {
    if (!fs.existsSync(videoDir)) return;
    
    fs.readdir(videoDir, (err, files) => {
        if (err) {
            console.error('Cleanup error:', err);
            return;
        }

        const now = Date.now();
        files.forEach(file => {
            const filePath = path.join(videoDir, file);
            fs.stat(filePath, (statErr, stats) => {
                if (statErr) return;
                // Delete files older than 15 minutes
                if (now - stats.mtimeMs > 1 * 60 * 1000) {
                    fs.unlink(filePath, err => {
                        if (err) console.error('Error deleting old file:', err);
                    });
                }
            });
        });
    });
}, 1 * 60 * 1000);

const generateSyntaxVideo = async (req, res) => {
    // Create a temporary directory for videos if it doesn't exist
    const { code, language, typingSpeed, theme, frameRate, selectedBackground } = req.body;
    const framesDir = path.join(__dirname, 'syntax-frames');

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

    if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir);

    try {
        // Reuse browser instance between requests
        if (!global.browser) {
            global.browser = await puppeteer.launch({
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
                defaultViewport: {
                    width: 1920,
                    height: 1080,
                    deviceScaleFactor: 2,
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
            for (let j = 0; j < framesPerChar; j++) {
                framePromises.push(
                    page.screenshot({ 
                        path: `${framesDir}/frame_${String(frameIndex).padStart(4, '0')}.jpg`,
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
            finalFrames.push(
                page.screenshot({ 
                    path: `${framesDir}/frame_${String(frameIndex).padStart(4, '0')}.jpg`,
                    quality: 80,
                    type: 'jpeg'
                })
            );
            frameIndex++;
        }
        await Promise.all(finalFrames);

        await page.close();

        // Optimized FFmpeg settings
        await new Promise((resolve, reject) => {
            ffmpeg()
                .addInput(`${framesDir}/frame_%04d.jpg`)
                .inputFPS(frameRate)
                .outputOptions([
                    '-c:v libx264',
                    '-preset ultrafast',
                    '-crf 23',
                    '-pix_fmt yuv420p',
                    '-movflags +faststart',
                    '-threads 0'
                ])
                .save(outputPath)
                .on('end', resolve)
                .on('error', reject);
        });
        const downloadLink = `/api/videos/${videoId}`;	
        res.json(
            {
                downloadLink,
                message : 'Video generated successfully',
                expirein: '24h'
            }
        )

        
    } catch (error) {
        console.error(error);
        res.status(500).send('Error generating syntax highlighted video');
    } finally {
        fs.rmSync(framesDir, { recursive: true, force: true });
    }
};

// Fix typo in function name
const downloadVideo = (req, res) => {
    const { videoId } = req.params;
    const videoPath = path.join(videoDir, `${videoId}.mp4`);
    
    if (!fs.existsSync(videoPath)) {
        return res.status(404).send('Video not found');
    }
    
    res.download(videoPath, 'code-animation.mp4', (err) => {
        if (err) {
            console.error('Download error:', err);
            return res.status(500).send('Error downloading file');
        }
        // Ensure video is deleted after download completes
        setTimeout(() => {
            fs.unlink(videoPath, (unlinkErr) => {
                if (unlinkErr && fs.existsSync(videoPath)) {
                    console.error('Error deleting file:', unlinkErr);
                }
            });
        }, 1000); // Small delay to ensure download completes
    });
};

module.exports = {
    generateSyntaxVideo,
    downloadVideo // Update export name
};

const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const prism = require('prismjs');
const loadLanguages = require('prismjs/components/');
loadLanguages(['javascript', 'python', 'html', 'css']); // Load needed languages


const app = express();
app.use(cors({
    origin: 'http://localhost:5173', // Assuming your client runs on Vite's default port
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());
app.post('/generate-syntax-video', async (req, res) => {
    const { code, language, typingSpeed = 50, theme, frameRate } = req.body;
    const framesDir = path.join(__dirname, 'syntax-frames');
    const outputPath = path.join(__dirname, 'syntax-output.mp4');

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
                        background: ${theme === 'solarizedlight' ? '#fdf6e3' : 'rgb(0, 0, 0)'};
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
                        border-right: 3px solid ${theme === 'solarizedlight' ? '#000' : '#fff'};
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

        res.sendFile(outputPath);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error generating syntax highlighted video');
    } finally {
        fs.rmSync(framesDir, { recursive: true, force: true });
    }
});


















app.post('/generate-video', async (req, res) => {
  const { code, language,theme, typingSpeed = 50 } = req.body; // Typing speed in ms
  const framesDir = path.join(__dirname, 'frames');
  const outputPath = path.join(__dirname, 'output.mp4');

  // Ensure frames directory exists
  if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir);

  try {
    // Launch Puppeteer
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Set up page with desired HTML and styles
    await page.setContent(`
        <html>
        <head>
          <style>
            body { 
              background: ${theme === 'dracula' ? '#282a36' : '#ffffff'};
              color: ${theme === 'dracula' ? '#f8f8f2' : '#000000'};
              font-family: 'monospace'; 
              font-size: 16px;
            }
            /* Add more styles for other themes */
          </style>
        </head>
        <body>
          <pre id="code"></pre>
          <script>
            const code = \`${code}\`.split('');
            let i = 0;
            function typeCode() {
              if (i < code.length) {
                document.getElementById('code').textContent += code[i];
                i++;
                setTimeout(typeCode, ${typingSpeed});
              }
            }
            typeCode();
          </script>
        </body>
        </html>
      `);

    // Capture frames for each "state" of the typing
    let frameIndex = 0;
    for (let i = 0; i <= code.length; i++) {
      await page.evaluate((index) => {
        document.getElementById('code').textContent = code.slice(0, index).join('');
      }, i);
      await page.screenshot({ path: `${framesDir}/frame_${String(frameIndex).padStart(4, '0')}.png` });
      frameIndex++;
    }

    await browser.close();

    // Generate video with FFmpeg
    await new Promise((resolve, reject) => {
      ffmpeg()
        .addInput(`${framesDir}/frame_%04d.png`)
        .inputFPS(30)
        .outputOptions('-pix_fmt yuv420p')
        .save(outputPath)
        .on('end', resolve)
        .on('error', reject);
    });

    // Send video to the user
    res.sendFile(outputPath);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating video');
  } finally {
    // Cleanup
    fs.rmSync(framesDir, { recursive: true, force: true });
  }
});




const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

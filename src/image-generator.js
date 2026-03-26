const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadImage(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} downloading image`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Generates an image via DALL-E 3 and saves the raw PNG to disk.
 *
 * @param {string} prompt        - The full DALL-E prompt
 * @param {object} generation    - { size, quality, style } from the template
 * @param {string} outputPrefix  - Filename prefix for the saved raw image
 * @returns {{ rawPath, revisedPrompt }}
 */
async function generateImage(prompt, generation, outputPrefix) {
  ensureOutputDir();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const openai = new OpenAI({ apiKey });
  const { size, quality, style } = generation;

  console.log('🎨 Calling DALL-E 3 API...');
  console.log(`   Size: ${size} | Quality: ${quality} | Style: ${style}`);

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size,
    quality,
    style,
    response_format: 'url',
  });

  const imageUrl = response.data[0].url;
  const revisedPrompt = response.data[0].revised_prompt;

  console.log('✅ Image generated successfully');
  if (revisedPrompt) {
    console.log(`   Revised prompt: ${revisedPrompt.substring(0, 120)}...`);
  }

  console.log('💾 Downloading raw image...');
  const imageBuffer = await downloadImage(imageUrl);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const rawFilename = `${outputPrefix}_${timestamp}_raw.png`;
  const rawPath = path.join(OUTPUT_DIR, rawFilename);

  fs.writeFileSync(rawPath, imageBuffer);
  console.log(`   Saved: ${rawPath}`);

  return { rawPath, timestamp, revisedPrompt };
}

module.exports = { generateImage };

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const DIMENSIONS = {
  landscape: { width: 1792, height: 1024 },
  square:    { width: 1024, height: 1024 },
};

/**
 * Renders a final image by loading an HTML template in Puppeteer,
 * injecting the background image and overlay text, then taking a screenshot.
 *
 * @param {string} imagePath   - Absolute path to the raw DALL-E image (PNG)
 * @param {string} text        - Overlay text (newlines as \n)
 * @param {string} templatePath - Absolute path to the HTML template file
 * @param {string} format      - 'landscape' | 'square'
 * @returns {{ buffer: Buffer, extension: string }}
 */
async function renderHtmlTemplate(imagePath, text, templatePath, format) {
  const { width, height } = DIMENSIONS[format] || DIMENSIONS.landscape;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });

    // Load template via file:// so relative assets and fonts can resolve
    await page.goto(`file://${templatePath}`, { waitUntil: 'networkidle2', timeout: 15000 });

    // Inject background image as base64 data URL to avoid file:// cross-origin issues
    const imageData = fs.readFileSync(imagePath);
    const base64 = imageData.toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;

    await page.evaluate((url) => {
      document.body.style.backgroundImage = `url('${url}')`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
    }, dataUrl);

    // Inject text into #text-block
    const lines = text.split('\n');
    await page.evaluate((lines) => {
      const block = document.getElementById('text-block');
      if (!block) return;
      block.innerHTML = lines
        .map((line) => {
          const escaped = line
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
          return `<p>${escaped}</p>`;
        })
        .join('');
    }, lines);

    const screenshot = await page.screenshot({
      type: 'jpeg',
      quality: 92,
      clip: { x: 0, y: 0, width, height },
    });

    return { buffer: screenshot, extension: 'jpg' };
  } finally {
    await browser.close();
  }
}

module.exports = { renderHtmlTemplate, DIMENSIONS };

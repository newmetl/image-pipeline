#!/usr/bin/env node

/**
 * Preview server for HTML templates.
 *
 * All parameters are controlled via URL query strings – no server restart needed.
 *
 * Usage:
 *   node preview.js
 *
 * Then open in browser:
 *   http://localhost:3456/?style=A&format=landscape&text=Hello%0AWorld
 *
 * Query parameters:
 *   style  – A or B                          (default: A)
 *   format – landscape or square             (default: landscape)
 *   text   – overlay text, use %0A for \n    (default: template placeholder)
 *   image  – filename of a raw image in output/ to use as background
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const TEMPLATES_DIR = path.join(__dirname, 'templates');
const OUTPUT_DIR    = path.join(__dirname, 'output');
const PORT          = 3456;

const DIMENSIONS = {
  landscape: { width: 1792, height: 1024 },
  square:    { width: 1024, height: 1024 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseQuery(reqUrl) {
  const parsed = url.parse(reqUrl, true);
  const query = parsed.query;
  const style  = ['A', 'B'].includes((query.style || '').toUpperCase())
    ? (query.style || 'A').toUpperCase()
    : 'A';
  const format = ['landscape', 'square'].includes((query.format || '').toLowerCase())
    ? (query.format || 'landscape').toLowerCase()
    : 'landscape';
  const text   = query.text !== undefined ? query.text.replace(/\\n/g, '\n') : null;
  const image  = query.image || null;
  return { pathname: parsed.pathname, style, format, text, image };
}

function getLatestRawImage(style, format) {
  if (!fs.existsSync(OUTPUT_DIR)) return null;
  const prefix = `style-${style.toLowerCase()}-${format}`;
  const files = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.startsWith(prefix) && f.endsWith('_raw.png'))
    .sort()
    .reverse();
  return files.length ? path.join(OUTPUT_DIR, files[0]) : null;
}

function getDummyImage() {
  const dummy = path.join(OUTPUT_DIR, 'dummy-background.png');
  return fs.existsSync(dummy) ? dummy : null;
}

function imageToDataUrl(imagePath) {
  const data = fs.readFileSync(imagePath);
  const ext  = path.extname(imagePath).slice(1).replace('jpg', 'jpeg');
  return `data:image/${ext};base64,${data.toString('base64')}`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function resolveImage(style, format, imageName) {
  let imagePath = null;
  if (imageName) {
    const candidate = path.join(OUTPUT_DIR, imageName);
    if (fs.existsSync(candidate)) imagePath = candidate;
  }
  if (!imagePath) imagePath = getLatestRawImage(style, format);
  if (!imagePath) imagePath = getDummyImage();
  return imagePath;
}

// ── Serve the template HTML (loaded in iframe) ───────────────────────────────

function serveTemplate(res, style, format, text, imageName) {
  const templateFile = `style-${style.toLowerCase()}-${format}.html`;
  const templatePath = path.join(TEMPLATES_DIR, templateFile);

  if (!fs.existsSync(templatePath)) {
    res.writeHead(404);
    res.end(`Template not found: ${templateFile}`);
    return;
  }

  const imagePath = resolveImage(style, format, imageName);
  let dataUrl = '';
  if (imagePath && fs.existsSync(imagePath)) {
    dataUrl = imageToDataUrl(imagePath);
  }

  let html = fs.readFileSync(templatePath, 'utf-8');

  // Build text injection
  const lines = text ? text.split('\n') : null;
  const textHtml = lines
    ? lines.map(l => `<p>${escapeHtml(l)}</p>`).join('')
    : null;

  const injection = `
<style>
  /* ── Preview injection ── */
  ${dataUrl ? `body { background-image: url('${dataUrl}') !important; }` : ''}
</style>
${textHtml ? `<script>
  document.addEventListener('DOMContentLoaded', function() {
    var block = document.getElementById('text-block');
    if (block) block.innerHTML = ${JSON.stringify(textHtml)};
  });
</script>` : ''}`;

  html = html.replace('</head>', `${injection}\n</head>`);

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

// ── Serve the wrapper page (toolbar + iframe) ────────────────────────────────

function serveWrapper(res, style, format, text, imageName) {
  const templateFile = `style-${style.toLowerCase()}-${format}.html`;
  const { width, height } = DIMENSIONS[format] || DIMENSIONS.landscape;

  const imagePath = resolveImage(style, format, imageName);
  const imageInfo = imagePath ? path.basename(imagePath) : 'CSS gradient fallback';

  // For the text input, show \n as literal text
  const inputText = text ? text.replace(/\n/g, '\\n') : '';
  const encodedText = encodeURIComponent(text || '');

  // Build the iframe src
  const iframeSrc = `/template?style=${style}&amp;format=${format}${text !== null ? `&amp;text=${encodeURIComponent(text).replace(/'/g, '%27')}` : ''}${imageName ? `&amp;image=${encodeURIComponent(imageName)}` : ''}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Image Pipeline – Preview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: #1a1a1a;
      color: #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-height: 100vh;
    }

    .toolbar {
      background: #252525;
      border-bottom: 1px solid #333;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      gap: 24px;
      flex-wrap: wrap;
      position: sticky;
      top: 0;
      z-index: 1000;
    }

    .toolbar-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .toolbar-group label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #888;
      white-space: nowrap;
    }

    .btn {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      color: #ccc;
      background: #333;
      border: 1px solid #444;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn:hover { background: #3a3a3a; color: #fff; }
    .btn.active {
      background: #4a7cff;
      color: #fff;
      border-color: #4a7cff;
    }

    .text-input {
      background: #333;
      border: 1px solid #444;
      color: #e0e0e0;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 13px;
      font-family: inherit;
      width: 320px;
    }
    .text-input:focus { outline: none; border-color: #4a7cff; }

    .apply-btn {
      background: #4a7cff;
      color: #fff;
      border-color: #4a7cff;
    }
    .apply-btn:hover { background: #5a8aff; }

    .info {
      margin-left: auto;
      font-size: 11px;
      color: #666;
    }

    .canvas-area {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 32px;
    }

    .canvas-wrapper {
      /* This wrapper shrinks to the scaled visual size */
      overflow: hidden;
    }

    .template-frame {
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      overflow: hidden;
      width: ${width}px;
      height: ${height}px;
      transform-origin: top left;
    }

    .template-frame iframe {
      display: block;
      border: none;
      width: ${width}px;
      height: ${height}px;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-group">
      <label>Style</label>
      <a class="btn ${style === 'A' ? 'active' : ''}" href="/?style=A&format=${format}&text=${encodedText}">A – Tech</a>
      <a class="btn ${style === 'B' ? 'active' : ''}" href="/?style=B&format=${format}&text=${encodedText}">B – Cinematic</a>
    </div>

    <div class="toolbar-group">
      <label>Format</label>
      <a class="btn ${format === 'landscape' ? 'active' : ''}" href="/?style=${style}&format=landscape&text=${encodedText}">Landscape</a>
      <a class="btn ${format === 'square' ? 'active' : ''}" href="/?style=${style}&format=square&text=${encodedText}">Square</a>
    </div>

    <div class="toolbar-group">
      <label>Text</label>
      <input type="text" class="text-input" id="textInput"
             value="${escapeHtml(inputText)}"
             placeholder="Headline text (use \\n for line breaks)">
      <button class="btn apply-btn" onclick="applyText()">Apply</button>
    </div>

    <div class="info">
      ${escapeHtml(templateFile)} &middot; ${width}&times;${height} &middot; bg: ${escapeHtml(imageInfo)}
    </div>
  </div>

  <div class="canvas-area">
    <div class="canvas-wrapper">
      <div class="template-frame">
        <iframe id="templateFrame" width="${width}" height="${height}" src="${iframeSrc}"></iframe>
      </div>
    </div>
  </div>

  <script>
    function applyText() {
      var raw = document.getElementById('textInput').value;
      var params = new URLSearchParams(window.location.search);
      params.set('style', '${style}');
      params.set('format', '${format}');
      params.set('text', raw.replace(/\\\\n/g, '\\n'));
      window.location.search = params.toString();
    }

    document.getElementById('textInput').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') applyText();
    });

    /* ─── Scale canvas to fit viewport ─── */
    (function() {
      var CANVAS_W = ${width};
      var CANVAS_H = ${height};
      var frame = document.querySelector('.template-frame');
      var wrapper = document.querySelector('.canvas-wrapper');

      function scaleCanvas() {
        var pad = 64;
        var availW = window.innerWidth - pad;
        var toolbar = document.querySelector('.toolbar');
        var availH = window.innerHeight - (toolbar ? toolbar.offsetHeight : 0) - pad;
        var scaleW = availW / CANVAS_W;
        var scaleH = availH / CANVAS_H;
        var scale = Math.min(scaleW, scaleH, 1); // never upscale
        frame.style.transform = 'scale(' + scale + ')';
        // Wrapper takes the scaled dimensions so layout flows correctly
        wrapper.style.width = Math.round(CANVAS_W * scale) + 'px';
        wrapper.style.height = Math.round(CANVAS_H * scale) + 'px';
      }

      scaleCanvas();
      window.addEventListener('resize', scaleCanvas);
    })();
  </script>
</body>
</html>`;

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

// ── Server ────────────────────────────────────────────────────────────────────

function start() {
  const server = http.createServer((req, res) => {
    const { pathname, style, format, text, image } = parseQuery(req.url);

    if (pathname === '/template') {
      serveTemplate(res, style, format, text, image);
      return;
    }

    if (pathname === '/') {
      console.log(`  [${new Date().toLocaleTimeString()}] style=${style} format=${format} text=${text ? '"' + text.replace(/\n/g, '\\n') + '"' : '(default)'}`);
      serveWrapper(res, style, format, text, image);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Image Pipeline – Preview Server');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log(`  http://localhost:${PORT}/`);
    console.log('');
    console.log('  URL parameters:');
    console.log('    style=A|B          format=landscape|square');
    console.log('    text=Hello%0AWorld image=filename.png');
    console.log('');
    console.log('  Examples:');
    console.log(`    http://localhost:${PORT}/?style=A&format=landscape`);
    console.log(`    http://localhost:${PORT}/?style=B&format=square&text=Hello%0AWorld`);
    console.log('');
    console.log('  Edit HTML templates and refresh to see changes.');
    console.log('  Press Ctrl+C to stop.');
    console.log('═══════════════════════════════════════════════════════');
  });
}

start();

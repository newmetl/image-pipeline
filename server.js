#!/usr/bin/env node

/**
 * Image Pipeline – HTTP API Server
 *
 * Exposes the image generation pipeline as a REST service
 * for use by OpenClaw or other containers over Docker networking.
 *
 * Endpoints:
 *   POST /generate   – Full pipeline: DALL-E image + HTML template render
 *   POST /render     – HTML template render only (bring your own image)
 *   GET  /health     – Health check
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const { loadTemplate } = require('./src/template-loader');
const { buildPrompt } = require('./src/prompt-builder');
const { generateImage } = require('./src/image-generator');
const { renderHtmlTemplate } = require('./src/html-renderer');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const OUTPUT_DIR = path.join(__dirname, 'output');

// ── Helpers ──────────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function jsonResponse(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function errorResponse(res, status, message) {
  jsonResponse(res, status, { error: message });
}

// ── POST /generate ───────────────────────────────────────────────────────────
// Full pipeline: generate DALL-E image, then render HTML template.
//
// Body (JSON):
//   topic  – image generation topic (required)
//   text   – overlay text, use \n for line breaks (required)
//   style  – "A" or "B" (required)
//   format – "landscape" or "square" (required)
//
// Response (JSON):
//   image     – base64-encoded final JPEG
//   filename  – suggested filename
//   rawImage  – base64-encoded raw DALL-E PNG (optional, if includeRaw=true)

async function handleGenerate(req, res) {
  const body = JSON.parse((await readBody(req)).toString('utf-8'));

  const { topic, text, style, format, includeRaw } = body;
  if (!topic) return errorResponse(res, 400, 'Missing required field: topic');
  if (!text) return errorResponse(res, 400, 'Missing required field: text');
  if (!style || !['A', 'B'].includes(style.toUpperCase())) {
    return errorResponse(res, 400, 'style must be "A" or "B"');
  }
  if (!format || !['landscape', 'square'].includes(format.toLowerCase())) {
    return errorResponse(res, 400, 'format must be "landscape" or "square"');
  }

  const styleKey = style.toUpperCase();
  const formatKey = format.toLowerCase();
  const displayText = text.replace(/\\n/g, '\n');

  console.log(`[generate] style=${styleKey} format=${formatKey} topic="${topic}"`);

  // Step 1: Load template
  const template = loadTemplate(styleKey, formatKey);

  // Step 2: Build prompt
  const prompt = buildPrompt(template, topic);

  // Step 3: Generate image via DALL-E
  const prefix = `style-${styleKey.toLowerCase()}-${formatKey}`;
  const { rawPath, timestamp } = await generateImage(prompt, template.generation, prefix);

  // Step 4: Render HTML template
  const result = await renderHtmlTemplate(rawPath, displayText, template.htmlTemplatePath, formatKey);

  // Save final image
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const finalFilename = `style-${styleKey.toLowerCase()}-${formatKey}_${timestamp}_final.${result.extension}`;
  const finalPath = path.join(OUTPUT_DIR, finalFilename);
  fs.writeFileSync(finalPath, result.buffer);

  const response = {
    image: result.buffer.toString('base64'),
    filename: finalFilename,
    extension: result.extension,
  };

  if (includeRaw && fs.existsSync(rawPath)) {
    response.rawImage = fs.readFileSync(rawPath).toString('base64');
  }

  console.log(`[generate] done → ${finalFilename}`);
  jsonResponse(res, 200, response);
}

// ── POST /render ─────────────────────────────────────────────────────────────
// Render HTML template only (no DALL-E call). Provide your own background image.
//
// Body (JSON):
//   image  – base64-encoded background image (required)
//   text   – overlay text (required)
//   style  – "A" or "B" (required)
//   format – "landscape" or "square" (required)
//
// Response (JSON):
//   image    – base64-encoded final JPEG
//   filename – suggested filename

async function handleRender(req, res) {
  const body = JSON.parse((await readBody(req)).toString('utf-8'));

  const { image, text, style, format } = body;
  if (!image) return errorResponse(res, 400, 'Missing required field: image (base64)');
  if (!text) return errorResponse(res, 400, 'Missing required field: text');
  if (!style || !['A', 'B'].includes(style.toUpperCase())) {
    return errorResponse(res, 400, 'style must be "A" or "B"');
  }
  if (!format || !['landscape', 'square'].includes(format.toLowerCase())) {
    return errorResponse(res, 400, 'format must be "landscape" or "square"');
  }

  const styleKey = style.toUpperCase();
  const formatKey = format.toLowerCase();
  const displayText = text.replace(/\\n/g, '\n');

  console.log(`[render] style=${styleKey} format=${formatKey}`);

  // Write temporary image file
  const tmpPath = path.join(OUTPUT_DIR, `_tmp_render_${Date.now()}.png`);
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(tmpPath, Buffer.from(image, 'base64'));

  try {
    const template = loadTemplate(styleKey, formatKey);
    const result = await renderHtmlTemplate(tmpPath, displayText, template.htmlTemplatePath, formatKey);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `style-${styleKey.toLowerCase()}-${formatKey}_${timestamp}_final.${result.extension}`;

    jsonResponse(res, 200, {
      image: result.buffer.toString('base64'),
      filename,
      extension: result.extension,
    });
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }

  console.log(`[render] done`);
}

// ── Server ───────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      return jsonResponse(res, 200, { status: 'ok' });
    }

    if (req.method === 'POST' && req.url === '/generate') {
      return await handleGenerate(req, res);
    }

    if (req.method === 'POST' && req.url === '/render') {
      return await handleRender(req, res);
    }

    errorResponse(res, 404, 'Not found');
  } catch (err) {
    console.error('[error]', err.message);
    errorResponse(res, 500, err.message);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  Image Pipeline – API Server');
  console.log('═══════════════════════════════════════════');
  console.log(`  Listening on 0.0.0.0:${PORT}`);
  console.log('');
  console.log('  Endpoints:');
  console.log('    POST /generate  – Full pipeline (DALL-E + render)');
  console.log('    POST /render    – Render only (bring your own image)');
  console.log('    GET  /health    – Health check');
  console.log('═══════════════════════════════════════════');
});

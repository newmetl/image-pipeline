#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const { loadTemplate }      = require('./src/template-loader');
const { buildPrompt }       = require('./src/prompt-builder');
const { generateImage }     = require('./src/image-generator');
const { renderHtmlTemplate } = require('./src/html-renderer');

const OUTPUT_DIR = path.join(__dirname, 'output');

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--topic'  && args[i + 1]) parsed.topic  = args[++i];
    if (args[i] === '--text'   && args[i + 1]) parsed.text   = args[++i];
    if (args[i] === '--style'  && args[i + 1]) parsed.style  = args[++i].toUpperCase();
    if (args[i] === '--format' && args[i + 1]) parsed.format = args[++i].toLowerCase();
  }

  if (!parsed.topic)  throw new Error('Missing required argument: --topic');
  if (!parsed.text)   throw new Error('Missing required argument: --text');
  if (!parsed.style)  throw new Error('Missing required argument: --style (A or B)');
  if (!parsed.format) throw new Error('Missing required argument: --format (landscape or square)');

  if (!['A', 'B'].includes(parsed.style)) {
    throw new Error('--style must be A or B');
  }
  if (!['landscape', 'square'].includes(parsed.format)) {
    throw new Error('--format must be landscape or square');
  }

  return parsed;
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  Image Pipeline – Generate');
  console.log('═══════════════════════════════════════════\n');

  const { topic, text, style, format } = parseArgs();
  const displayText = text.replace(/\\n/g, '\n');

  console.log(`📋 Style:  ${style}`);
  console.log(`📋 Format: ${format}`);
  console.log(`📋 Topic:  ${topic}`);
  console.log(`📋 Text:   ${displayText.replace(/\n/g, ' / ')}`);
  console.log('');

  // Step 1: Load template
  console.log('📂 Step 1: Loading template...');
  const template = loadTemplate(style, format);
  console.log(`   Template: ${template.name} (${format})`);
  console.log('');

  // Step 2: Build prompt
  console.log('🔧 Step 2: Building prompt...');
  const prompt = buildPrompt(template, topic);
  console.log(`   Prompt: ${prompt.substring(0, 100)}...`);
  console.log('');

  // Step 3: Generate image via DALL-E 3
  console.log('🖼️  Step 3: Generating image via DALL-E 3...');
  const prefix = `style-${style.toLowerCase()}-${format}`;
  const { rawPath, timestamp } = await generateImage(prompt, template.generation, prefix);
  console.log('');

  // Step 4: Render HTML template
  console.log('✏️  Step 4: Rendering HTML template...');
  const result = await renderHtmlTemplate(rawPath, displayText, template.htmlTemplatePath, format);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const finalFilename = `style-${style.toLowerCase()}-${format}_${timestamp}_final.${result.extension}`;
  const finalPath = path.join(OUTPUT_DIR, finalFilename);
  fs.writeFileSync(finalPath, result.buffer);
  console.log(`   Saved: ${finalPath}`);
  console.log('');

  // Done
  console.log('═══════════════════════════════════════════');
  console.log('  ✅ Pipeline complete!');
  console.log(`  Raw image:   ${rawPath}`);
  console.log(`  Final image: ${finalPath}`);
  console.log('═══════════════════════════════════════════');

  return finalPath;
}

main().catch((err) => {
  console.error('\n❌ Pipeline error:', err.message);
  process.exit(1);
});

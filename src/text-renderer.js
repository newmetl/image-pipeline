const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const FONTS_DIR = path.join(__dirname, '..', 'fonts');

let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered) return;

  const fontFiles = [
    { file: 'OpenSans-Bold.ttf', family: 'Open Sans' },
    { file: 'SortsMillGoudy-Regular.ttf', family: 'Sorts Mill Goudy' },
  ];

  for (const f of fontFiles) {
    const fontPath = path.join(FONTS_DIR, f.file);
    if (fs.existsSync(fontPath)) {
      GlobalFonts.registerFromPath(fontPath, f.family);
      console.log(`   Font registered: ${f.family}`);
    } else {
      console.warn(`   ⚠️  Font not found: ${fontPath}`);
    }
  }

  fontsRegistered = true;
}

function calculateFontSize(text, layout, maxWidth, ctx) {
  const { min, max } = layout.fontSize;
  const fontWeight = layout._fontWeight || 'bold';
  const fontFamily = layout._fontFamily;

  for (let size = max; size >= min; size -= 2) {
    ctx.font = `${fontWeight} ${size}px "${fontFamily}"`;
    const lines = text.split('\n');
    const allFit = lines.every(line => ctx.measureText(line).width <= maxWidth);
    if (allFit) return size;
  }
  return min;
}

async function renderTextOverlay(imageBuffer, text, template) {
  registerFonts();

  // Get image dimensions via sharp
  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width;
  const height = meta.height;

  // Create transparent canvas for text overlay only
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const layout = template.layout;
  const fontFamily = template.font.family;
  const fontWeight = template.font.weight === 'Bold' ? 'bold' : 'normal';

  layout._fontFamily = fontFamily;
  layout._fontWeight = fontWeight;

  const maxWidth = (width * layout.maxWidthPercent) / 100;
  const padX = layout.padding.x;
  const padY = layout.padding.y;

  // Calculate font size
  const fontSize = calculateFontSize(text, layout, maxWidth, ctx);
  const lineHeightPx = fontSize * layout.lineHeight;

  ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}"`;
  ctx.textAlign = layout.alignment;
  ctx.textBaseline = 'top';

  const lines = text.split('\n');

  // Measure text block
  let textBlockWidth = 0;
  for (const line of lines) {
    const m = ctx.measureText(line);
    if (m.width > textBlockWidth) textBlockWidth = m.width;
  }
  const textBlockHeight = lines.length * lineHeightPx;

  // Calculate position
  let textX, textY;
  const pos = layout.position;

  if (pos === 'top-left') {
    textX = padX;
    textY = padY;
  } else if (pos === 'top-right') {
    textX = width - padX;
    textY = padY;
  } else if (pos === 'bottom-left') {
    textX = padX;
    textY = height - padY - textBlockHeight;
  } else if (pos === 'bottom-right') {
    textX = width - padX;
    textY = height - padY - textBlockHeight;
  } else if (pos === 'center') {
    textX = width / 2;
    textY = (height - textBlockHeight) / 2;
  } else {
    textX = padX;
    textY = padY;
  }

  // Draw overlay background
  if (layout.overlay && layout.overlay.enabled) {
    const ov = layout.overlay;
    const extraX = ov.extraPadding.x;
    const extraY = ov.extraPadding.y;

    let bgX, bgY, bgW, bgH;

    if (layout.alignment === 'left') {
      bgX = textX - extraX;
      bgY = textY - extraY;
      bgW = textBlockWidth + extraX * 2;
      bgH = textBlockHeight + extraY * 2;
    } else if (layout.alignment === 'right') {
      bgX = textX - textBlockWidth - extraX;
      bgY = textY - extraY;
      bgW = textBlockWidth + extraX * 2;
      bgH = textBlockHeight + extraY * 2;
    } else {
      bgX = textX - textBlockWidth / 2 - extraX;
      bgY = textY - extraY;
      bgW = textBlockWidth + extraX * 2;
      bgH = textBlockHeight + extraY * 2;
    }

    bgX = Math.max(0, bgX);
    bgY = Math.max(0, bgY);

    const gradDir = ov.gradientDirection || 'right';
    let grad;
    if (gradDir === 'right') {
      grad = ctx.createLinearGradient(bgX, bgY, bgX + bgW + 80, bgY);
    } else if (gradDir === 'left') {
      grad = ctx.createLinearGradient(bgX + bgW, bgY, bgX - 80, bgY);
    } else if (gradDir === 'down') {
      grad = ctx.createLinearGradient(bgX, bgY, bgX, bgY + bgH + 80);
    } else {
      grad = ctx.createLinearGradient(bgX, bgY, bgX + bgW, bgY);
    }

    grad.addColorStop(0, ov.color);
    grad.addColorStop(0.85, ov.color);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(bgX, bgY, bgW + 80, bgH);
  }

  // Draw text
  ctx.fillStyle = layout.textColor;
  ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}"`;
  ctx.textAlign = layout.alignment;
  ctx.textBaseline = 'top';

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], textX, textY + i * lineHeightPx);
  }

  // Export canvas as PNG (transparent overlay)
  const overlayBuffer = canvas.toBuffer('image/png');

  // Composite: base image + text overlay using sharp
  const finalBuffer = await sharp(imageBuffer)
    .composite([{ input: overlayBuffer, top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer();

  return { buffer: finalBuffer, extension: 'jpg' };
}

module.exports = { renderTextOverlay };

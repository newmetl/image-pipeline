const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const VALID_FORMATS = ['landscape', 'square'];

/**
 * Loads the JSON config (basePrompt, generation settings) for a given style,
 * and resolves the path to the matching HTML template.
 *
 * @param {string} style   - 'A' | 'B'
 * @param {string} format  - 'landscape' | 'square'
 * @returns {{ name, basePrompt, generation, htmlTemplatePath }}
 */
function loadTemplate(style, format) {
  const styleKey = style.toUpperCase();
  const formatKey = format.toLowerCase();

  if (!VALID_FORMATS.includes(formatKey)) {
    throw new Error(`Invalid format "${format}". Must be one of: ${VALID_FORMATS.join(', ')}`);
  }

  // Load JSON config
  const jsonFile = `style-${styleKey.toLowerCase()}.json`;
  const jsonPath = path.join(TEMPLATES_DIR, jsonFile);

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Template config not found for style "${style}": ${jsonPath}`);
  }

  const template = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  if (!template.basePrompt) throw new Error('Template missing required field: basePrompt');
  if (!template.generation) throw new Error('Template missing required field: generation');
  if (!template.generation[formatKey]) {
    throw new Error(`Template has no generation config for format "${formatKey}"`);
  }

  // Resolve HTML template path
  const htmlFile = `style-${styleKey.toLowerCase()}-${formatKey}.html`;
  const htmlTemplatePath = path.join(TEMPLATES_DIR, htmlFile);

  if (!fs.existsSync(htmlTemplatePath)) {
    throw new Error(`HTML template not found: ${htmlTemplatePath}`);
  }

  return {
    name: template.name,
    basePrompt: template.basePrompt,
    generation: template.generation[formatKey],
    htmlTemplatePath,
  };
}

module.exports = { loadTemplate };

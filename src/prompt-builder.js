/**
 * Builds a DALL-E prompt from the base style prompt and a topic.
 * NEVER includes any text/typography instructions — text is rendered separately.
 */

const NO_TEXT_SUFFIX = 'no text, no words, no letters, no typography, no writing, no captions, no labels';

function buildPrompt(template, topic) {
  if (!template || !template.basePrompt) {
    throw new Error('Template with basePrompt is required');
  }
  if (!topic || typeof topic !== 'string') {
    throw new Error('Topic string is required');
  }

  // Combine: base style prompt + topic as scene descriptor + no-text guard
  const prompt = `${template.basePrompt}, scene depicting: ${topic}, ${NO_TEXT_SUFFIX}`;

  return prompt;
}

module.exports = { buildPrompt };

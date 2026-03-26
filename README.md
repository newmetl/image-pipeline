# Image Pipeline

AI image generation pipeline with text overlay using DALL-E 3 and node-canvas.

## Setup

```bash
bash setup.sh
```

This installs dependencies and downloads required Google Fonts.

## Usage

```bash
node generate.js --topic "Your topic" --text "Your overlay text" --style A
```

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `--topic` | Yes | Scene descriptor for image generation |
| `--text`  | Yes | Text to overlay on the image (use `\n` for line breaks) |
| `--style` | Yes | `A` (tech/futuristic) or `B` (cinematic/atmospheric) |

### Styles

- **Style A**: Futuristic/tech aesthetic with Open Sans Bold
- **Style B**: Cinematic/atmospheric with Sorts Mill Goudy

### Examples

```bash
# Tech/futuristic style
node generate.js --topic "Websites als Datenquellen für KI" --text "Deine Website hat bald\nnur noch einen Besucher." --style A

# Cinematic/atmospheric style
node generate.js --topic "Innere Stille jenseits aller Konzepte" --text "Was bleibt, wenn\ndu aufhörst zu suchen?" --style B
```

## Architecture

```
Input (topic + text + style)
  → Template Loader (loads style config)
  → Prompt Builder (base prompt + topic, NO text)
  → DALL-E 3 API (generates raw image)
  → Text Renderer (overlays text via node-canvas)
  → Final Image (saved to output/)
```

## Project Structure

```
image-pipeline/
├── generate.js          # Main pipeline entry
├── setup.sh             # Setup script
├── src/
│   ├── prompt-builder.js
│   ├── image-generator.js
│   ├── text-renderer.js
│   └── template-loader.js
├── templates/
│   ├── style-a.json
│   └── style-b.json
├── fonts/               # Google Fonts (downloaded by setup)
├── output/              # Generated images
└── README.md
```

## Requirements

- Node.js 18+
- `OPENAI_API_KEY` environment variable

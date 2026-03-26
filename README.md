# Image Pipeline

HTML-template-based image generation pipeline for social media content.
Generates background images via DALL-E 3, then renders text overlays using
customizable HTML/CSS templates and Puppeteer.

## Setup

```bash
bash setup.sh
```

This installs npm dependencies (puppeteer, sharp, openai) and downloads the
required Google Fonts (Open Sans Bold, Sorts Mill Goudy).

## Quick Start

### 1. Preview & Design Templates

Start the preview server to iterate on templates in the browser:

```bash
node preview.js
```

Then open http://localhost:3456 and use URL parameters to test:

```
http://localhost:3456/?style=A&format=landscape&text=Hello%0AWorld
```

| Parameter | Values                  | Default     |
|-----------|-------------------------|-------------|
| `style`   | `A` or `B`              | `A`         |
| `format`  | `landscape` or `square` | `landscape` |
| `text`    | Any text, `%0A` = newline | template default |
| `image`   | Filename from `output/` | auto-detect |

The preview includes a toolbar for switching styles/formats and entering text.
The canvas scales to fit your viewport (this scaling only applies to the
preview, not to the generated images).

### 2. Generate Images

```bash
node generate.js --topic "Your topic" --text "Your overlay text" --style A --format landscape
```

| Parameter  | Required | Description                                         |
|------------|----------|-----------------------------------------------------|
| `--topic`  | Yes      | Scene descriptor for DALL-E image generation         |
| `--text`   | Yes      | Text overlay (use `\n` for line breaks)              |
| `--style`  | Yes      | `A` (tech/futuristic) or `B` (cinematic/atmospheric) |
| `--format` | Yes      | `landscape` (1792x1024) or `square` (1024x1024)      |

### Examples

```bash
# Style A – Tech, landscape
node generate.js \
  --topic "Websites als Datenquellen fuer KI" \
  --text "Deine Website hat bald\nnur noch einen Besucher." \
  --style A --format landscape

# Style B – Cinematic, square
node generate.js \
  --topic "Innere Stille jenseits aller Konzepte" \
  --text "Was bleibt, wenn\ndu aufhoerst zu suchen?" \
  --style B --format square
```

## Styles

| Style | Aesthetic              | Font                   |
|-------|------------------------|------------------------|
| **A** | Futuristic / Tech      | Open Sans Bold (sans)  |
| **B** | Cinematic / Atmospheric | Sorts Mill Goudy (serif) |

Each style has a JSON config (`templates/style-{a,b}.json`) with the DALL-E
base prompt and generation settings, plus HTML templates for each format.

## Architecture

```
Input (topic + text + style + format)
  -> Template Loader     loads style JSON config + resolves HTML template
  -> Prompt Builder      base prompt + topic, NO text in prompt
  -> DALL-E 3 API        generates raw background image
  -> HTML Renderer       Puppeteer loads HTML template, injects background
                         image + text, screenshots at exact canvas size
  -> Final Image         saved to output/
```

### Text Scaling

The HTML templates include a scale-to-fit script that automatically adjusts
font size so that:
- Short text scales **up** to fill at least ~50% of the canvas
- Long text scales **down** to fit within the canvas
- Margins to all edges are always preserved (90% of available area)

## Project Structure

```
image-pipeline/
├── generate.js              # Main pipeline entry point
├── preview.js               # Preview server for template design
├── setup.sh                 # Setup script (npm install + fonts)
├── package.json
├── src/
│   ├── template-loader.js   # Loads JSON config + resolves HTML template
│   ├── prompt-builder.js    # Builds DALL-E prompt (topic, no text)
│   ├── image-generator.js   # DALL-E 3 API call + download
│   └── html-renderer.js     # Puppeteer-based HTML -> image renderer
├── templates/
│   ├── style-a.json         # Style A config (prompt + generation settings)
│   ├── style-b.json         # Style B config
│   ├── style-a-landscape.html
│   ├── style-a-square.html
│   ├── style-b-landscape.html
│   └── style-b-square.html
├── fonts/                   # Google Fonts (downloaded by setup.sh)
└── output/                  # Generated images (gitignored)
```

## Customizing Templates

Edit the HTML files in `templates/` directly. Each template is a self-contained
HTML page with:
- CSS styling (fonts, colors, layout, gradient overlay)
- A `#text-block` div where overlay text is injected
- A scale-to-fit `<script>` that auto-sizes the font

Use the preview server (`node preview.js`) to see changes in real-time:
reload the browser after editing a template file.

## Requirements

- Node.js 18+
- `OPENAI_API_KEY` environment variable (for image generation)
- Chromium (bundled with puppeteer)

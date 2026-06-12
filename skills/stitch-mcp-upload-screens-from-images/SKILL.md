---
name: stitch-mcp-upload-screens-from-images
description: Uploads screenshots or mockup images into a Stitch project as new screens. Enables the "redesign from screenshot" workflow — import existing UI and then edit or convert.
allowed-tools:
  - "stitch*:*"
  - "Bash"
  - "Read"
---

# Stitch MCP — Upload Screens from Local Files

Uploads local screenshots/mockups/HTML prototypes into a Stitch project as new screens. This is the entry point for the "redesign existing UI" workflow — import what you have, then use `edit_screens` to iterate or convert directly to code.

## Critical prerequisite

**Only use this skill when the user explicitly mentions "Stitch".**

You must have a `projectId` before calling this. If you don't have one:
- Create a new project via `stitch-mcp-create-project`
- Or find an existing project via `stitch-mcp-list-projects`

## When to use

- User provides a screenshot and wants to redesign it in Stitch
- User wants to import existing mockups into Stitch for editing
- User wants to upload an HTML prototype into Stitch
- The orchestrator classifies intent as "Upload screenshot"
- User says "import this design", "upload this image", or "redesign this screen"

## Preferred path: SDK upload helper

Use the included SDK helper when uploading local files from Claude Code:

```bash
node <skill-dir>/scripts/upload-screen.mjs --project <projectId> --file <filePath> --title <title>
```

If your current working directory is this skill directory:

```bash
node scripts/upload-screen.mjs --project <projectId> --file <filePath> --title <title>
```

Example:

```bash
node scripts/upload-screen.mjs --project 16150285609543967393 --file "ui/1设备模型-模型详情.png" --title "1设备模型-模型详情"
```

`scripts/upload-screen.mjs`:

- Uses globally installed `@google/stitch-sdk`.
- Reads the Stitch API key from `~/.claude/settings.json` at `mcpServers.stitch.headers.X-Goog-Api-Key` unless `STITCH_API_KEY` is set.
- Routes SDK networking through an Undici `ProxyAgent`.
- Defaults to `http://localhost:7890` unless `--proxy`, `HTTPS_PROXY`, or `HTTP_PROXY` is set.
- Accepts `projects/<id>` or bare numeric project IDs.
- Prints JSON with created screen IDs plus image/html URLs when available.

If the SDK is missing, ask the user before installing it globally:

```bash
npm install -g @google/stitch-sdk
```

Supported SDK inputs:

| Extension | Type |
| --- | --- |
| `.png` | Image screen |
| `.jpg`, `.jpeg` | Image screen |
| `.webp` | Image screen |
| `.html`, `.htm` | Document screen |

For uploaded image screens, `html` can be an empty string. That is normal: the upload creates an image screen. To get HTML, use Stitch UI/MCP edit or conversion steps afterward.

## MCP upload fallback

If the MCP tool `upload_screens_from_images` is available, image uploads can also use base64 payloads.

Encode an image:

```bash
bash scripts/encode-image.sh "path/to/screenshot.png"
```

Call the MCP tool

```json
{
  "name": "upload_screens_from_images",
  "arguments": {
    "projectId": "3780309359108792857",
    "images": [
      {
        "fileContentBase64": "[base64-encoded-image-data]",
        "mimeType": "image/png"
      }
    ]
  }
}
```

### `projectId` — numeric ID only, no prefix

```
✅ "3780309359108792857"
❌ "projects/3780309359108792857"
```

### `images` — array of image objects

Each image needs:
| Field | Type | Description |
|-------|------|-------------|
| `fileContentBase64` | string | Base64-encoded image data (no `data:` prefix) |
| `mimeType` | string | MIME type matching the image format |

You can upload multiple images in a single call — each becomes a separate screen.

## Output

Returns session info similar to `generate_screen_from_text`. The uploaded images appear as new screens in the project.

## After uploading

1. Record the returned `projectId` and `screenId`.
2. If the uploaded screen is an image and HTML is empty, tell the user this is expected.
3. Offer the user:
   - "Edit this screen (change colors, layout, content)?" → `stitch-mcp-edit-screens`
   - "Convert directly to code?" → `stitch-mcp-get-screen` → framework conversion
   - "Generate variants based on this design?" → `stitch-mcp-generate-variants`

## References

- `scripts/upload-screen.mjs` — SDK upload helper
- `scripts/encode-image.sh` — Base64 encoding helper

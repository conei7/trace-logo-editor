# Trace Logo Editor

6x6 grid edge editor for tracing logo-style glyphs from a reference font.

## Local

Open `index.html` directly in a browser. No build step is required.

To run the local server:

```powershell
node local-server.mjs
```

Then open `http://127.0.0.1:8787`.

## One-step sharing

Double-click `share.cmd`, or run:

```powershell
.\start-share.ps1
```

This starts the local server, opens a temporary Cloudflare quick tunnel, copies the public `trycloudflare.com` URL to the clipboard, and keeps both processes running until the window is closed or Ctrl+C is pressed.

To stop a background share session later:

```powershell
.\stop-share.ps1
```

## Shared autosave

When the app is opened through `node local-server.mjs` or `share.cmd`, edits are saved in two places:

- Browser local storage for the current device.
- `data/shared-project.json` on the local server.

Open the same Cloudflare quick tunnel URL on a phone and desktop to work on the same shared project. A previous server copy is kept at `data/shared-project.backup.json`.

Static file usage and Cloudflare Pages without a write API still fall back to browser local storage and manual JSON export/import.

## Cloudflare Pages

Use `trace-logo-editor` as the project root.

- Build command: none
- Build output directory: `.`

CLI deploy:

```powershell
npx wrangler pages deploy . --project-name trace-logo-editor
```

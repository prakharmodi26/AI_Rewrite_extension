# AI Actions Chrome Extension (Demo)

Chrome Manifest V3 extension that rewrites or summarizes selected text via a backend `/transform` endpoint. This is a demo that uses an HMAC secret for signing in the browser — do not ship this pattern to production.

Structure
- `extension/manifest.json`: MV3 config (permissions, service worker, content script, options, commands)
- `extension/src/background.ts`: Service worker for context menus and shortcuts → messages the page
- `extension/src/content.ts`: Reads selection, renders overlay UI, calls server, copy/replace/dismiss
- `extension/src/storage.ts`: Settings (server URL, tone, redact) in sync; secret + installId in local
- `extension/src/hmac.ts`: WebCrypto HMAC-SHA256 helpers (hex)
- `extension/src/options.html|ts`: Options page UI + logic and health check
- `extension/src/overlay.css`: Styles for overlay and toast in-page UI
- `extension/src/types.ts`: Shared types

Build and Load
1. Install deps
	- `npm install`
2. Build
	- `npm run build`
3. Load Unpacked in Chrome
	- Visit `chrome://extensions` → Enable Developer Mode → Load Unpacked → select `dist/` folder
4. Open Options
	- Set Server URL, DEV-ONLY HMAC secret, and test `/healthz`

Usage
- Select text on any page.
- Right-click → AI Actions → pick a task or use shortcuts:
  - Rewrite (Clear & Professional): Cmd/Ctrl+Shift+R
  - Summarize: Cmd/Ctrl+Shift+S
- Overlay shows spinner then the output, with Copy, Replace Selection (when editable), and Dismiss.

Troubleshooting
- 401/409: Auth error (signature/timing). Check clock/nonce/secret and retry.
- 429: Rate limit — slow down.
- 400: Invalid request — ensure non-empty input.
- 500: Server error — try again.
- CORS: Allow the extension ID origin in server config.
- Clipboard: Copy must be a user gesture from the overlay.

Security Note
- The HMAC secret is stored in `chrome.storage.local` for demo purposes only. In production, delegate signing to a trusted proxy or use a different auth flow.

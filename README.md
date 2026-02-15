# Xinfer Crawler — Browser Extension

Xinfer Crawler fetches web pages through your browser session, using the same cookies, login state, and network path you already use while browsing. Instead of trying to reproduce complex website behaviors from a server (which often breaks on sign-in pages, session checks, bot defenses, or region-restricted content), the extension opens URLs in a real browser tab and captures the fully rendered HTML.

This is especially useful for sites that require authentication or interactive steps. If a page needs you to sign in, accept consent banners, or complete a CAPTCHA, the tab is opened so you can handle those steps normally. Once access is granted, the extension continues capturing authorized page content automatically.

## What it does

- Opens URLs in a real browser tab using your current network connection
- Uses your active session (cookies, logged-in state) to access authenticated content
- Captures page content after JavaScript renders, suitable for modern SPA sites
- Lets you complete login, verification, or CAPTCHA prompts on the first page, then auto-crawls the rest
- Works across any domain (your own sites, subdomains, localhost for development)

## What it doesn't do

- It does not bypass paywalls, CAPTCHAs, or access controls — if a site requires user action, you complete it in the tab as you normally would
- It does not "hack" authentication — everything relies on your legitimate browser session

## Installation

1. Open `chrome://extensions` in Chrome (or your Chromium-based browser)
2. Enable **Developer mode** (toggle in the top-right)
3. Click **Load unpacked** and select the `browser-extension/` directory
4. The Xinfer Crawler icon should appear in your extensions toolbar

To update after code changes, click the refresh icon on the extension card in `chrome://extensions`.

## How it works

The extension uses a three-layer architecture:

```
Admin page (React)  ←→  content.js  ←→  background.js (service worker)
   CustomEvents          chrome.runtime.sendMessage       chrome.tabs API
```

**1. Extension detection** — When the admin page loads, the `useExtensionCrawl` hook pings the content script via `RAG_CRAWL_EXTENSION_PING` / `RAG_CRAWL_EXTENSION_PONG` events.

**2. Tab-based crawl flow:**

1. Admin page requests `open` → background creates a new tab with the first URL
2. User sees the tab, completes any login/CAPTCHA if needed, then clicks **Continue** in the admin UI
3. Admin page requests `extract` → background runs `chrome.scripting.executeScript` to capture the rendered HTML from the current tab
4. For each subsequent URL, admin page requests `fetch` → background navigates the same tab to the new URL, waits for load + JS rendering, and extracts HTML automatically
5. When done, admin page requests `close` → background closes the crawl tab

**3. MV3 service worker persistence** — Chrome's Manifest V3 service workers go idle after ~30 seconds of inactivity, losing all in-memory state. The extension persists the crawl tab ID via `chrome.storage.session` so it survives service worker restarts (e.g., while the user spends time logging in).

### Message types

| Action    | Message type        | Description                                    |
| --------- | ------------------- | ---------------------------------------------- |
| `open`    | `CRAWL_TAB_OPEN`    | Create a new tab and navigate to URL           |
| `fetch`   | `CRAWL_TAB_FETCH`   | Navigate existing tab to URL, extract HTML     |
| `extract` | `CRAWL_TAB_EXTRACT` | Extract HTML from current tab state            |
| `close`   | `CRAWL_TAB_CLOSE`   | Close the crawl tab                            |
| (legacy)  | `FETCH_URL`         | Fetch URL via service worker `fetch()` (no tab)|

## Permissions

| Permission                  | Why it's needed                                                        |
| --------------------------- | ---------------------------------------------------------------------- |
| `tabs` / `activeTab`        | Open, navigate, and manage the crawl tab                               |
| `scripting`                 | Inject a script to read `document.documentElement.outerHTML` from tabs  |
| `storage`                   | Persist crawl tab ID across service worker restarts via `chrome.storage.session` |
| `host_permissions` (`<all_urls>`) | Load and capture pages across any domain you choose to crawl     |

## Privacy and data handling

The extension only acts when you initiate a crawl from the Xinfer admin panel. Captured HTML is sent to your Xinfer instance for processing. Your browsing session remains under your control, and interactive steps (login, CAPTCHA) happen directly in your browser. No data is sent to third parties.

## File structure

```
browser-extension/
  background.js    # Service worker — tab management, HTML extraction, legacy fetch
  content.js       # Content script — bridges page events to background messages
  manifest.json    # Extension manifest (MV3)
  icons/           # Extension icons (16, 32, 48, 128px)
  README.md
```

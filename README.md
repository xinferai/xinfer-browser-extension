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

1. Clone the repository:
   ```
   git clone https://github.com/xinferai/xinfer-browser-extension.git
   ```
2. Open `chrome://extensions` in Chrome (or your Chromium-based browser)
3. Enable **Developer mode** (toggle in the top-right)
4. Click **Load unpacked** and select the cloned directory
5. The Xinfer Crawler icon should appear in your extensions toolbar

To update, pull the latest changes and click the refresh icon on the extension card in `chrome://extensions`.

## How it works

The extension uses a three-layer design: a host page communicates with a content script, which relays messages to a background service worker.

**1. Extension detection** — When a host page loads, it sends a ping event. If the extension's content script is present, it responds with a pong, confirming the extension is installed and active.

**2. Tab-based crawl flow:**

1. The host page requests a new tab to be opened with the first URL
2. You see the tab and complete any login or CAPTCHA if needed, then continue from the host page
3. The extension captures the fully rendered HTML from the open tab
4. For each subsequent URL, the extension navigates the same tab, waits for the page to render, and extracts HTML automatically
5. When the crawl is complete, the tab is closed

**3. Service worker persistence** — Chrome's Manifest V3 service workers go idle after a short period of inactivity, losing all in-memory state. The extension persists its state to session storage so it survives service worker restarts (e.g., while you spend time logging in).

## Permissions

| Permission                  | Why it's needed                                                        |
| --------------------------- | ---------------------------------------------------------------------- |
| `tabs` / `activeTab`        | Open, navigate, and manage the crawl tab                               |
| `scripting`                 | Inject a script to read rendered page content from tabs                |
| `storage`                   | Persist state across service worker restarts                           |
| `host_permissions` (`<all_urls>`) | Load and capture pages across any domain you choose to crawl     |

## Privacy and data handling

The extension only acts when you initiate a crawl from a host page. Captured HTML is sent to your Xinfer instance for processing. Your browsing session remains under your control, and interactive steps (login, CAPTCHA) happen directly in your browser. No data is sent to third parties.

## Contributing

This is an open-source project. Issues and pull requests are welcome at [github.com/xinferai/xinfer-browser-extension](https://github.com/xinferai/xinfer-browser-extension).

## License

See [LICENSE](LICENSE) for details.

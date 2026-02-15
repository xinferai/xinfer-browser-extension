/**
 * Xinfer Crawler Extension - Content Script
 *
 * Acts as a bridge between the web page and the extension's background service worker.
 * Uses CustomEvent for page <-> content script communication (safer than postMessage).
 * Uses chrome.runtime.sendMessage for content script <-> background communication.
 */

// Signal that the extension is available
document.dispatchEvent(new CustomEvent("RAG_CRAWL_EXTENSION_READY"));

// Respond to ping requests (in case the page loaded before this script)
document.addEventListener("RAG_CRAWL_EXTENSION_PING", () => {
	document.dispatchEvent(new CustomEvent("RAG_CRAWL_EXTENSION_PONG"));
});

// Handle fetch requests from the page (legacy)
document.addEventListener("RAG_CRAWL_FETCH_REQUEST", async (event) => {
	const { url } = event.detail || {};
	if (!url) {
		document.dispatchEvent(
			new CustomEvent("RAG_CRAWL_FETCH_RESPONSE", {
				detail: { error: "No URL provided" },
			}),
		);
		return;
	}

	try {
		const response = await chrome.runtime.sendMessage({
			type: "FETCH_URL",
			url,
		});

		document.dispatchEvent(
			new CustomEvent("RAG_CRAWL_FETCH_RESPONSE", {
				detail: response,
			}),
		);
	} catch (error) {
		document.dispatchEvent(
			new CustomEvent("RAG_CRAWL_FETCH_RESPONSE", {
				detail: { error: error.message || "Extension communication failed" },
			}),
		);
	}
});

// Handle tab-based crawl requests from the page
document.addEventListener("RAG_CRAWL_TAB_REQUEST", async (event) => {
	const { action, url } = event.detail || {};
	if (!action) {
		document.dispatchEvent(
			new CustomEvent("RAG_CRAWL_TAB_RESPONSE", {
				detail: { action, error: "No action provided" },
			}),
		);
		return;
	}

	const messageTypeMap = {
		open: "CRAWL_TAB_OPEN",
		fetch: "CRAWL_TAB_FETCH",
		extract: "CRAWL_TAB_EXTRACT",
		close: "CRAWL_TAB_CLOSE",
	};

	const messageType = messageTypeMap[action];
	if (!messageType) {
		document.dispatchEvent(
			new CustomEvent("RAG_CRAWL_TAB_RESPONSE", {
				detail: { action, error: `Unknown action: ${action}` },
			}),
		);
		return;
	}

	try {
		const message = { type: messageType };
		if (url) message.url = url;

		const response = await chrome.runtime.sendMessage(message);

		document.dispatchEvent(
			new CustomEvent("RAG_CRAWL_TAB_RESPONSE", {
				detail: { action, ...response },
			}),
		);
	} catch (error) {
		document.dispatchEvent(
			new CustomEvent("RAG_CRAWL_TAB_RESPONSE", {
				detail: {
					action,
					error: error.message || "Extension communication failed",
				},
			}),
		);
	}
});

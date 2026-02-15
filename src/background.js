/**
 * Xinfer Crawler Extension - Background Service Worker
 *
 * Handles CORS-free fetching and tab-based crawling of web pages.
 * Service worker context has no CORS restrictions, so it can fetch any URL.
 * Tab-based crawling opens pages in a real browser tab for cookie/JS support.
 *
 * NOTE: MV3 service workers can go idle after ~30s of inactivity, losing all
 * in-memory state. We persist crawlTabId via chrome.storage.session so it
 * survives service worker restarts (e.g. while the user logs in).
 */

const FETCH_TIMEOUT_MS = 30000;
const TAB_LOAD_TIMEOUT_MS = 30000;
const JS_RENDER_DELAY_MS = 1500;

// --- Persisted crawl tab ID (survives service worker restart) ---

async function getCrawlTabId() {
	const result = await chrome.storage.session.get("crawlTabId");
	return result.crawlTabId ?? null;
}

async function setCrawlTabId(id) {
	if (id === null) {
		await chrome.storage.session.remove("crawlTabId");
	} else {
		await chrome.storage.session.set({ crawlTabId: id });
	}
}

// --- Tab helpers ---

function waitForTabLoad(tabId) {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			chrome.tabs.onUpdated.removeListener(listener);
			reject(new Error("Tab load timed out"));
		}, TAB_LOAD_TIMEOUT_MS);

		function listener(updatedTabId, changeInfo) {
			if (updatedTabId === tabId && changeInfo.status === "complete") {
				chrome.tabs.onUpdated.removeListener(listener);
				clearTimeout(timeout);
				resolve();
			}
		}

		chrome.tabs.onUpdated.addListener(listener);
	});
}

function extractHtml(tabId) {
	return chrome.scripting
		.executeScript({
			target: { tabId },
			func: () => document.documentElement.outerHTML,
		})
		.then((results) => {
			if (results?.[0]?.result) {
				return results[0].result;
			}
			throw new Error("Failed to extract HTML from tab");
		});
}

// Detect user closing the crawl tab
chrome.tabs.onRemoved.addListener(async (tabId) => {
	const crawlTabId = await getCrawlTabId();
	if (tabId === crawlTabId) {
		await setCrawlTabId(null);
	}
});

// --- Message handlers ---

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message.type === "FETCH_URL") {
		handleFetchUrl(message.url)
			.then(sendResponse)
			.catch((error) => {
				sendResponse({ error: error.message || "Fetch failed" });
			});
		return true;
	}

	if (message.type === "CRAWL_TAB_OPEN") {
		handleTabOpen(message.url)
			.then(sendResponse)
			.catch((error) => {
				sendResponse({ error: error.message || "Failed to open tab" });
			});
		return true;
	}

	if (message.type === "CRAWL_TAB_FETCH") {
		handleTabFetch(message.url)
			.then(sendResponse)
			.catch((error) => {
				sendResponse({ error: error.message || "Failed to fetch via tab" });
			});
		return true;
	}

	if (message.type === "CRAWL_TAB_EXTRACT") {
		handleTabExtract()
			.then(sendResponse)
			.catch((error) => {
				sendResponse({ error: error.message || "Failed to extract HTML" });
			});
		return true;
	}

	if (message.type === "CRAWL_TAB_CLOSE") {
		handleTabClose()
			.then(sendResponse)
			.catch((error) => {
				sendResponse({ error: error.message || "Failed to close tab" });
			});
		return true;
	}
});

// --- Tab action handlers ---

async function handleTabOpen(url) {
	// Close existing crawl tab if any
	const existingTabId = await getCrawlTabId();
	if (existingTabId !== null) {
		try {
			await chrome.tabs.remove(existingTabId);
		} catch {
			// Tab may already be closed
		}
		await setCrawlTabId(null);
	}

	const tab = await chrome.tabs.create({ url, active: true });
	await setCrawlTabId(tab.id);
	await waitForTabLoad(tab.id);
	return { success: true };
}

async function handleTabFetch(url) {
	const crawlTabId = await getCrawlTabId();
	if (crawlTabId === null) {
		throw new Error("No crawl tab open");
	}

	// Verify tab still exists
	try {
		await chrome.tabs.get(crawlTabId);
	} catch {
		await setCrawlTabId(null);
		throw new Error("Crawl tab was closed");
	}

	await chrome.tabs.update(crawlTabId, { url });
	await waitForTabLoad(crawlTabId);

	// Wait for JS rendering
	await new Promise((r) => setTimeout(r, JS_RENDER_DELAY_MS));

	const html = await extractHtml(crawlTabId);
	return { html };
}

async function handleTabExtract() {
	const crawlTabId = await getCrawlTabId();
	if (crawlTabId === null) {
		throw new Error("No crawl tab open");
	}

	try {
		await chrome.tabs.get(crawlTabId);
	} catch {
		await setCrawlTabId(null);
		throw new Error("Crawl tab was closed");
	}

	const html = await extractHtml(crawlTabId);
	return { html };
}

async function handleTabClose() {
	const crawlTabId = await getCrawlTabId();
	if (crawlTabId !== null) {
		try {
			await chrome.tabs.remove(crawlTabId);
		} catch {
			// Tab may already be closed
		}
		await setCrawlTabId(null);
	}
	return { success: true };
}

// --- Fetch handler (legacy) ---

async function handleFetchUrl(url) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: {
				Accept:
					"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
				"Accept-Language": "en-US,en;q=0.9",
				"Cache-Control": "no-cache",
				Pragma: "no-cache",
				"Upgrade-Insecure-Requests": "1",
			},
			redirect: "follow",
		});

		if (!response.ok) {
			return {
				error: `HTTP ${response.status} ${response.statusText}`,
				status: response.status,
			};
		}

		const contentType = response.headers.get("content-type") || "";
		if (!contentType.includes("text/html")) {
			return { error: "Non-HTML content", status: 0 };
		}

		const html = await response.text();
		return { html };
	} catch (error) {
		if (error.name === "AbortError") {
			return { error: "Fetch timed out", status: 0 };
		}
		return { error: error.message || "Network error", status: 0 };
	} finally {
		clearTimeout(timeoutId);
	}
}

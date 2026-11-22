'use strict';

/* exported WriteToClipboardOffscreen */

/*
 * Chrome only (loaded by service-worker.js; the Firefox build leaves it out, see gulpfile.js).  Chrome's background is a
 * service worker, which has no clipboard: an offscreen document (src/html/offscreen.html, src/lib/Offscreen.js) copies.
 */

/** The offscreen document that copies, and the message it copies */
const OFFSCREEN_DOCUMENT = 'src/html/offscreen.html',
	OFFSCREEN_COPY       = 'OffscreenCopy';

/** Copies run one after another: an extension may have one offscreen document at a time */
let clipboardChain = Promise.resolve();

/**
 * Copies the text through the offscreen document, opened for the copy and closed after it
 *
 * @param {string} text
 * @return {Promise<void>}
 */
function WriteToClipboardOffscreen(text) {
	clipboardChain = clipboardChain.then(async () => {
		let url = browser.runtime.getURL(OFFSCREEN_DOCUMENT);

		// The worker may have been stopped during an earlier copy, with its document still open
		if(!(await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [url] })).length) {
			await chrome.offscreen.createDocument({
				url:           OFFSCREEN_DOCUMENT,
				reasons:       ['CLIPBOARD'],
				justification: 'Copies the links selected with Snap Links to the clipboard',
			});
		}
		try {
			if(!await browser.runtime.sendMessage({ Action: OFFSCREEN_COPY, text }))
				throw new Error('the offscreen document could not copy');
		} finally {
			await chrome.offscreen.closeDocument();
		}
	}).catch(error => console.error('Snap Links could not copy to the clipboard: ', error));

	return clipboardChain;
}

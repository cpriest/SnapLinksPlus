'use strict';

/*
 * Chrome's background is a service worker, which has no clipboard.  To copy links it opens offscreen.html, this page's
 * document, and sends the text here (src/background-scripts/OffscreenClipboard.js).  The page loads nothing else: the
 * action name is OFFSCREEN_COPY there.
 */
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
	if(msg?.Action != 'OffscreenCopy')
		return;

	let textarea = document.getElementById('Clipboard');

	textarea.value = msg.text;
	textarea.select();
	respond(document.execCommand('copy'));
});

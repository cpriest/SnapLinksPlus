'use strict';

/*
 * Chrome's background is a service worker, which has no clipboard.  To copy links it opens offscreen.html, this page's
 * document, and sends the text here (WriteToClipboard() in background.js).  The page loads nothing else: the action name
 * is OFFSCREEN_COPY in background.js.
 */
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
	if(msg?.Action != 'OffscreenCopy')
		return;

	let textarea = document.getElementById('Clipboard');

	textarea.value = msg.text;
	textarea.select();
	respond(document.execCommand('copy'));
});

/*
 * Copyright (c) 2016-2018 Clint Priest
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
 * WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
 * CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

"use strict";

/**
 * Log that we received the message.
 * Then display a notification. The notification contains the URL,
 * which we read from the message.
 *
 * @param msg object
 * @param sender MessageSender
 * @param respond function
 */
function onMessage(msg, sender, respond) {
	switch(msg.Action) {
		case RELOAD_EXTENSION:
			browser.runtime.onMessage.removeListener(onMessage);
			browser.tabs.reload();
			browser.runtime.reload();
			break;
		case OPEN_URLS_IN_TABS:
			Prefs.loaded.then(async () => {
				let tabs = await browser.tabs.query({
					active       : true,
					currentWindow: true
				});
				if(!tabs.length)
					return;
				let TabsLeft = msg.tUrls.length;

				// Reverse the url order so that we are opening in the correct order
				for(let url of msg.tUrls.reverse()) {
					let props = {
						url:           url,
						active:        Prefs.SwitchFocusToNewTab ? (--TabsLeft) === 0 : false,	// Activate the last tab to be opened
						index:         tabs[0].index + 1,
						openerTabId:   tabs[0].id,
					};
					if(isFirefox)
						props.cookieStoreId = tabs[0].cookieStoreId;

					browser.tabs.create(props);
				}
			});
			break;
	}
}

browser.runtime.onMessage.addListener(onMessage);


/**
 * Check storage.LastInstalledVersion to see if we're newly    installed or a new version or what
 */
async function CheckInstallation() {
	try {
		let item = await browser.storage.local.get('LastInstalledVersion');

		let manifest = browser.runtime.getManifest();

		if(!item || !item.LastInstalledVersion) {
			// New installation
			browser.tabs.create({
				url   : 'http://cpriest.github.io/SnapLinksPlus/welcome.html',
				active: true,
			});
		} else if(item.LastInstalledVersion != manifest.version) {
			// Update/Upgrade
			browser.tabs.create({
				url   : 'http://cpriest.github.io/SnapLinksPlus/updated.html',
				active: true,
			});
		}

		browser.storage.local.set({ 'LastInstalledVersion': manifest.version });
	} catch(e) {
		console.error('Error while getting LastInstalledVersion: ', e);
	}
}

setTimeout(() => {
	// noinspection JSIgnoredPromiseFromCall
	CheckInstallation();
}, 1000);

/*
 * Copyright (c) 2016 Clint Priest
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
 */
function onMessage(msg) {
	switch(msg.Action) {
		case RELOAD_EXTENSION:
			chrome.runtime.onMessage.removeListener(onMessage);
			chrome.runtime.reload();
			break;
		case OPEN_URLS_IN_TABS:

            configs.$loaded.then(function() {
                chrome.tabs.query({
                        active       : true,
                        currentWindow: true
                    }, (tabs) => {
                        if(tabs.length) {
                            let TabsLeft = msg.tUrls.length;

                            // Reverse the url order so that we are opening in the correct order
                            for(let url of msg.tUrls.reverse()) {
                                chrome.tabs.create({
                                    url   : url,
                                    active: configs.switchFocusToNewTab ? (--TabsLeft) == 0 : false,	// Activate the last tab to be opened
                                    index: tabs[0].index+1,
                                });
                            }
                        }
                    }
                );
            });


			break;
	}
}
chrome.runtime.onMessage.addListener(onMessage);


/**
 * Check storage.LastInstalledVersion to see if we're newly	installed or a new version or what
 */
function CheckInstallation() {
	chrome.storage.local.get('LastInstalledVersion', (item) => {
		if(chrome.runtime.lastError)
			return console.error('Error while getting LastInstalledVersion: ', chrome.runtime.lastError);

		let manifest = chrome.runtime.getManifest();

		if(!item || !item.LastInstalledVersion) {
			// New installation
			chrome.tabs.create({
				url:	'http://cpriest.github.io/SnapLinksPlus/welcome.html',
				active: true,
			});
		} else if(item.LastInstalledVersion != manifest.version) {
			// Update/Upgrade
		}

		chrome.storage.local.set({ 'LastInstalledVersion': manifest.version });
	});
}

setTimeout(() => {
	CheckInstallation();
}, 250);

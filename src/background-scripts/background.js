'use strict';

let TabStacks = new Map();

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
	if(!('Action' in msg))
		return;

	switch(msg.Action) {
		case BACKGROUND_TEST:
			// let p = browser.notifications.create({
			// 	'type':		'basic',
			// 	'iconUrl':	browser.extension.getURL('res/SnapLinksLogo48.png'),
			// 	'title':	"Background Test Notification.",
			// 	'message':	"No message payload necessary with this action.",
			// });
			break;
		case RELOAD_EXTENSION:
			browser.runtime.onMessage.removeListener(onMessage);
			browser.tabs.reload();
			browser.runtime.reload();
			break;
		case OPEN_URLS_IN_TABS:
			OpenUrlsInTabs(msg.tUrls);
			break;
	}
}

/**
 * @param {string[]} urls
 * @return {Promise<void>}
 */
async function OpenUrlsInTabs(urls) {
	let activeTab = (await browser.tabs.query({
		active:        true,
		currentWindow: true,
	}))[0];

	let tabsLeft   = urls.length,
		tabsOpened = 0,
		startIndex,
		tabStack   = TabStacks.get(activeTab.id) || [];

	switch(Prefs.OpenTabs) {
		case TABS_OPEN_END:
			let openTabs = await browser.tabs.query({
				currentWindow: true,
			});
			startIndex   = openTabs.length;
			break;
		case TABS_OPEN_RIGHT:
			startIndex = activeTab.index + 1;
			break;
		case TABS_OPEN_NATURAL:
			/* Naturally means similar to Firefox does with middle-click on a URL as of 2021-08-27
			 *
			 *	This means each opening tab keeps track of the tabs it has opened, and opens new links
			 * 	to the right of the further tab last opened
			 */
			let resolvedTab;

			for(let tabId of Array.from(tabStack)) {
				try {
					//noinspection JSCheckFunctionSignatures
					resolvedTab = await browser.tabs.get(tabId);
					break;
				} catch(error) {
					// Tab is no longer available, take it off the stack
					tabStack.shift();
				}
			}

			startIndex = (resolvedTab?.index || activeTab.index) + 1;
			break;
	}

	for(let url of urls) {
		let props = {
			url:    url,
			active: Prefs.SwitchFocusToNewTab ? (--tabsLeft) === 0 : false,	// Activate the last tab to be opened
			index:  startIndex + tabsOpened++,
		};

		if(isFirefox) {
			props.cookieStoreId = activeTab.cookieStoreId;
			if(Prefs.SetOwnershipTabID_FF)
				props.openerTabId = activeTab.id;
		}

		let newTab = await browser.tabs.create(props);
		tabStack.unshift(newTab.id);

		await sleep(Prefs.NewTabDelayMS);
	}
	TabStacks.set(activeTab.id, tabStack);
}

/**
 * Check storage.LastInstalledVersion to see if we're newly installed or a new version or what
 */
async function CheckInstallation() {
	try {
		let item     = await browser.storage.local.get('LastInstalledVersion'),
			manifest = browser.runtime.getManifest();

		//noinspection ES6MissingAwait
		browser.storage.local.set({ 'LastInstalledVersion': manifest.version });

		if(Prefs.ShowUpdateNotification) {
			if(!item || !item.LastInstalledVersion) {
				// New installation
				Notify('Snap Links Installed', `Click for a quick tutorial on usage.`, id => browser.tabs.create({
					url:    'https://cpriest.github.io/SnapLinksPlus/#/Tutorial',
					active: true,
				}));
			} else if(item.LastInstalledVersion != manifest.version) {
				Notify('Snap Links Updated', `Version ${manifest.version} is now installed.\n\nClick here for more information.`, id => browser.tabs.create({
					url:    'https://cpriest.github.io/SnapLinksPlus/#/Updated',
					active: true,
				}));
			}
		}
		if(item.LastInstalledVersion.localeCompare('3.1.7', undefined, { numeric: true }) < 0) {
			// Transition to sync storage for v3.1.7 upgrade
			let local = await browser.storage.local.get();

			if(Object.keys(local).length > 1) {
				local.LastInstalledVersion = manifest.version;
				local.StorageAPI           = 'sync';
				await browser.storage.sync.set(local);
			}
		}
	} catch(e) {
		console.error('Error while getting LastInstalledVersion: ', e);
	}
}

function Notify(title, message, onClick) {
	if(onClick)
		browser.notifications.onClicked.addListener((...args) => onClick(...args));

	browser.notifications.create('', {
			type:    'basic',
			title:   title,
			iconUrl: 'res/SnapLinksLogo32.png',
			message: message,
//			buttons: [
//				{ title: 'Disable This Notification' },
//			],
		})
		.then(r => {});
}

browser.runtime.onInstalled.addListener((e) => {
	Prefs.Ready.then(() => {
		CheckInstallation();
	});
});

DOMReady.then(() => {
	browser.runtime.onMessage.addListener(onMessage);

	if(Prefs.DevMode)
		console.log('Snap Links reloaded %s', (new Date()).toLocaleString());

	// noinspection JSIgnoredPromiseFromCall
//	browser.notifications.create({
//		'type':         'basic',
//		'iconUrl':      browser.extension.getURL('res/SnapLinksLogo48.png'),
//		'title':        'Test Notification Title',
//		'message':      'Test Notification Content 4',
//		contextMessage: 'Context Message',
//	});
	//noinspection JSIgnoredPromiseFromCall
});

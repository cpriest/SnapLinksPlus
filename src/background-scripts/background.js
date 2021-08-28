'use strict';

let allTabStacks = new Map();

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
	let tabs = await browser.tabs.query({
		currentWindow: true,
	});

	let activeTab = await browser.tabs.query({
		active:        true,
		currentWindow: true,
	})[0];

	let tabsLeft   = urls.length,
		tabsOpened = 0,
		startIndex;

	switch(Prefs.OpenTabs) {
		case TABS_OPEN_END:
			startIndex = tabs.length;
			break;
		case TABS_OPEN_RIGHT:
			startIndex = activeTab.index + 1;
			break;
		case TABS_OPEN_NATURAL:
			/* Naturally means like Firefox does with middle-click on a URL as of 2021-08-27
			 *
			 *	 This means if you are on Tab A with a Tab B & C open, such as [A] B C and then:
			 *	 * You middle click 2 links							-> [A] A.1 A.2      B      C
			 *	 * You switch to tab B and middle click 1 link		->  A  A.1 A.2     [B] B.1 C
			 *	 * You switch back to tab A and middle-click 1 link	-> [A] A.3 A.1 A.2 [B] B.1 C
			 *
			 *	 This means "open at end of {current stack}" where {current stack} means the last opened tab
			 *	 from the current tab with the stack clearing upon changing tabs.
			 */

			break;
	}

	let tabStack = allTabStacks.get(activeTab.id) || [];

	let resolvedTab = await tabStack.reduce(async (memo, tabId) => {
		try {
			if(await memo)
				return memo;
		} catch(error) { /* ignored */ }
		try { return browser.tabs.get(tabId); } catch(error) { /* ignored */ }

		return memo;
	}, undefined);

	if(Prefs.OpenTabs == TABS_OPEN_NATURAL) {
		startIndex = (resolvedTab?.index || activeTab.index) + 1;
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

		if(Prefs.OpenTabs == TABS_OPEN_NATURAL) {
			tabStack.unshift(newTab.id);
		}

		await sleep(Prefs.NewTabDelayMS);
	}
	if(Prefs.OpenTabs == TABS_OPEN_NATURAL)
		allTabStacks.set(activeTab.id, tabStack);
}

/**
 * Check storage.LastInstalledVersion to see if we're newly installed or a new version or what
 */
async function CheckInstallation() {
	try {
		let item     = await browser.storage.local.get('LastInstalledVersion'),
			manifest = browser.runtime.getManifest();

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
				delete local.LastInstalledVersion;
				await browser.storage.local.clear();
				await browser.storage.sync.set(local);
			}
		}

		//noinspection ES6MissingAwait
		browser.storage.local.set({ 'LastInstalledVersion': manifest.version });
	} catch(e) {
		console.error('Error while getting LastInstalledVersion: ', e);
	}
}

function Notify(title, message, onClick) {
	if(onClick)
		browser.notifications.onClicked.addListener((...args) => onClick(...args));

	browser.notifications.create(
			'', {
				type:    'basic',
				title:   title,
				iconUrl: 'res/SnapLinksLogo32.png',
				message: message,
//				buttons:        [
//					{ title: 'Disable This Notification' }
//				]
			})
		.then(r => {});
}

DOMReady.then(() => {
	browser.runtime.onMessage.addListener(onMessage);

	// noinspection JSIgnoredPromiseFromCall
	// let p = browser.notifications.create({
	// 	'type':		'basic',
	// 	'iconUrl':	browser.extension.getURL('res/SnapLinksLogo48.png'),
	// 	'title':	"Test Notification Title",
	// 	'message':	"Test Notification Content 4",
	// });
	//noinspection JSIgnoredPromiseFromCall
	CheckInstallation();
});

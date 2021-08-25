'use strict';

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
	let tabsAll = await browser.tabs.query({
		currentWindow: true,
	});

	let tabs = await browser.tabs.query({
		active:        true,
		currentWindow: true,
	});
	if(!tabs.length)
		return;
	let TabsLeft = urls.length;

	let nbOpened = 0;
	for(let url of urls) {
		let props = {
			url:    url,
			active: Prefs.SwitchFocusToNewTab ? (--TabsLeft) === 0 : false,	// Activate the last tab to be opened
		};
		switch(Prefs.OpenTabs) {
			case TABS_OPEN_END:
				props.index = tabsAll.length + nbOpened++;
				break;
			case TABS_OPEN_RIGHT:
				props.index = tabs[0].index + 1 + nbOpened++;
				break;
			case TABS_OPEN_NATURAL:

				break;
		}
		if(isFirefox) {
			props.cookieStoreId = tabs[0].cookieStoreId;
			if(Prefs.SetOwnershipTabID_FF)
				props.openerTabId = tabs[0].id;

		}

		//noinspection ES6MissingAwait
		browser.tabs.create(props);
		await sleep(Prefs.NewTabDelayMS);
	}
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

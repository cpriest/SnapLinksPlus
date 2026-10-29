'use strict';

let openUrlsPromiseChain = Promise.resolve();
let TabStacks = new Map();

// Serialize changes so switching activation buttons cannot leave a stale setting.
let contextMenuSettingsChain = Promise.resolve();
let contextMenuStateMessages = Promise.resolve();
const contextMenuDragRecoveryReady = isFirefox
	? browser.runtime.getPlatformInfo().then(info => info.os == 'linux')
	: Promise.resolve(false);

// Frame initialization must not wait for preference storage to finish loading.
function onContextMenuMessage(msg, sender) {
	if(msg.Action == 'GetContextMenuDragRecovery')
		return contextMenuDragRecoveryReady;
	if(msg.Action != 'SetContextMenuShown' || !sender.tab || typeof msg.shown != 'boolean')
		return;

	// Keep menu-open and menu-dismissed broadcasts in the order received.
	contextMenuStateMessages = contextMenuStateMessages.then(async () => {
		if(await contextMenuDragRecoveryReady)
			await browser.tabs.sendMessage(sender.tab.id, {
				Action: 'SetContextMenuShown', shown: msg.shown, source: msg.source,
			});
	}).catch(error => {
		console.warn('Snap Links could not share context menu state:', error);
	});
	return contextMenuStateMessages;
}

browser.runtime.onMessage.addListener(onContextMenuMessage);

function UpdateContextMenuSetting() {
	if(!isFirefox || !browser.browserSettings?.contextMenuShowEvent)
		return;

	let useMouseUp = Prefs.ActivateMouseButton == RMB;
	contextMenuSettingsChain = contextMenuSettingsChain.then(async () => {
		let setting = browser.browserSettings.contextMenuShowEvent;
		if(useMouseUp) {
			let changed = await setting.set({ value: 'mouseup' });
			if(!changed)
				console.warn('Snap Links could not change context menu timing. The setting may be locked or controlled by another extension.');
		} else {
			await setting.clear({});
		}
	}).catch(error => {
		console.error('Snap Links could not update context menu timing:', error);
	});
}

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
			openUrlsPromiseChain = openUrlsPromiseChain.then(() => {
				return OpenUrlsInTabs(msg.tUrls);
			});
			break;
		case COPY_TO_CLIPBOARD:
			CopyToClipboard(msg.tUrls);
			break;
		case COPY_TO_CLIPBOARD:
			CopyToClipboard(msg.tUrls);
			break;
	}
}

/**
 * @param {string[]} urls
 * @return {Promise<void>}
 */
async function CopyToClipboard(urls) {
	let platformInfo = await browser.runtime.getPlatformInfo();
	navigator.clipboard.writeText(urls.join(platformInfo.os === chrome.runtime.PlatformOs.WIN ? '\r\n' : '\n'));
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
			url:      url,
			active:   Prefs.SwitchFocusToNewTab ? (--tabsLeft) === 0 : false,	// Activate the last tab to be opened
			index:    startIndex + tabsOpened++,
			windowId: activeTab.windowId,
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

/**
 * Firefox on Linux and macOS opens the context menu on mousedown, which shows it when starting a right-button drag (#400),
 * so switch it to mouseup while Snap Links is activated by the right mouse button
 *
 * @return {Promise<void>}
 */
async function ApplyContextMenuShowEvent() {
	let platformInfo = await browser.runtime.getPlatformInfo();
	if(platformInfo.os === 'win')
		return;

	if(!browser.browserSettings)
		return;

	let setting = browser.browserSettings.contextMenuShowEvent;

	try {
		if(Prefs.ActivateMouseButton == RMB) {
			let current = await setting.get({});
			if(['controllable_by_this_extension', 'controlled_by_this_extension'].includes(current.levelOfControl))
				await setting.set({ value: 'mouseup' });
		} else {
			await setting.clear({});
		}
	} catch(e) {
		console.error('Error while setting contextMenuShowEvent: ', e);
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
	Prefs.onChanged(key => {
		if(key == 'ActivateMouseButton')
			UpdateContextMenuSetting();
	});
	// StoragePrefs may reload a different store without notifying its observers.
	browser.storage.onChanged.addListener((changes, area) => {
		if(area == 'local' && 'StorageAPI' in changes)
			Prefs.Ready.then(UpdateContextMenuSetting).catch(error => {
				console.error('Snap Links could not load context menu preferences:', error);
			});
	});
	UpdateContextMenuSetting();

	ApplyContextMenuShowEvent();
	Prefs.onChanged((key) => {
		if(key == 'ActivateMouseButton')
			ApplyContextMenuShowEvent();
	});

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

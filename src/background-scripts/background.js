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
			QueueOpen(() => OpenUrlsInTabs(msg.tUrls));
			break;
		case OPEN_URLS_IN_WINDOW:
			QueueOpen(() => OpenUrlsInWindow(msg.tUrls, sender.tab));
			break;
		case COPY_TO_CLIPBOARD:
			CopyToClipboard(msg.tUrls, msg.tTitles);
			break;
		case BOOKMARK_LINKS_IN_FOLDER:
			BookmarkLinks(msg.tUrls, msg.tTitles)
				.catch(error => console.error('Error while bookmarking links: ', error));
			break;
	}
}

/**
 * @param {string[]} urls
 * @param {string[]} [titles]    The text of each link, same order as urls
 * @return {Promise<void>}
 */
async function CopyToClipboard(urls, titles = []) {
	let platformInfo = await browser.runtime.getPlatformInfo();
	navigator.clipboard.writeText(FormatLinks(urls, titles, Prefs.CopyFormat, platformInfo.os === chrome.runtime.PlatformOs.WIN ? '\r\n' : '\n'));
}

/**
 * Bookmarks the links, in order, in a new folder named "Snap Links <date and time>", which is created in the browser's
 * default folder for new bookmarks (Other Bookmarks).  Without the bookmarks permission it opens the options page instead,
 * where the permission can be granted.
 *
 * @param {string[]} urls
 * @param {string[]} [titles]    The text of each link, a link without text is named by its URL
 * @return {Promise<void>}
 */
async function BookmarkLinks(urls, titles = []) {
	if(!await browser.permissions.contains(BOOKMARKS_PERMISSION))
		return browser.runtime.openOptionsPage();

	let folder = await browser.bookmarks.create({ title: `Snap Links ${new Date().toLocaleString()}` });

	for(let [i, url] of urls.entries()) {
		try {
			await browser.bookmarks.create({
				parentId: folder.id,
				title:    (titles && titles[i]) || url,
				url:      url,
			});
		} catch(error) {
			// Skip this URL and keep bookmarking the rest
			console.error(`Error while bookmarking ${url}: `, error);
		}
	}
}

/**
 * Writes the links in one of the COPY_* formats
 *
 * @param {string[]} urls
 * @param {string[]} titles    The text of each link, a link without text is titled by its URL
 * @param {string}   format    One of the COPY_* constants, anything else is COPY_URLS
 * @param {string}   eol       The line separator
 *
 * @return {string}
 */
function FormatLinks(urls, titles, format, eol) {
	let links = urls.map((url, i) => ({ url, title: (titles && titles[i]) || url }));

	let html     = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
		htmlLink = ({ url, title }) => `<a href="${html(url)}">${html(title)}</a>`,
		mdText   = (s) => s.replace(/[\\[\]]/g, '\\$&'),
		mdUrl    = (s) => s.replace(/[()\s]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));

	switch(format) {
		case COPY_TITLES_URLS:
			return links.map(l => `${l.title}\t${l.url}`).join(eol);
		case COPY_TITLES:
			return links.map(l => l.title).join(eol);
		case COPY_MARKDOWN:
			return links.map(l => `[${mdText(l.title)}](${mdUrl(l.url)})`).join(eol);
		case COPY_HTML:
			return links.map(htmlLink).join(eol);
		case COPY_HTML_LIST:
			return ['<ul>', ...links.map(l => `\t<li>${htmlLink(l)}</li>`), '</ul>'].join(eol);
		case COPY_URLS_SPACED:
			return urls.join(' ');
		default:
			return urls.join(eol);
	}
}

/**
 * Runs open() after the earlier open requests, so selections open in the order they were made.
 * Errors are caught so that a failed request doesn't leave the chain rejected, which would skip every later request (#578, #579).
 *
 * @param {function(): Promise<void>} open
 */
function QueueOpen(open) {
	openUrlsPromiseChain = openUrlsPromiseChain
		.then(open)
		.catch(error => console.error('Error while opening URLs: ', error));
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
			index:    startIndex + tabsOpened,
			windowId: activeTab.windowId,
		};

		if(isFirefox) {
			props.cookieStoreId = activeTab.cookieStoreId;
			// The opener tab may have been closed while tabs are still opening (#579)
			if(Prefs.SetOwnershipTabID_FF && await TabExists(activeTab.id))
				props.openerTabId = activeTab.id;
			if(Prefs.NewTabsOpenUnloaded)
				props.discarded = true;
		}

		let newTab;
		try {
			newTab = await browser.tabs.create(props);
		} catch(error) {
			// Skip this URL (e.g. an illegal URL) and keep opening the rest
			console.error(`Error while opening ${url} in a new tab: `, error);
			continue;
		}

		tabsOpened++;
		tabStack.unshift(newTab.id);

		await sleep(Prefs.NewTabDelayMS);
	}
	TabStacks.set(activeTab.id, tabStack);
}

/**
 * Opens the urls, in order, as the tabs of one new window, in the container and private browsing mode of the tab they came from
 *
 * @param {string[]} urls
 * @param {Tab}      [sourceTab]    The tab the links were selected in, defaults to the active tab
 * @return {Promise<void>}
 */
async function OpenUrlsInWindow(urls, sourceTab) {
	if(!urls || urls.length === 0)
		return;

	// Firefox for Android has no windows
	if(!browser.windows)
		return OpenUrlsInTabs(urls);

	sourceTab = sourceTab || (await browser.tabs.query({
		active:        true,
		currentWindow: true,
	}))[0];

	let props = { incognito: Boolean(sourceTab.incognito) },
		rest  = urls.slice(),
		newWindow;

	if(isFirefox)
		props.cookieStoreId = sourceTab.cookieStoreId;

	// The window opens with the first link that can be opened (eg: not an illegal URL)
	while(!newWindow && rest.length) {
		let url = rest.shift();
		try {
			newWindow = await browser.windows.create({ ...props, url });
		} catch(error) {
			console.error(`Error while opening ${url} in a new window: `, error);
		}
	}
	if(!newWindow)
		return;

	// Keep the window the links came from in front, it may have been closed meanwhile
	if(!Prefs.SwitchFocusToNewTab)
		await browser.windows.update(sourceTab.windowId, { focused: true })
			.catch(error => console.error(`Error while focusing window ${sourceTab.windowId}: `, error));

	for(let url of rest) {
		await sleep(Prefs.NewTabDelayMS);

		let tabProps = {
			url:      url,
			active:   false,
			windowId: newWindow.id,
		};

		if(isFirefox) {
			tabProps.cookieStoreId = sourceTab.cookieStoreId;
			if(Prefs.NewTabsOpenUnloaded)
				tabProps.discarded = true;
		}

		try {
			await browser.tabs.create(tabProps);
		} catch(error) {
			// Skip this URL and keep opening the rest
			console.error(`Error while opening ${url} in a new tab: `, error);
		}
	}
}

/**
 * @param {number} tabId
 * @return {Promise<boolean>}
 */
async function TabExists(tabId) {
	try {
		await browser.tabs.get(tabId);
		return true;
	} catch(error) {
		return false;
	}
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
		if(item.LastInstalledVersion && item.LastInstalledVersion.localeCompare('3.1.7', undefined, { numeric: true }) < 0) {
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

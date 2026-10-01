'use strict';

/* global test, expect, describe, beforeEach, jest, require */

const { loadScripts, makeBrowser } = require('./_support/loadScripts');

const Scripts = ['StoragePrefs.js', 'globals.js', 'background-scripts/background.js'];

const flush = () => new Promise(resolve => setImmediate(resolve));

/**
 * A minimal in-memory tab strip: tabs.create() inserts at props.index and renumbers the tabs after it.
 * Tab 2 (index 1) is the active tab; tabs 1 and 3 are its neighbours.
 */
function makeTabStrip() {
	let tabs   = [
		{ id: 1, index: 0, windowId: 7, cookieStoreId: 'c1' },
		{ id: 2, index: 1, windowId: 7, cookieStoreId: 'c2', active: true },
		{ id: 3, index: 2, windowId: 7, cookieStoreId: 'c3' },
	];
	let nextId = 100;

	const renumber = () => tabs.forEach((t, i) => t.index = i);

	return {
		tabs,
		/** URLs in strip order, tabs that were pre-existing show as their id */
		order:  () => tabs.map(t => t.url || `#${t.id}`),
		closeUrl: (url) => { tabs.splice(tabs.findIndex(t => t.url === url), 1); renumber(); },
		api:    {
			query:  jest.fn(async (q) => q.active ? tabs.filter(t => t.active) : tabs.slice()),
			get:    jest.fn(async (id) => {
				let tab = tabs.find(t => t.id === id);
				if(!tab)
					throw new Error(`No tab with id ${id}`);
				return tab;
			}),
			create: jest.fn(async (props) => {
				let tab = { ...props, id: nextId++ };
				tabs.splice(props.index, 0, tab);
				renumber();
				return tab;
			}),
			reload: jest.fn(),
		},
	};
}

let run, browser, strip;

/** Replaces the storage-backed Prefs so each test controls exactly what background.js sees */
const setPrefs = (overrides = {}) => run('(p) => { Prefs = p; }')({
	OpenTabs: run('TABS_OPEN_NATURAL'), SwitchFocusToNewTab: true, NewTabDelayMS: 0, SetOwnershipTabID_FF: false, NewTabsOpenUnloaded: false,
	...overrides,
});

/**
 * @param {object}  [globals]    Extra globals for the scripts' context
 * @param {object}  [stores]     Starting contents of storage.local / storage.sync, in which case the real storage-backed Prefs are kept
 */
const load = async (globals = {}, stores = undefined) => {
	strip   = makeTabStrip();
	browser = {
		...makeBrowser(stores),
		tabs:          strip.api,
		notifications: { create: jest.fn(async () => 'n'), onClicked: { addListener: jest.fn() } },
	};
	browser.runtime = {
		sendMessage:     jest.fn(),
		onMessage:       { addListener: jest.fn(), removeListener: jest.fn() },
		onInstalled:     { addListener: jest.fn() },
		getManifest:     () => ({ version: '3.1.16' }),
		getPlatformInfo: async () => ({ os: 'linux' }),
		reload:          jest.fn(),
	};

	({ run } = loadScripts(Scripts, browser, {
		navigator: { clipboard: { writeText: jest.fn() } },
		chrome:    { runtime: { PlatformOs: { WIN: 'win' } } },
		...globals,
	}));
	await run('DOMReady');

	if(!stores)
		setPrefs();
};

beforeEach(() => load());

describe('OpenUrlsInTabs placement', () => {
	const open = (urls) => run('OpenUrlsInTabs')(urls);

	test('TABS_OPEN_END appends after the last tab', async () => {
		setPrefs({ OpenTabs: run('TABS_OPEN_END') });

		await open(['u1', 'u2']);

		expect(strip.order()).toEqual(['#1', '#2', '#3', 'u1', 'u2']);
	});

	test('TABS_OPEN_RIGHT inserts directly right of the active tab, keeping link order', async () => {
		setPrefs({ OpenTabs: run('TABS_OPEN_RIGHT') });

		await open(['u1', 'u2']);

		expect(strip.order()).toEqual(['#1', '#2', 'u1', 'u2', '#3']);
	});

	test('TABS_OPEN_RIGHT puts every batch right next to the active tab, in front of the previous batch', async () => {
		setPrefs({ OpenTabs: run('TABS_OPEN_RIGHT') });

		await open(['u1']);
		await open(['u2']);

		expect(strip.order()).toEqual(['#1', '#2', 'u2', 'u1', '#3']);
	});

	test('TABS_OPEN_NATURAL continues to the right of the tab it last opened', async () => {
		await open(['u1', 'u2']);
		await open(['u3']);

		expect(strip.order()).toEqual(['#1', '#2', 'u1', 'u2', 'u3', '#3']);
	});

	test('TABS_OPEN_NATURAL skips opened tabs that have since been closed', async () => {
		await open(['u1', 'u2']);
		strip.closeUrl('u2');
		await open(['u3']);

		expect(strip.order()).toEqual(['#1', '#2', 'u1', 'u3', '#3']);
	});

	test('TABS_OPEN_NATURAL falls back to the active tab when every opened tab is gone', async () => {
		await open(['u1']);
		strip.closeUrl('u1');
		await open(['u2']);

		expect(strip.order()).toEqual(['#1', '#2', 'u2', '#3']);
	});
});

describe('OpenUrlsInTabs tab properties', () => {
	const open = (urls) => run('OpenUrlsInTabs')(urls);
	const created = () => strip.api.create.mock.calls.map(([props]) => props);

	test('only the last tab is activated when SwitchFocusToNewTab is set', async () => {
		await open(['u1', 'u2', 'u3']);

		expect(created().map(p => p.active)).toEqual([false, false, true]);
	});

	test('no tab is activated when SwitchFocusToNewTab is off', async () => {
		setPrefs({ SwitchFocusToNewTab: false });

		await open(['u1', 'u2']);

		expect(created().map(p => p.active)).toEqual([false, false]);
	});

	test('tabs open in the active tab\'s window', async () => {
		await open(['u1']);

		expect(created()[0]).toMatchObject({ url: 'u1', windowId: 7 });
	});

	test('Firefox: keeps the container (cookieStoreId) of the active tab', async () => {
		await open(['u1']);

		expect(created()[0].cookieStoreId).toBe('c2');
	});

	test('Firefox: optional opener id and discarded (unloaded) tabs', async () => {
		setPrefs({ SetOwnershipTabID_FF: true, NewTabsOpenUnloaded: true });

		await open(['u1']);

		expect(created()[0]).toMatchObject({ openerTabId: 2, discarded: true });
	});

	test('Firefox options are off by default', async () => {
		await open(['u1']);

		expect(created()[0]).not.toHaveProperty('openerTabId');
		expect(created()[0]).not.toHaveProperty('discarded');
	});

	test('other browsers get none of the Firefox-only properties', async () => {
		await load({ location: { protocol: 'chrome-extension:' } });
		setPrefs({ SetOwnershipTabID_FF: true, NewTabsOpenUnloaded: true });

		await run('OpenUrlsInTabs')(['u1']);

		let props = strip.api.create.mock.calls[0][0];
		expect(props).not.toHaveProperty('cookieStoreId');
		expect(props).not.toHaveProperty('openerTabId');
		expect(props).not.toHaveProperty('discarded');
	});
});

describe('message handling', () => {
	const send = (msg) => run('onMessage')(msg, {}, () => {});

	test('registers its message listener once Prefs are ready', () => {
		expect(browser.runtime.onMessage.addListener).toHaveBeenCalledWith(run('onMessage'));
	});

	test('messages without an Action are ignored', () => {
		expect(() => send({ nothing: true })).not.toThrow();
		expect(strip.api.create).not.toHaveBeenCalled();
	});

	test('OPEN_URLS_IN_TABS batches are processed one after another, in the order received', async () => {
		send({ Action: run('OPEN_URLS_IN_TABS'), tUrls: ['a1', 'a2'] });
		send({ Action: run('OPEN_URLS_IN_TABS'), tUrls: ['b1'] });
		await flush();

		expect(strip.order()).toEqual(['#1', '#2', 'a1', 'a2', 'b1', '#3']);
	});

	test.each([
		['linux', '\n'],
		['win', '\r\n'],
	])('COPY_TO_CLIPBOARD on %s joins URLs with %j', async (os, separator) => {
		let writeText = jest.fn();
		await load({ navigator: { clipboard: { writeText } } });
		browser.runtime.getPlatformInfo = async () => ({ os });

		send({ Action: run('COPY_TO_CLIPBOARD'), tUrls: ['http://a/', 'http://b/'] });
		await flush();

		expect(writeText).toHaveBeenCalledWith(`http://a/${separator}http://b/`);
	});

	test('RELOAD_EXTENSION detaches the listener and reloads the tab and extension', () => {
		send({ Action: run('RELOAD_EXTENSION') });

		expect(browser.runtime.onMessage.removeListener).toHaveBeenCalledWith(run('onMessage'));
		expect(strip.api.reload).toHaveBeenCalledTimes(1);
		expect(browser.runtime.reload).toHaveBeenCalledTimes(1);
	});
});

describe('install and update handling', () => {
	/** Runs the onInstalled handler against the given prior state and waits for CheckInstallation() to finish */
	async function install(stores = {}) {
		await load({}, stores);

		browser.runtime.onInstalled.addListener.mock.calls[0][0]({});
		await flush();
	}

	const notices = () => browser.notifications.create.mock.calls.map(([, opts]) => opts.title);

	test('records the installed version', async () => {
		await install({ local: { LastInstalledVersion: '3.1.15' } });

		expect(browser.storage.local.data.LastInstalledVersion).toBe('3.1.16');
	});

	test('a new version shows the updated notification', async () => {
		await install({ local: { LastInstalledVersion: '3.1.15' } });

		expect(notices()).toEqual(['Snap Links Updated']);
	});

	test('the same version shows no notification', async () => {
		await install({ local: { LastInstalledVersion: '3.1.16' } });

		expect(notices()).toEqual([]);
	});

	test('the ShowUpdateNotification pref silences update notifications', async () => {
		await install({ local: { LastInstalledVersion: '3.1.15' }, sync: { ShowUpdateNotification: false } });

		expect(notices()).toEqual([]);
	});

	test('a fresh install shows the tutorial notification', async () => {
		await install();

		expect(notices()).toEqual(['Snap Links Installed']);
	});

	test('a fresh install completes without logging an error', async () => {
		let errors = [];
		await load({}, {});
		run('(log) => { console.error = (...args) => log.push(args.join(" ")); }')(errors);

		browser.runtime.onInstalled.addListener.mock.calls[0][0]({});
		await flush();

		expect(errors).toEqual([]);
	});

	test('upgrading from before 3.1.7 copies local preferences to sync and selects sync storage', async () => {
		await install({ local: { LastInstalledVersion: '3.1.6', ScrollRate: 20, ActivateMouseButton: 1 } });

		expect(browser.storage.sync.data).toMatchObject({ ScrollRate: 20, ActivateMouseButton: 1, StorageAPI: 'sync', LastInstalledVersion: '3.1.16' });
	});

	test('upgrading from 3.1.7 or later leaves sync storage alone', async () => {
		await install({ local: { LastInstalledVersion: '3.1.7', ScrollRate: 20 } });

		expect(browser.storage.sync.data.ScrollRate).toBeUndefined();
	});
});

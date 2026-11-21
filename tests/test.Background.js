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

/** What load() reports to background.js, change before calling load() */
let platformOs;

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
		browserSettings: {
			contextMenuShowEvent: {
				set:   jest.fn(async () => true),
				clear: jest.fn(async () => true),
			},
		},
	};
	browser.runtime = {
		sendMessage:     jest.fn(),
		onMessage:       { addListener: jest.fn(), removeListener: jest.fn() },
		onInstalled:     { addListener: jest.fn() },
		getManifest:     () => ({ version: '3.1.16' }),
		getPlatformInfo: async () => ({ os: platformOs }),
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

beforeEach(() => {
	platformOs = 'linux';
	return load();
});

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

	test('COPY_TO_CLIPBOARD writes the links in Prefs.CopyFormat with the titles sent along', async () => {
		let writeText = jest.fn();
		await load({ navigator: { clipboard: { writeText } } });
		setPrefs({ CopyFormat: run('COPY_MARKDOWN') });

		send({ Action: run('COPY_TO_CLIPBOARD'), tUrls: ['http://a/', 'http://b/'], tTitles: ['A', ''] });
		await flush();

		expect(writeText).toHaveBeenCalledWith('[A](http://a/)\n[http://b/](http://b/)');
	});

	test('RELOAD_EXTENSION detaches the listener and reloads the tab and extension', () => {
		send({ Action: run('RELOAD_EXTENSION') });

		expect(browser.runtime.onMessage.removeListener).toHaveBeenCalledWith(run('onMessage'));
		expect(strip.api.reload).toHaveBeenCalledTimes(1);
		expect(browser.runtime.reload).toHaveBeenCalledTimes(1);
	});
});

describe('failed tab opens (#578, #579)', () => {
	const send    = (urls) => run('onMessage')({ Action: run('OPEN_URLS_IN_TABS'), tUrls: urls }, {}, () => {});
	const settled = () => run('openUrlsPromiseChain');
	let errors;

	/** Makes tabs.create() throw for the tabs that fail(props) picks, and create the rest */
	const failCreate = (fail) => {
		let create = strip.api.create.getMockImplementation();
		strip.api.create.mockImplementation(async (props) => {
			if(fail(props))
				throw new Error(`Cannot open ${props.url}`);
			return create(props);
		});
	};

	beforeEach(() => {
		errors = [];
		run('(log) => { console.error = (...a) => log.push(a); }')(errors);
	});

	test('a failed request does not block later requests', async () => {
		strip.api.query.mockRejectedValueOnce(new Error('Invalid tab ID: 2'));

		send(['a']);
		send(['b']);
		await settled();

		expect(strip.order()).toEqual(['#1', '#2', 'b', '#3']);
		expect(errors).toHaveLength(1);
	});

	test('an illegal URL is skipped, and the rest of the batch opens with no gap', async () => {
		failCreate(props => props.url === 'bad');

		send(['a', 'bad', 'b']);
		await settled();

		expect(strip.order()).toEqual(['#1', '#2', 'a', 'b', '#3']);
		expect(errors[0][0]).toContain('bad');
	});

	test('openerTabId is set only while the opener tab exists', async () => {
		setPrefs({ SetOwnershipTabID_FF: true });
		failCreate(props => 'openerTabId' in props && !strip.tabs.some(t => t.id === props.openerTabId));
		strip.api.create.mockImplementationOnce(async (props) => {
			strip.tabs.splice(1, 1);	// The opener (active tab 2) closes after the first tab opens
			return { ...props, id: 99 };
		});

		send(['a', 'b', 'c']);
		await settled();

		expect(strip.api.create.mock.calls.map(([p]) => [p.url, p.openerTabId])).toEqual([['a', 2], ['b', undefined], ['c', undefined]]);
		expect(errors).toEqual([]);
	});

	test('a failed tab is logged and not retried', async () => {
		failCreate(() => true);

		send(['a']);
		await settled();

		expect(strip.api.create).toHaveBeenCalledTimes(1);
		expect(errors).toHaveLength(1);
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

describe('FormatLinks (copy formats, #198)', () => {
	const urls   = ['https://a.test/1', 'https://a.test/(2)'],
		titles = ['First <b>&</b> "one"', '[Second]'];
	const format = (constant, eol = '\n', t = titles) => run('FormatLinks')(urls, t, run(constant), eol);

	test.each([
		['COPY_URLS', 'https://a.test/1\nhttps://a.test/(2)'],
		['COPY_TITLES_URLS', 'First <b>&</b> "one"\thttps://a.test/1\n[Second]\thttps://a.test/(2)'],
		['COPY_TITLES', 'First <b>&</b> "one"\n[Second]'],
		['COPY_MARKDOWN', '[First <b>&</b> "one"](https://a.test/1)\n[\\[Second\\]](https://a.test/%282%29)'],
		['COPY_HTML', '<a href="https://a.test/1">First &lt;b&gt;&amp;&lt;/b&gt; &quot;one&quot;</a>\n<a href="https://a.test/(2)">[Second]</a>'],
		['COPY_HTML_LIST', '<ul>\n\t<li><a href="https://a.test/1">First &lt;b&gt;&amp;&lt;/b&gt; &quot;one&quot;</a></li>\n\t<li><a href="https://a.test/(2)">[Second]</a></li>\n</ul>'],
		['COPY_URLS_SPACED', 'https://a.test/1 https://a.test/(2)'],
	])('%s', (constant, expected) => {
		expect(format(constant)).toBe(expected);
	});

	test('uses the given line separator', () => {
		expect(format('COPY_TITLES_URLS', '\r\n')).toBe('First <b>&</b> "one"\thttps://a.test/1\r\n[Second]\thttps://a.test/(2)');
	});

	test('a link without a title is titled by its URL', () => {
		expect(format('COPY_TITLES', '\n', ['', undefined])).toBe('https://a.test/1\nhttps://a.test/(2)');
		expect(run('FormatLinks')(urls, undefined, run('COPY_TITLES'), '\n')).toBe('https://a.test/1\nhttps://a.test/(2)');
	});

	test('an unknown format copies URLs', () => {
		expect(run('FormatLinks')(urls, titles, 'Nonsense', '\n')).toBe('https://a.test/1\nhttps://a.test/(2)');
	});
});

describe('OpenUrlsInWindow (#182)', () => {
	const source = { id: 2, windowId: 7, cookieStoreId: 'c2', incognito: false };
	let windows;

	beforeEach(() => {
		windows = {
			create: jest.fn(async (props) => ({ id: 50, ...props })),
			update: jest.fn(async () => ({})),
		};
		browser.windows = windows;
	});

	const open = (urls, tab = source) => run('OpenUrlsInWindow')(urls, tab);

	test('opens the first link as a new window and the rest as its tabs, in order, in the source tab\'s container', async () => {
		await open(['u1', 'u2', 'u3']);

		expect(windows.create).toHaveBeenCalledWith({ url: 'u1', incognito: false, cookieStoreId: 'c2' });
		expect(strip.api.create.mock.calls.map(([p]) => p)).toEqual([
			{ url: 'u2', active: false, windowId: 50, cookieStoreId: 'c2' },
			{ url: 'u3', active: false, windowId: 50, cookieStoreId: 'c2' },
		]);
	});

	test('a private window opens private', async () => {
		await open(['u1'], { ...source, incognito: true, cookieStoreId: 'firefox-private' });

		expect(windows.create).toHaveBeenCalledWith({ url: 'u1', incognito: true, cookieStoreId: 'firefox-private' });
	});

	test.each([
		[true, 0],
		[false, 1],
	])('SwitchFocusToNewTab=%s → refocuses the source window %i time(s)', async (focusNew, calls) => {
		setPrefs({ SwitchFocusToNewTab: focusNew });

		await open(['u1', 'u2']);

		expect(windows.update).toHaveBeenCalledTimes(calls);
		if(calls)
			expect(windows.update).toHaveBeenCalledWith(7, { focused: true });
	});

	test('NewTabsOpenUnloaded opens the extra tabs discarded', async () => {
		setPrefs({ NewTabsOpenUnloaded: true });

		await open(['u1', 'u2']);

		expect(strip.api.create.mock.calls[0][0].discarded).toBe(true);
	});

	test('without a source tab, uses the active tab', async () => {
		await run('OpenUrlsInWindow')(['u1']);

		expect(strip.api.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
		expect(windows.create).toHaveBeenCalledWith({ url: 'u1', incognito: false, cookieStoreId: 'c2' });
	});

	test('does nothing for no links', async () => {
		await open([]);

		expect(windows.create).not.toHaveBeenCalled();
	});

	describe('failures (as #578, #579 for tabs)', () => {
		let errors;

		beforeEach(() => {
			errors = [];
			run('(log) => { console.error = (...a) => log.push(a); }')(errors);
		});

		/** Makes create() throw for the URLs fail(url) picks */
		const failFor = (mock, fail) => {
			let create = mock.getMockImplementation();
			mock.mockImplementation(async (props) => {
				if(fail(props.url))
					throw new Error(`Cannot open ${props.url}`);
				return create(props);
			});
		};

		test('a failed window request does not block later requests', async () => {
			windows.create.mockRejectedValueOnce(new Error('Window failed'));

			run('onMessage')({ Action: run('OPEN_URLS_IN_WINDOW'), tUrls: ['w1'] }, { tab: source }, () => {});
			run('onMessage')({ Action: run('OPEN_URLS_IN_TABS'), tUrls: ['a1'] }, { tab: source }, () => {});
			await run('openUrlsPromiseChain');

			expect(strip.api.create.mock.calls.map(([p]) => p.url)).toEqual(['a1']);
			expect(errors).toHaveLength(1);
		});

		test('a link that cannot open as a tab is skipped, and the rest still open', async () => {
			failFor(strip.api.create, url => url === 'bad');

			await open(['u1', 'bad', 'u3']);

			expect(strip.order()).toContain('u3');
			expect(errors[0][0]).toContain('bad');
		});

		test('when the first link cannot open a window, the next one does', async () => {
			failFor(windows.create, url => url === 'bad');

			await open(['bad', 'u2', 'u3']);

			expect(windows.create).toHaveBeenLastCalledWith({ url: 'u2', incognito: false, cookieStoreId: 'c2' });
			expect(strip.api.create.mock.calls.map(([p]) => p.url)).toEqual(['u3']);
		});

		test('a closed source window does not stop the rest of the links', async () => {
			setPrefs({ SwitchFocusToNewTab: false });
			windows.update.mockRejectedValueOnce(new Error('Invalid window ID: 7'));

			await open(['u1', 'u2']);

			expect(strip.api.create.mock.calls.map(([p]) => p.url)).toEqual(['u2']);
		});
	});

	test('without the windows API (Firefox for Android), the links open as tabs', async () => {
		delete browser.windows;

		await open(['u1', 'u2']);

		expect(strip.order()).toEqual(['#1', '#2', 'u1', 'u2', '#3']);
	});

	test('OPEN_URLS_IN_WINDOW messages use the sending tab and share the queue with OPEN_URLS_IN_TABS', async () => {
		run('onMessage')({ Action: run('OPEN_URLS_IN_TABS'), tUrls: ['a1'] }, { tab: source }, () => {});
		run('onMessage')({ Action: run('OPEN_URLS_IN_WINDOW'), tUrls: ['w1', 'w2'] }, { tab: { ...source, cookieStoreId: 'c9' } }, () => {});
		await flush();
		await flush();

		expect(strip.api.create.mock.calls.map(([p]) => p.url)).toEqual(['a1', 'w2']);
		expect(windows.create).toHaveBeenCalledWith({ url: 'w1', incognito: false, cookieStoreId: 'c9' });
	});
});

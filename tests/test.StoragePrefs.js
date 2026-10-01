'use strict';

/* global test, expect, describe, jest, require */

const { loadScripts, makeBrowser } = require('./_support/loadScripts');

const Defaults = { Alpha: 1, Beta: 'b', StorageAPI: 'sync' };

/** Loads the scripts against the given stored data and constructs a StoragePrefs */
async function setup(stores = {}, options = { StorageAPI: 'auto' }) {
	let { run, browser } = loadScripts(['StoragePrefs.js', 'globals.js'], makeBrowser(stores));
	let prefs            = run('(Defaults, options) => new StoragePrefs(Defaults, options)')(Defaults, options);

	await prefs.Ready;

	return { prefs, browser, run };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

describe('reading values', () => {
	test('returns defaults when nothing is stored', async () => {
		let { prefs } = await setup();

		expect(prefs.Alpha).toBe(1);
		expect(prefs.Beta).toBe('b');
	});

	test('stored values override defaults', async () => {
		let { prefs } = await setup({ sync: { Alpha: 42 } });

		expect(prefs.Alpha).toBe(42);
		expect(prefs.Beta).toBe('b');
	});

	test('a key missing from the defaults throws, naming the key', async () => {
		let { prefs } = await setup();

		expect(() => prefs.Gamma).toThrow('StoragePrefs.Gamma cannot be retrieved, not present in Defaults');
	});

	test('reading before Ready returns the default', () => {
		let { run } = loadScripts(['StoragePrefs.js', 'globals.js']);
		let prefs   = run('(Defaults) => new StoragePrefs(Defaults, { StorageAPI: "auto" })')(Defaults);

		expect(prefs.Alpha).toBe(1);
	});
});

describe('choosing the storage area', () => {
	test('auto uses sync when local has no preference', async () => {
		let { prefs } = await setup({ sync: { Alpha: 'from-sync' }, local: { Alpha: 'from-local' } });

		expect(prefs.Alpha).toBe('from-sync');
	});

	test('auto follows StorageAPI=local recorded in local storage', async () => {
		let { prefs } = await setup({ sync: { Alpha: 'from-sync' }, local: { Alpha: 'from-local', StorageAPI: 'local' } });

		expect(prefs.Alpha).toBe('from-local');
	});

	test('auto falls back to sync when the recorded value is invalid', async () => {
		let { prefs } = await setup({ sync: { Alpha: 'from-sync' }, local: { StorageAPI: 'bogus' } });

		expect(prefs.Alpha).toBe('from-sync');
	});

	test('an explicit StorageAPI is honored over the recorded one', async () => {
		let { prefs } = await setup({ sync: { Alpha: 'from-sync' }, local: { Alpha: 'from-local', StorageAPI: 'sync' } }, { StorageAPI: 'local' });

		expect(prefs.Alpha).toBe('from-local');
	});
});

describe('writing values', () => {
	test('set persists to the active storage area only', async () => {
		let { prefs, browser } = await setup();

		prefs.Alpha = 7;
		await flush();

		expect(browser.storage.sync.data.Alpha).toBe(7);
		expect(browser.storage.local.data.Alpha).toBeUndefined();
	});

	test('setting a key missing from the defaults throws, naming the key', async () => {
		let { prefs } = await setup();

		expect(() => { prefs.Gamma = 1; }).toThrow('StoragePrefs.Gamma cannot be set to \'1\', not present Defaults');
	});
});

describe('change notifications', () => {
	test('observer receives changes from the active area', async () => {
		let { prefs, browser } = await setup();
		let observer           = jest.fn();
		prefs.onChanged(observer);

		browser.fireStorageChanged({ Alpha: { newValue: 9, oldValue: 1 } }, 'sync');

		expect(observer).toHaveBeenCalledWith('Alpha', 9, 1);
		expect(prefs.Alpha).toBe(9);
	});

	test('changes in the inactive area are ignored', async () => {
		let { prefs, browser } = await setup();
		let observer           = jest.fn();
		prefs.onChanged(observer);

		browser.fireStorageChanged({ Alpha: { newValue: 9, oldValue: 1 } }, 'local');

		expect(observer).not.toHaveBeenCalled();
		expect(prefs.Alpha).toBe(1);
	});

	test('keys outside the defaults are ignored', async () => {
		let { prefs, browser } = await setup();
		let observer           = jest.fn();
		prefs.onChanged(observer);

		browser.fireStorageChanged({ Unknown: { newValue: 1, oldValue: 0 } }, 'sync');

		expect(observer).not.toHaveBeenCalled();
	});

	test('cancel stops further notifications', async () => {
		let { prefs, browser } = await setup();
		let observer           = jest.fn();
		prefs.onChanged(observer).cancel();

		browser.fireStorageChanged({ Alpha: { newValue: 9, oldValue: 1 } }, 'sync');

		expect(observer).not.toHaveBeenCalled();
	});
});

describe('MigratePrefs (globals.js)', () => {
	const migrate = async (sync) => {
		let loaded = loadScripts(['StoragePrefs.js', 'globals.js'], makeBrowser({ sync }));
		await loaded.run('DOMReady');
		return loaded;
	};

	test('a stored OpenTabsAtEndOfTabBar=true becomes OpenTabs=TABS_OPEN_END, and the legacy key is removed', async () => {
		let { run, browser } = await migrate({ OpenTabsAtEndOfTabBar: true });

		expect(browser.storage.sync.data).toEqual({ OpenTabs: run('TABS_OPEN_END') });
		expect(run('Prefs.OpenTabs')).toBe(run('TABS_OPEN_END'));
	});

	test('a stored OpenTabsAtEndOfTabBar=false is removed without changing OpenTabs', async () => {
		let { run, browser } = await migrate({ OpenTabsAtEndOfTabBar: false });

		expect(browser.storage.sync.data).toEqual({});
		expect(run('Prefs.OpenTabs')).toBe(run('TABS_OPEN_NATURAL'));
	});

	test('with no legacy key stored, nothing is written and OpenTabs keeps its stored value', async () => {
		let { run, browser } = await migrate({ OpenTabs: 'OpenTabsToRight' });

		expect(browser.storage.sync.set).not.toHaveBeenCalled();
		expect(browser.storage.sync.remove).not.toHaveBeenCalled();
		expect(run('Prefs.OpenTabs')).toBe('OpenTabsToRight');
	});

	test('a failing migration is logged with context and does not leave DOMReady pending', async () => {
		let browser = makeBrowser({ sync: { OpenTabsAtEndOfTabBar: true } });
		browser.storage.sync.set.mockRejectedValue(new Error('quota exceeded'));
		let { run } = loadScripts(['StoragePrefs.js', 'globals.js'], browser);
		run('console.error = (...a) => { globalThis.__errors = (globalThis.__errors || []).concat(a); }');

		await run('DOMReady');

		expect(run('globalThis.__errors')[0]).toMatch(/MigratePrefs\(\) failed.*quota exceeded/);
	});
});

'use strict';

/* global jest, test, expect, require, describe, beforeEach, __dirname */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../src/background-scripts/background.js'), 'utf8');

/**
 * Loads background.js into a fresh context with a mocked browser API
 *
 * @param {object} options
 * @param {function} options.create    Implementation of browser.tabs.create()
 * @param {number[]} options.tabIds    The ids of the tabs that exist
 * @param {object} options.prefs        Prefs to override
 */
function LoadBackground({ create, tabIds = [1], prefs = {} }) {
	const browser = {
		runtime: {
			onMessage:   { addListener: jest.fn() },
			onInstalled: { addListener: jest.fn() },
		},
		tabs:    {
			query:  jest.fn(async () => [{ id: 1, index: 0, windowId: 1, cookieStoreId: 'firefox-default' }]),
			get:    jest.fn(async (tabId) => {
				if(!tabIds.includes(tabId))
					throw new Error(`Invalid tab ID: ${tabId}`);
				return { id: tabId, index: 0 };
			}),
			create: jest.fn(create),
		},
	};

	const context = vm.createContext({
		browser,
		console:           { log: jest.fn(), error: jest.fn() },
		DOMReady:          new Promise(() => {}),
		Prefs:             {
			OpenTabs:             'OpenTabsToRight',
			SwitchFocusToNewTab:  true,
			SetOwnershipTabID_FF: true,
			NewTabDelayMS:        0,
			...prefs,
		},
		isFirefox:         true,
		sleep:             async () => {},
		BACKGROUND_TEST:   'BackgroundTest',
		RELOAD_EXTENSION:  'ReloadExtension',
		OPEN_URLS_IN_TABS: 'OpenUrlsInTabs',
		COPY_TO_CLIPBOARD: 'CopyToClipboard',
		TABS_OPEN_END:     'OpenTabsAtEnd',
		TABS_OPEN_RIGHT:   'OpenTabsToRight',
		TABS_OPEN_NATURAL: 'OpenTabsNaturally',
	});
	vm.runInContext(source, context);

	return {
		browser,
		console: context.console,
		/** Sends an OPEN_URLS_IN_TABS message and waits until the queue has handled it */
		async OpenUrls(tUrls) {
			vm.runInContext('onMessage', context)({ Action: 'OpenUrlsInTabs', tUrls });
			await vm.runInContext('openUrlsPromiseChain', context);
		},
	};
}

let nextTabId;

beforeEach(() => {
	nextTabId = 100;
});

describe('OPEN_URLS_IN_TABS', () => {
	test('a failed request does not block later requests', async () => {
		const bg = LoadBackground({
			create: async () => ({ id: nextTabId++ }),
		});
		bg.browser.tabs.query.mockRejectedValueOnce(new Error('Invalid tab ID: 1'));

		await bg.OpenUrls(['https://a.example/']);
		await bg.OpenUrls(['https://b.example/']);

		expect(bg.browser.tabs.create.mock.calls.map(([props]) => props.url))
			.toEqual(['https://b.example/']);
		expect(bg.console.error)
			.toHaveBeenCalledWith('Error while opening URLs in tabs: ', expect.any(Error));
	});

	test('an illegal URL is skipped and the rest of the batch still opens', async () => {
		const opened = [];
		const bg     = LoadBackground({
			create: async (props) => {
				if(props.url === 'https://example%5B.%5Dcom/')
					throw new Error(`Illegal URL: ${props.url}`);
				opened.push(props);
				return { id: nextTabId++ };
			},
		});

		await bg.OpenUrls(['https://a.example/', 'https://example%5B.%5Dcom/', 'https://b.example/']);

		expect(opened.map(props => props.url))
			.toEqual(['https://a.example/', 'https://b.example/']);
		// The skipped URL doesn't leave a gap in the tab positions
		expect(opened.map(props => props.index))
			.toEqual([1, 2]);
	});

	test('openerTabId is only set while the opener tab still exists', async () => {
		const tabIds = [1];
		const opened = [];
		const bg     = LoadBackground({
			tabIds,
			create: async (props) => {
				if('openerTabId' in props && !tabIds.includes(props.openerTabId))
					throw new Error(`Invalid tab ID: ${props.openerTabId}`);
				opened.push({ ...props });
				// Close the opener tab while the batch is still opening
				if(opened.length === 1)
					tabIds.splice(tabIds.indexOf(1), 1);
				return { id: nextTabId++ };
			},
		});

		await bg.OpenUrls(['https://a.example/', 'https://b.example/', 'https://c.example/']);

		expect(opened.map(props => [props.url, props.openerTabId]))
			.toEqual([
				['https://a.example/', 1],
				['https://b.example/', undefined],
				['https://c.example/', undefined],
			]);
		// tabs.create() is never called with the closed opener tab
		expect(bg.browser.tabs.create)
			.toHaveBeenCalledTimes(3);
		expect(bg.console.error)
			.not.toHaveBeenCalled();
	});

	test('a failed tab is logged and not retried', async () => {
		const bg = LoadBackground({
			create: async () => {
				throw new Error('Some other error');
			},
		});

		await bg.OpenUrls(['https://a.example/']);

		expect(bg.browser.tabs.create)
			.toHaveBeenCalledTimes(1);
		expect(bg.console.error)
			.toHaveBeenCalledWith('Error while opening https://a.example/ in a new tab: ', expect.any(Error));
	});
});

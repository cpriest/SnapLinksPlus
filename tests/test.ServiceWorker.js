'use strict';

/* global test, expect, describe, beforeEach, jest, require, __dirname */

/*
 * Chrome's background is a service worker (Manifest V3): service-worker.js loads the background scripts with importScripts(),
 * and there is no document, no window and no clipboard.  This runs the real files that way.
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const { makeBrowser } = require('./_support/loadScripts');

const SrcDir = path.resolve(__dirname, '../src');
const Worker = 'background-scripts/service-worker.js';

const flush = () => new Promise(resolve => setImmediate(resolve));

let ctx, run, browser, chrome, imported;

/** Starts the worker the way Chrome does: one script, which imports the others relative to itself */
function startWorker({ manifest = { commands: {} }, stores } = {}) {
	browser  = makeBrowser(stores);
	imported = [];
	Object.assign(browser.runtime, {
		onMessage:       { addListener: jest.fn(), removeListener: jest.fn() },
		onInstalled:     { addListener: jest.fn() },
		getPlatformInfo: jest.fn(async () => ({ os: 'win' })),
		getURL:          (file) => `chrome-extension://snaplinks/${file}`,
		sendMessage:     jest.fn(async () => true),
	});
	browser.notifications = { create: jest.fn(async () => 'n'), onClicked: { addListener: jest.fn() } };
	browser.commands      = { onCommand: { addListener: jest.fn() } };	// DevBuild.js
	browser.tabs          = { query: jest.fn(async () => [{ id: 1, index: 0, windowId: 1 }]), create: jest.fn(async (p) => ({ id: 9, ...p })), get: jest.fn() };

	chrome = {
		runtime:   { getManifest: () => manifest, PlatformOs: { WIN: 'win' }, getContexts: jest.fn(async () => []) },
		offscreen: { createDocument: jest.fn(async () => {}), closeDocument: jest.fn(async () => {}) },
	};

	ctx = vm.createContext({
		browser, chrome,
		location:  { protocol: 'chrome-extension:' },
		navigator: {},			// A worker's navigator has no clipboard
		setTimeout, clearTimeout, setInterval, clearInterval,
		importScripts: (...files) => {
			for(let file of files) {
				let src = path.posix.join(path.posix.dirname(Worker), file);
				imported.push(src);
				if(src !== 'lib/browser-polyfill.js')	// Copied in by the build; `browser` is the mock here
					vm.runInContext(fs.readFileSync(path.join(SrcDir, src), 'utf8'), ctx, { filename: src });
			}
		},
	});
	vm.runInContext('console = { log() {}, info() {}, warn() {}, error() {} };', ctx);
	run = (expr) => vm.runInContext(expr, ctx);

	run(fs.readFileSync(path.join(SrcDir, Worker), 'utf8'));
	return run('DOMReady');
}

describe('the service worker', () => {
	test('loads the polyfill and the background scripts, in manifest order, with no document', async () => {
		await startWorker();

		expect(imported).toEqual(['lib/browser-polyfill.js', 'StoragePrefs.js', 'globals.js', 'background-scripts/OffscreenClipboard.js', 'background-scripts/background.js']);
		expect(run('typeof document')).toBe('undefined');
		expect(run('docElem')).toBeUndefined();
		expect(run('isChrome')).toBe(true);
	});

	test('a DevBuild loads DevBuild.js before the background scripts', async () => {
		await startWorker({ manifest: { commands: { 'dev-do-1': {} } } });

		expect(imported.slice(-3)).toEqual(['background-scripts/DevBuild.js', 'background-scripts/OffscreenClipboard.js', 'background-scripts/background.js']);
		expect(browser.commands.onCommand.addListener).toHaveBeenCalledTimes(1);
	});

	test('loads Prefs from storage without waiting for a document', async () => {
		await startWorker({ stores: { sync: { OpenTabs: 'OpenTabsAtEnd' } } });

		expect(run('Prefs.OpenTabs')).toBe('OpenTabsAtEnd');
	});

	test('adds its listeners when it starts, so that their events start a stopped worker', async () => {
		await startWorker();

		expect(browser.runtime.onMessage.addListener).toHaveBeenCalledWith(run('onMessage'));
		expect(browser.runtime.onInstalled.addListener).toHaveBeenCalledTimes(1);
		expect(browser.notifications.onClicked.addListener).toHaveBeenCalledWith(run('onNotificationClicked'));
	});

	test('notification icons are full URLs: a worker resolves a relative one from its own folder', async () => {
		await startWorker();

		run('Notify')('SnapLinksUpdated', 'Title', 'Message');

		expect(browser.notifications.create.mock.calls[0][1].iconUrl).toBe('chrome-extension://snaplinks/res/SnapLinksLogo32.png');
	});
});

describe('copying from the service worker, through an offscreen document', () => {
	beforeEach(() => startWorker());

	const copied = () => browser.runtime.sendMessage.mock.calls.filter(([msg]) => msg.Action === 'OffscreenCopy').map(([msg]) => msg.text);

	test('opens the offscreen document, has it copy the links, and closes it', async () => {
		run('onMessage')({ Action: run('COPY_TO_CLIPBOARD'), tUrls: ['http://a/', 'http://b/'] }, {}, () => {});
		await flush();
		await run('clipboardChain');

		expect(chrome.offscreen.createDocument).toHaveBeenCalledWith(expect.objectContaining({ url: 'src/html/offscreen.html', reasons: ['CLIPBOARD'] }));
		expect(copied()).toEqual(['http://a/\r\nhttp://b/']);
		expect(chrome.offscreen.closeDocument).toHaveBeenCalledTimes(1);
	});

	test('uses a document left open by a worker that stopped during a copy', async () => {
		chrome.runtime.getContexts.mockResolvedValueOnce([{ contextType: 'OFFSCREEN_DOCUMENT' }]);

		await run('WriteToClipboard')('text');

		expect(chrome.runtime.getContexts).toHaveBeenCalledWith({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: ['chrome-extension://snaplinks/src/html/offscreen.html'] });
		expect(chrome.offscreen.createDocument).not.toHaveBeenCalled();
		expect(copied()).toEqual(['text']);
	});

	test('copies one at a time, so there is never a second document', async () => {
		let open = 0, most = 0;
		chrome.offscreen.createDocument.mockImplementation(async () => { most = Math.max(most, ++open); });
		chrome.offscreen.closeDocument.mockImplementation(async () => { open--; });

		await Promise.all([run('WriteToClipboard')('one'), run('WriteToClipboard')('two')]);

		expect(copied()).toEqual(['one', 'two']);
		expect(most).toBe(1);
	});

	test('a failed copy is logged, closes the document, and the next copy still works', async () => {
		let errors = [];
		run('(log) => { console.error = (...args) => log.push(args); }')(errors);
		browser.runtime.sendMessage.mockResolvedValueOnce(false);

		await run('WriteToClipboard')('fails');
		await run('WriteToClipboard')('works');

		expect(errors).toHaveLength(1);
		expect(chrome.offscreen.closeDocument).toHaveBeenCalledTimes(2);
		expect(copied()).toEqual(['fails', 'works']);
	});
});

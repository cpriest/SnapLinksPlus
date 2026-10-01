'use strict';

/* global test, expect, describe, beforeEach, jest, require */

const { loadScripts } = require('./_support/loadScripts');

const Scripts = ['StoragePrefs.js', 'globals.js', 'content-scripts/CategorizedCollection.js', 'content-scripts/ActionMgr.js'];

let browser, run, actions;

/** Replaces the storage-backed Prefs with plain values so each test controls exactly what ActionMgr sees */
function setPrefs(overrides = {}) {
	let prefs = Object.assign({ DevMode: false, DefaultAction: run('OPEN_LINKS'), ClickDelayMS: 0 }, overrides);
	run('(p) => { Prefs = p; }')(prefs);
}

/** @return {{href: string}[]} */
const links = (...hrefs) => hrefs.map(href => ({ href }));

/** A stand-in for a CategorizedCollection, ActUpon only reads GreatestType and the matching list */
const collection = (GreatestType, props) => ({ GreatestType, ...props });

const checkbox = (checked) => ({ checked, click: jest.fn() });

beforeEach(async () => {
	({ run, browser } = loadScripts(Scripts));
	await run('DOMReady');
	actions = new (run('ActionMgr'))();
	setPrefs();
});

describe('ActUpon links', () => {
	const urls = ['http://a/', 'http://b/', 'http://a/', 'http://c/', 'http://b/'];

	test.each([
		['open',  'OPEN_LINKS', false, 'OpenUrlsInTabs'],
		['open',  'OPEN_LINKS', true,  'CopyToClipboard'],
		['copy',  'COPY_LINKS', false, 'CopyToClipboard'],
		['copy',  'COPY_LINKS', true,  'OpenUrlsInTabs'],
	])('default action %s, ctrlKey=%s → %s', (_label, defaultAction, ctrlKey, expectedAction) => {
		setPrefs({ DefaultAction: run(defaultAction) });

		actions.ActUpon(collection(run('CT_LINKS'), { Links: links(...urls) }), { ctrlKey });

		expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(1);
		expect(browser.runtime.sendMessage.mock.calls[0][0].Action).toBe(run(expectedAction === 'OpenUrlsInTabs' ? 'OPEN_URLS_IN_TABS' : 'COPY_TO_CLIPBOARD'));
	});

	test('removes duplicate hrefs, keeping first-seen order', () => {
		actions.ActUpon(collection(run('CT_LINKS'), { Links: links(...urls) }), { ctrlKey: false });

		expect(browser.runtime.sendMessage.mock.calls[0][0].tUrls).toEqual(['http://a/', 'http://b/', 'http://c/']);
	});

	test('Dev_Skip_AllActions suppresses the message in DevMode only', () => {
		setPrefs({ DevMode: true, Dev_Skip_AllActions: true });
		actions.ActUpon(collection(run('CT_LINKS'), { Links: links('http://a/') }), { ctrlKey: false });
		expect(browser.runtime.sendMessage).not.toHaveBeenCalled();

		setPrefs({ DevMode: false, Dev_Skip_AllActions: true });
		actions.ActUpon(collection(run('CT_LINKS'), { Links: links('http://a/') }), { ctrlKey: false });
		expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(1);
	});
});

describe('ToggleCheckboxes', () => {
	test('majority checked → unchecks the checked ones', () => {
		let [a, b, c] = [checkbox(true), checkbox(true), checkbox(false)];

		actions.ToggleCheckboxes([a, b, c]);

		expect([a, b, c].map(cb => cb.click.mock.calls.length)).toEqual([1, 1, 0]);
	});

	test('majority unchecked → checks the unchecked ones', () => {
		let [a, b, c] = [checkbox(true), checkbox(false), checkbox(false)];

		actions.ToggleCheckboxes([a, b, c]);

		expect([a, b, c].map(cb => cb.click.mock.calls.length)).toEqual([0, 1, 1]);
	});

	test('a tie prefers checking', () => {
		let [a, b] = [checkbox(true), checkbox(false)];

		actions.ToggleCheckboxes([a, b]);

		expect([a, b].map(cb => cb.click.mock.calls.length)).toEqual([0, 1]);
	});

	test('all checked → unchecks all', () => {
		let boxes = [checkbox(true), checkbox(true)];

		actions.ToggleCheckboxes(boxes);

		expect(boxes.every(cb => cb.click.mock.calls.length === 1)).toBe(true);
	});

	test('is reached through ActUpon for CT_CHECKBOXES', () => {
		let [a, b] = [checkbox(false), checkbox(false)];

		actions.ActUpon(collection(run('CT_CHECKBOXES'), { Checkboxes: [a, b] }), {});

		expect(a.click).toHaveBeenCalledTimes(1);
		expect(b.click).toHaveBeenCalledTimes(1);
	});
});

describe('SelectRadioButton', () => {
	test('clicks only the first button of each named group', () => {
		let radio = (name) => ({ name, click: jest.fn() });
		let [a1, a2, b1, b2] = [radio('a'), radio('a'), radio('b'), radio('b')];

		actions.ActUpon(collection(run('CT_RADIOBUTTONS'), { RadioButtons: [a1, b1, a2, b2] }), {});

		expect([a1, a2, b1, b2].map(r => r.click.mock.calls.length)).toEqual([1, 0, 1, 0]);
	});
});

describe('ClickElements', () => {
	test('clicks every element in order', async () => {
		let order = [];
		let elems = ['x', 'y', 'z'].map(id => ({ click: () => order.push(id) }));

		await actions.ClickElements(elems);

		expect(order).toEqual(['x', 'y', 'z']);
	});

	test('is reached through ActUpon for CT_CLICKABLE', async () => {
		let elem = { click: jest.fn() };

		actions.ActUpon(collection(run('CT_CLICKABLE'), { Clickable: [elem] }), {});
		await new Promise(resolve => setImmediate(resolve));

		expect(elem.click).toHaveBeenCalledTimes(1);
	});
});

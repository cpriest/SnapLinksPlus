'use strict';

/* global test, expect, describe, beforeEach, jest, require, URL, URLSearchParams */

const { loadScripts } = require('./_support/loadScripts');

const Scripts = ['StoragePrefs.js', 'globals.js', 'content-scripts/Utility.js', 'content-scripts/CategorizedCollection.js', 'content-scripts/ActionMgr.js'];

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
	({ run, browser } = loadScripts(Scripts, undefined, { URL, URLSearchParams }));
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

	test.each([
		[false, 'OPEN_URLS_IN_WINDOW'],
		[true, 'COPY_TO_CLIPBOARD'],
	])('default action open in a new window, ctrlKey=%s → %s', (ctrlKey, expectedAction) => {
		setPrefs({ DefaultAction: run('OPEN_IN_WINDOW') });

		actions.ActUpon(collection(run('CT_LINKS'), { Links: links(...urls) }), { ctrlKey });

		expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(1);
		expect(browser.runtime.sendMessage.mock.calls[0][0]).toMatchObject({ Action: run(expectedAction), tUrls: ['http://a/', 'http://b/', 'http://c/'] });
	});

	test.each([
		[false, 'OPEN_URLS_IN_SEPARATE_WINDOWS'],
		[true, 'COPY_TO_CLIPBOARD'],
	])('default action open each link in its own window, ctrlKey=%s → %s', (ctrlKey, expectedAction) => {
		setPrefs({ DefaultAction: run('OPEN_IN_SEPARATE_WINDOWS') });

		actions.ActUpon(collection(run('CT_LINKS'), { Links: links(...urls) }), { ctrlKey });

		expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(1);
		expect(browser.runtime.sendMessage.mock.calls[0][0]).toMatchObject({ Action: run(expectedAction), tUrls: ['http://a/', 'http://b/', 'http://c/'] });
	});

	test('removes duplicate hrefs, keeping first-seen order', () => {
		actions.ActUpon(collection(run('CT_LINKS'), { Links: links(...urls) }), { ctrlKey: false });

		expect(browser.runtime.sendMessage.mock.calls[0][0].tUrls).toEqual(['http://a/', 'http://b/', 'http://c/']);
	});

	test('with SmartDuplicateDetection, sends the first-seen href of each page', () => {
		setPrefs({ SmartDuplicateDetection: true });

		actions.ActUpon(collection(run('CT_LINKS'), {
			Links: links('https://a.test/x?utm_source=feed', 'https://a.test/x#comments', 'https://a.test/y', 'http://www.a.test/x/'),
		}), { ctrlKey: false });

		expect(browser.runtime.sendMessage.mock.calls[0][0].tUrls).toEqual(['https://a.test/x?utm_source=feed', 'https://a.test/y']);
	});

	test('copying sends the title of the link to each URL that shows the most text', () => {
		let selected = [
			{ href: 'http://a/', innerText: '  Article\n  title ' },
			{ href: 'http://b/', innerText: '', getAttribute: (name) => name === 'title' ? 'Tooltip' : null },
			{ href: 'http://a/', innerText: 'comments' },
			{ href: 'http://c/', innerText: '', getAttribute: () => null, querySelector: () => ({ alt: ' Logo ' }) },
			{ href: 'http://d/' },
		];

		actions.ActUpon(collection(run('CT_LINKS'), { Links: selected }), { ctrlKey: true });

		expect(browser.runtime.sendMessage.mock.calls[0][0]).toEqual({
			Action:  run('COPY_TO_CLIPBOARD'),
			tUrls:   ['http://a/', 'http://b/', 'http://c/', 'http://d/'],
			tTitles: ['Article title', 'Tooltip', 'Logo', ''],
		});
	});

	test('the title of a video is its title link, not the duration shown on its thumbnail link', () => {
		let selected = [{ href: 'http://v/1', innerText: '12:34' }, { href: 'http://v/1', innerText: 'Video one' }];

		actions.ActUpon(collection(run('CT_LINKS'), { Links: selected }), { ctrlKey: true });

		expect(browser.runtime.sendMessage.mock.calls[0][0].tTitles).toEqual(['Video one']);
	});

	test('a link that shows text wins over a longer tooltip of a link that shows none', () => {
		let thumb = { href: 'http://v/1', innerText: '', getAttribute: (name) => name === 'title' ? 'A much longer tooltip' : null };

		actions.ActUpon(collection(run('CT_LINKS'), { Links: [thumb, { href: 'http://v/1', innerText: 'Hi' }] }), { ctrlKey: true });

		expect(browser.runtime.sendMessage.mock.calls[0][0].tTitles).toEqual(['Hi']);
	});

	test.each([
		[false, 'BOOKMARK_LINKS_IN_FOLDER'],
		[true, 'COPY_TO_CLIPBOARD'],
	])('default action bookmark, ctrlKey=%s → %s with titles', (ctrlKey, expectedAction) => {
		setPrefs({ DefaultAction: run('BOOKMARK_LINKS') });

		actions.ActUpon(collection(run('CT_LINKS'), { Links: [{ href: 'http://a/', innerText: 'A' }, { href: 'http://b/', innerText: '' }] }), { ctrlKey });

		expect(browser.runtime.sendMessage.mock.calls).toEqual([[{ Action: run(expectedAction), tUrls: ['http://a/', 'http://b/'], tTitles: ['A', ''] }]]);
	});

	describe('order (#456)', () => {
		const sentUrls = () => browser.runtime.sendMessage.mock.calls[0][0].tUrls;
		const act = (event) => actions.ActUpon(collection(run('CT_LINKS'), { Links: links('http://a/', 'http://b/', 'http://a/', 'http://c/') }), event);

		test.each([
			['default order', {}, { ctrlKey: false }, ['http://a/', 'http://b/', 'http://c/']],
			['ReverseLinkOrder', { ReverseLinkOrder: true }, { ctrlKey: false }, ['http://c/', 'http://b/', 'http://a/']],
			['SHIFT on release reverses once', {}, { shiftKey: true }, ['http://c/', 'http://b/', 'http://a/']],
			['SHIFT on release with ReverseLinkOrder restores page order', { ReverseLinkOrder: true }, { shiftKey: true }, ['http://a/', 'http://b/', 'http://c/']],
			['SHIFT held to activate does not reverse', { ActivateModifiers: 4 /* SHIFT */ }, { shiftKey: true }, ['http://a/', 'http://b/', 'http://c/']],
			['copying (CTRL) is reversed too', { ReverseLinkOrder: true }, { ctrlKey: true }, ['http://c/', 'http://b/', 'http://a/']],
		])('%s', (_label, prefs, event, expected) => {
			setPrefs(prefs);

			act(event);

			expect(sentUrls()).toEqual(expected);
		});

		test('CTRL+SHIFT copies in reverse order', () => {
			act({ ctrlKey: true, shiftKey: true });

			expect(browser.runtime.sendMessage.mock.calls[0][0]).toEqual({ Action: run('COPY_TO_CLIPBOARD'), tUrls: ['http://c/', 'http://b/', 'http://a/'], tTitles: ['', '', ''] });
		});
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

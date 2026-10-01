/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "moz-extension://snaplinks/src/html/options.html"}
 *
 * Loads the real options.html markup and the real Options.js / StoragePrefs / globals.
 */
'use strict';

/* global test, expect, describe, beforeEach, afterEach, jest, require */

const fs   = require('fs');
const path = require('path');

const { loadScriptsInDom, makeBrowser } = require('./_support/loadScripts');
const { trackListeners }                = require('./_support/dom');

const OptionsHtml = fs.readFileSync(path.resolve(__dirname, '../src/html/options.html'), 'utf8');
const BodyHtml    = OptionsHtml.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];

let run, browser, cleanup;

const el      = (id) => document.getElementById(id);
const flush   = async () => { jest.advanceTimersByTime(250); await jest.runAllTicks(); await Promise.resolve(); await Promise.resolve(); };
const stored  = () => browser.storage.sync.data;
const change  = (node, type = 'change') => node.dispatchEvent(new Event(type, { bubbles: true }));

async function load(sync = {}) {
	document.body.innerHTML = BodyHtml;
	browser                 = makeBrowser({ sync });
	({ run } = loadScriptsInDom(['StoragePrefs.js', 'globals.js', 'lib/Options.js'], browser));
	await run('DOMReady');
	await Promise.resolve();
	await Promise.resolve();
}

beforeEach(() => {
	jest.useFakeTimers();
	cleanup = trackListeners();
});

afterEach(() => {
	cleanup();
	jest.useRealTimers();
});

describe('markup matches the code', () => {
	const controls = () => Array.from(document.querySelectorAll('input[id], select[id], textarea[id], details[id]'));

	beforeEach(() => load());

	test('every control id is a preference with a default', () => {
		let defaults = Object.keys(run('DefaultPrefs'));

		expect(controls().map(c => c.id).filter(id => !defaults.includes(id))).toEqual([]);
	});

	test.each([
		['ActivateMouseButton', { 'Left Click': 'LMB', 'Middle Click': 'MMB', 'Right Click': 'RMB' }],
	])('%s options carry the matching mouse button constants', (id, names) => {
		let values = Array.from(el(id).options).map(o => [o.textContent.trim(), Number(o.value)]);

		for(let [label, constant] of Object.entries(names))
			expect(values).toContainEqual([label, run(constant)]);
	});

	test('ActivateModifiers options are every combination of CTRL, ALT and SHIFT', () => {
		let values = Array.from(el('ActivateModifiers').options).map(o => Number(o.value)).sort();

		expect(values).toEqual([run('NONE'), run('CTRL'), run('ALT'), run('CTRL | ALT'), run('SHIFT'), run('CTRL | SHIFT'), run('ALT | SHIFT'), run('CTRL | ALT | SHIFT')].sort());
	});

	test('DefaultAction options are OPEN_LINKS and COPY_LINKS', () => {
		expect(Array.from(el('DefaultAction').options).map(o => Number(o.value)).sort()).toEqual([run('OPEN_LINKS'), run('COPY_LINKS')].sort());
	});

	test('OpenTabs options are the three TABS_OPEN_* constants', () => {
		expect(Array.from(el('OpenTabs').options).map(o => o.value).sort()).toEqual([run('TABS_OPEN_END'), run('TABS_OPEN_RIGHT'), run('TABS_OPEN_NATURAL')].sort());
	});

	test('StorageAPI options are the valid storage areas', () => {
		expect(Array.from(el('StorageAPI').options).map(o => o.value).sort()).toEqual(['local', 'sync']);
	});
});

describe('showing preferences', () => {
	test('controls show the defaults when nothing is stored', async () => {
		await load();

		expect(el('ShowNumberOfLinks').checked).toBe(true);
		expect(el('ActivateMouseButton').value).toBe(String(run('RMB')));
		expect(el('OpenTabs').value).toBe(run('TABS_OPEN_NATURAL'));
		expect(el('Activation_Min').value).toBe('5');
		expect(el('DevMode').checked).toBe(false);
	});

	test('stored values override the defaults, for every control type', async () => {
		await load({ ShowNumberOfLinks: false, ActivateMouseButton: 4, Activation_Min: 12, UI_AdvancedOptions_Section: true });

		expect(el('ShowNumberOfLinks').checked).toBe(false);
		expect(el('ActivateMouseButton').value).toBe('4');
		expect(el('Activation_Min').value).toBe('12');
		expect(el('UI_AdvancedOptions_Section').open).toBe(true);
	});
});

describe('saving preferences', () => {
	beforeEach(() => load());

	test('a checkbox change is saved after the 250ms throttle', async () => {
		el('SwitchFocusToNewTab').checked = false;
		change(el('SwitchFocusToNewTab'));

		expect(stored().SwitchFocusToNewTab).toBeUndefined();
		await flush();

		expect(stored().SwitchFocusToNewTab).toBe(false);
	});

	test('a select change is saved', async () => {
		el('OpenTabs').value = run('TABS_OPEN_END');
		change(el('OpenTabs'));
		await flush();

		expect(stored().OpenTabs).toBe(run('TABS_OPEN_END'));
	});

	test('typing in a text field saves the final value only', async () => {
		for(let v of ['1', '12', '123']) {
			el('NewTabDelayMS').value = v;
			change(el('NewTabDelayMS'), 'input');
			jest.advanceTimersByTime(100);
		}
		await flush();

		expect(browser.storage.sync.set.mock.calls.filter(([o]) => 'NewTabDelayMS' in o)).toHaveLength(1);
		expect(stored().NewTabDelayMS).toBe('123');
	});

	test('toggling a details section is remembered', async () => {
		el('UI_AdvancedOptions_Section').open = true;
		change(el('UI_AdvancedOptions_Section'), 'toggle');
		await flush();

		expect(stored().UI_AdvancedOptions_Section).toBe(true);
	});
});

describe('developer options', () => {
	test('are disabled until Dev Mode is on, and follow the checkbox', async () => {
		await load();
		expect(el('DevMode_Options').disabled).toBe(true);

		el('DevMode').checked = true;
		change(el('DevMode'));
		expect(el('DevMode_Options').disabled).toBe(false);

		el('DevMode').checked = false;
		change(el('DevMode'));
		expect(el('DevMode_Options').disabled).toBe(true);
	});

	test('start enabled when Dev Mode is already stored on', async () => {
		await load({ DevMode: true });

		expect(el('DevMode_Options').disabled).toBe(false);
	});
});

describe('browser-specific options', () => {
	test('Firefox-only options stay enabled in Firefox', async () => {
		await load();

		expect(el('NewTabsOpenUnloaded').disabled).toBe(false);
		expect(el('NewTabsOpenUnloaded').closest('label').classList.contains('disabled')).toBe(false);
	});
});

describe('constructing Options', () => {
	test('refuses a missing or non-StoragePrefs argument', async () => {
		await load();
		let Options = run('Options');

		expect(() => new Options()).toThrow('No configuration given to Options');
		expect(() => new Options({})).toThrow('No configuration given to Options');
	});
});

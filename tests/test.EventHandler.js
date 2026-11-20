/**
 * @jest-environment jsdom
 *
 * Drives the whole content-script stack (every script in manifest order) with synthetic mouse events:
 * EventHandler → SelectionRect → ElementIndexer → CategorizedCollection → SvgOverlay → ActionMgr.
 */
'use strict';

/* global test, expect, describe, beforeEach, afterEach, jest, require */

const { loadScriptsInDom, makeBrowser }                                           = require('./_support/loadScripts');
const { place, build, setDocumentSize, stubEmptyLayout, stubHitTesting, trackListeners } = require('./_support/dom');

const Scripts = [
	'StoragePrefs.js', 'CSP.js', 'globals.js', 'content-scripts/Utility.js', 'content-scripts/SelectionRect.js', 'content-scripts/ElementIndexer.js',
	'content-scripts/SvgOverlay.js', 'content-scripts/CategorizedCollection.js', 'content-scripts/ActionMgr.js', 'content-scripts/EventHandler.js',
];

const LMB = 1, RMB = 2;

/**
 * Page layout (client == document coordinates, the page is not scrolled):
 *   a, b  links in the upper band         c  link far below        cb1..cb3  checkboxes in the middle band
 */
const Layout = {
	a:   [100, 100, 130, 200],
	b:   [100, 300, 130, 400],
	c:   [600, 100, 630, 200],
	cb1: [300, 100, 320, 120],
	cb2: [300, 150, 320, 170],
	cb3: [300, 200, 320, 220],
};

let run, browser, els, cleanup;

const mouse = (type, init = {}, target = document.body) => {
	let e = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
	target.dispatchEvent(e);
	return e;
};

const down = (x, y, init = {}) => mouse('mousedown', { buttons: RMB, button: 2, clientX: x, clientY: y, ...init });
const move = (x, y, init = {}) => { mouse('mousemove', { buttons: RMB, clientX: x, clientY: y, ...init }); jest.advanceTimersByTime(30); };
const up   = (x, y, init = {}) => mouse('mouseup', { clientX: x, clientY: y, ...init });
const key  = (k, init = {}) => {
	let e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: k, ...init });
	document.body.dispatchEvent(e);
	return e;
};

/** A complete right-button drag from one corner to another */
const drag = (from, to, upInit = {}) => { down(...from); move(...to); return up(...to, upInit); };

const container = () => document.querySelector('.SnapLinksContainer');
/** Action messages sent to the background, without the context menu recovery handshake (#580) */
const sent      = () => browser.runtime.sendMessage.mock.calls.map(([msg]) => msg).filter(msg => !/ContextMenu/.test(msg.Action));

async function load(stores) {
	browser = makeBrowser(stores);
	({ run } = loadScriptsInDom(Scripts, browser));
	await run('DOMReady');
}

beforeEach(async () => {
	jest.useFakeTimers();
	cleanup = trackListeners();
	stubEmptyLayout();
	window.scrollBy = jest.fn();

	document.head.innerHTML = '';
	els = build(`
		<a id="a" href="http://x.test/a">a</a><a id="b" href="http://x.test/b">b</a><a id="c" href="http://x.test/c">c</a>
		<input id="cb1" type="checkbox"><input id="cb2" type="checkbox"><input id="cb3" type="checkbox">`);
	Object.entries(Layout).forEach(([id, rect]) => place(els[id], rect));
	setDocumentSize(1000, 1000);
	stubHitTesting(Layout, els);

	await load();
});

afterEach(() => {
	cleanup();
	jest.useRealTimers();
	// Undo sizes and modes faked by a test, the jsdom document is shared
	delete document.body.clientHeight;
	delete document.documentElement.clientHeight;
	delete document.compatMode;
});

describe('activation', () => {
	test('a right-button drag over links opens them, once each', () => {
		drag([50, 50], [450, 200]);

		expect(sent()).toEqual([{ Action: run('OPEN_URLS_IN_TABS'), tUrls: ['http://x.test/a', 'http://x.test/b'] }]);
	});

	test('the action is sent synchronously inside the mouseup handler (browsers refuse tab/clipboard actions otherwise)', () => {
		down(50, 50);
		move(450, 200);

		mouse('mouseup', { clientX: 450, clientY: 200 });

		expect(sent()).toHaveLength(1);
	});

	test('the left button does not start a drag', () => {
		down(50, 50, { buttons: LMB, button: 0 });
		move(450, 200, { buttons: LMB });
		up(450, 200);

		expect(container()).toBeNull();
		expect(sent()).toEqual([]);
	});

	test('a modifier that is not configured prevents activation', () => {
		down(50, 50, { ctrlKey: true });
		move(450, 200);
		up(450, 200);

		expect(sent()).toEqual([]);
	});

	test('the configured mouse button and modifier activate (ActivateMouseButton / ActivateModifiers prefs)', async () => {
		cleanup();
		cleanup = trackListeners();
		await load({ sync: { ActivateMouseButton: LMB, ActivateModifiers: 4 } });

		down(50, 50, { buttons: LMB, button: 0, shiftKey: true });
		move(450, 200, { buttons: LMB, shiftKey: true });
		up(450, 200);

		expect(sent()).toHaveLength(1);
	});

	test('mousedown calls preventDefault only when it starts a drag', () => {
		expect(down(50, 50).defaultPrevented).toBe(true);
		up(50, 50);
		expect(down(50, 50, { buttons: LMB }).defaultPrevented).toBe(false);
	});
});

describe('during the drag', () => {
	test('the lasso is shown with the count of distinct links inside it', () => {
		down(50, 50);
		move(450, 200);

		expect(container()).not.toBeNull();
		expect(container().style.display).toBe('');
		expect(container().querySelector('.SL_SelectionLabel').innerHTML).toBe('2 Links');
	});

	test('links are highlighted with one SVG rect each, and only those inside the lasso', () => {
		down(50, 50);
		move(450, 200);

		expect(container().querySelectorAll('rect.ActOn')).toHaveLength(2);

		move(250, 200);

		expect(Array.from(container().querySelectorAll('rect.ActOn')).filter(r => r.style.display !== 'none')).toHaveLength(1);
		expect(container().querySelector('.SL_SelectionLabel').innerHTML).toBe('1 Links');
	});

	test('dragging past the bottom of the window autoscrolls', () => {
		down(50, 50);
		move(450, 900);

		expect(window.scrollBy).toHaveBeenCalledWith(0, expect.any(Number));
		expect(window.scrollBy.mock.calls.at(-1)[1]).toBeGreaterThan(0);
	});

	test('dragging past the bottom of the window autoscrolls on a page taller than the window (#566, #516)', () => {
		// A long page in standards mode: the body is as tall as the content, the root element reports the viewport
		Object.defineProperty(document.body, 'clientHeight', { value: 5000, configurable: true });
		Object.defineProperty(document.documentElement, 'clientHeight', { value: 700, configurable: true });

		down(50, 50);
		move(450, 750);

		expect(window.scrollBy.mock.calls.at(-1)).toEqual([0, 50]);
	});

	// jsdom: the window is 1024 x 768 and the root element reports no size, so GetClientDims() is the window
	test('dragging down into the bottom 20px of the window autoscrolls, faster closer to the edge', () => {
		down(50, 50);
		move(450, 750);
		expect(window.scrollBy.mock.calls.at(-1)).toEqual([0, 1]);

		move(450, 767);
		expect(window.scrollBy.mock.calls.at(-1)).toEqual([0, 10]);
	});

	test('dragging up into the top 20px of the window scrolls up', () => {
		down(50, 400);
		move(450, 4);

		expect(window.scrollBy.mock.calls.at(-1)).toEqual([0, -8]);
	});

	test('a drag that starts near the bottom edge and moves sideways does not scroll', () => {
		down(50, 760);
		move(450, 760);

		expect(window.scrollBy.mock.calls.at(-1)).toEqual([0, 0]);
	});

	test('AutoScrollEdgeZone 0 scrolls only once the mouse leaves the window', async () => {
		cleanup();
		cleanup = trackListeners();
		await load({ sync: { AutoScrollEdgeZone: 0 } });

		down(50, 50);
		move(450, 767);
		expect(window.scrollBy.mock.calls.at(-1)).toEqual([0, 0]);

		move(450, 778);
		expect(window.scrollBy.mock.calls.at(-1)).toEqual([0, 10]);
	});
});

describe('finishing the drag', () => {
	test('removes the lasso and its style from the page', () => {
		drag([50, 50], [450, 200]);

		expect(container()).toBeNull();
		expect(document.head.querySelector('style')).toBeNull();
	});

	test('suppresses exactly one context menu after a successful drag', () => {
		drag([50, 50], [450, 200]);

		expect(mouse('contextmenu').defaultPrevented).toBe(true);
		expect(mouse('contextmenu').defaultPrevented).toBe(false);
	});

	test('a drag too small to activate does nothing and leaves the context menu alone', () => {
		drag([50, 50], [53, 53]);

		expect(sent()).toEqual([]);
		expect(mouse('contextmenu').defaultPrevented).toBe(false);
	});

	test('Escape cancels, and the mouseup that follows does nothing', () => {
		down(50, 50);
		move(450, 200);

		let e = key('Escape');
		up(450, 200);

		expect(e.defaultPrevented).toBe(true);
		expect(container()).toBeNull();
		expect(sent()).toEqual([]);
	});

	test('a second drag works after the first', () => {
		drag([50, 50], [450, 200]);
		drag([50, 50], [450, 200]);

		expect(sent()).toHaveLength(2);
	});

	test('selecting nothing sends nothing', () => {
		drag([700, 700], [900, 900]);

		expect(sent()).toEqual([]);
	});
});

describe('actions by greatest element type', () => {
	test('lassoing checkboxes toggles them (all unchecked → all checked)', () => {
		drag([80, 280], [240, 340]);

		expect([els.cb1, els.cb2, els.cb3].map(cb => cb.checked)).toEqual([true, true, true]);
		expect(sent()).toEqual([]);
	});

	test('lassoing checked checkboxes unchecks them', () => {
		[els.cb1, els.cb2, els.cb3].forEach(cb => cb.checked = true);

		drag([80, 280], [240, 340]);

		expect([els.cb1, els.cb2, els.cb3].map(cb => cb.checked)).toEqual([false, false, false]);
	});

	test('holding Ctrl at mouseup copies instead of opening (DefaultAction is OPEN_LINKS)', () => {
		drag([50, 50], [450, 200], { ctrlKey: true });

		expect(sent()).toEqual([{ Action: run('COPY_TO_CLIPBOARD'), tUrls: ['http://x.test/a', 'http://x.test/b'] }]);
	});

	test('a link covered by another element is not opened', () => {
		els = build(`<a id="a" href="http://x.test/a">a</a><a id="b" href="http://x.test/b">b</a><div id="cover"></div>`);
		place(els.a, Layout.a);
		place(els.b, Layout.b);
		place(els.cover, [95, 295, 135, 405]);
		stubHitTesting({ ...Layout, cover: [95, 295, 135, 405] }, els, { b: 'cover' });

		drag([50, 50], [450, 200]);

		expect(sent()[0].tUrls).toEqual(['http://x.test/a']);
	});
});

describe('developer mode', () => {
	test('Ctrl+Alt+right-click asks the background to reload the extension, only when DevMode is on', async () => {
		down(50, 50, { ctrlKey: true, altKey: true });
		up(50, 50);
		expect(sent().filter(m => m.Action === 'ReloadExtension')).toEqual([]);

		cleanup();
		cleanup = trackListeners();
		await load({ sync: { DevMode: true } });

		down(50, 50, { ctrlKey: true, altKey: true });

		expect(sent()).toEqual([{ Action: 'ReloadExtension' }]);
	});
});

describe('GetClientDims (the viewport, not the page)', () => {
	const dims = () => run('GetClientDims')();
	const fake = (el, prop, value) => Object.defineProperty(el, prop, { value, configurable: true });

	test('standards mode: the root element\'s size, not the body\'s content height', () => {
		fake(document.documentElement, 'clientHeight', 700);
		fake(document.body, 'clientHeight', 5000);

		expect(dims()[1]).toBe(700);
	});

	test('quirks mode: the body\'s size, not the root element\'s', () => {
		fake(document, 'compatMode', 'BackCompat');
		fake(document.documentElement, 'clientHeight', 5000);
		fake(document.body, 'clientHeight', 700);

		expect(dims()[1]).toBe(700);
	});

	test('never larger than the window, and the window when the element reports nothing', () => {
		fake(document.documentElement, 'clientHeight', 5000);
		expect(dims()).toEqual([1024, 768]);

		fake(document.documentElement, 'clientHeight', 0);
		expect(dims()).toEqual([1024, 768]);
	});
});

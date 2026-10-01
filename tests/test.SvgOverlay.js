/**
 * @jest-environment jsdom
 */
'use strict';

/* global test, expect, describe, beforeEach, afterEach, require */

const { loadScriptsInDom }                  = require('./_support/loadScripts');
const { place, build, stubEmptyLayout, trackListeners } = require('./_support/dom');

const Scripts = ['StoragePrefs.js', 'CSP.js', 'globals.js', 'content-scripts/Utility.js', 'content-scripts/SelectionRect.js', 'content-scripts/ElementIndexer.js', 'content-scripts/SvgOverlay.js', 'content-scripts/CategorizedCollection.js'];

let run, overlay, container, els, cleanup;

/** Visible rects as [x, y, width, height], sorted because recycled rects come back from the pool in any order */
const rects = (selector = 'rect.ActOn') => Array.from(container.querySelectorAll(selector))
	.filter(r => r.style.display !== 'none')
	.map(r => ['x', 'y', 'width', 'height'].map(a => Number(r.getAttribute(a))))
	.sort((p, q) => p[1] - q[1] || p[0] - q[0]);

beforeEach(async () => {
	cleanup = trackListeners();
	stubEmptyLayout();

	({ run } = loadScriptsInDom(Scripts, undefined, ['LastModifierKeys', 'ElemDocRects', 'SvgOverlay']));
	await run('DOMReady');

	els = build('<a id="a" href="/a"></a><a id="b" href="/b"></a><a id="c" href="/c"></a>');
	place(els.a, [10, 10, 30, 110]);
	place(els.b, [50, 10, 70, 60], [80, 10, 100, 60]);
	place(els.c, [200, 0, 220, 50]);

	run('ElemDocRects = new RectMapper()');
	overlay   = new (run('SvgOverlayMgr'))();
	container = document.createElement('div');
});

afterEach(() => cleanup());

/** Announces the container, which is what makes the overlay create its SVG layer */
const init = () => {
	run('(c) => pub(ContainerElementCreated, c)')(container);
};

const select = (...ids) => run('(c) => pub(ElementsSelected, c)')(new (run('CategorizedCollection'))(ids.map(id => els[id])));

describe('initialization', () => {
	test('creates its SVG layer inside the container once the container is announced', () => {
		expect(overlay.Overlay).toBeUndefined();

		init();

		expect(container.querySelector('svg.SnapLinksHighlighter')).toBe(overlay.Overlay);
	});

	test('only initializes for the first container announced', () => {
		init();
		let first = overlay.Overlay;

		init();

		expect(overlay.Overlay).toBe(first);
	});

	test('highlighting before the container exists is harmless', () => {
		expect(() => overlay.Highlight(new (run('CategorizedCollection'))([els.a]))).not.toThrow();
	});
});

describe('Highlight', () => {
	beforeEach(init);

	test('draws one rect per client rect of each element, using the highlight style', () => {
		select('a', 'b');

		expect(rects()).toEqual([[10, 10, 100, 20], [10, 50, 50, 20], [10, 80, 50, 20]]);
		expect(container.querySelector('rect.ActOn').getAttribute('style')).toBe(run('Prefs.HighlightStyles_ActOnElements'));
	});

	test('removes the highlight of elements that are no longer selected, and keeps the others', () => {
		select('a', 'b');
		select('b');

		expect(rects()).toEqual([[10, 50, 50, 20], [10, 80, 50, 20]]);
	});

	test('reuses hidden rects instead of growing the SVG', () => {
		select('a', 'b', 'c');
		let count = overlay.Overlay.children.length;

		select('c');
		select('a', 'b', 'c');

		expect(overlay.Overlay.children.length).toBe(count);
	});

	test('Hide (DragCompleted) removes every highlight', () => {
		select('a', 'b');

		run('pub(DragCompleted, {})');

		expect(rects()).toEqual([]);
	});

	test('highlights are drawn in document coordinates, offset by the scroll position', () => {
		window.scrollX = 5;
		window.scrollY = 100;

		select('a');

		expect(rects()).toEqual([[15, 110, 100, 20]]);
		window.scrollX = window.scrollY = 0;
	});
});

describe('Reposition', () => {
	beforeEach(init);

	test('redraws the current highlights after the page moves', () => {
		select('a', 'c');

		run('pub(ElementPositionsChanged, {})');

		expect(rects()).toEqual([[10, 10, 100, 20], [0, 200, 50, 20]]);
	});

	test('redraws at the new scroll offset', () => {
		select('a');
		window.scrollY = 40;

		run('pub(DocSizeChanged, {})');

		expect(rects()).toEqual([[10, 50, 100, 20]]);
		window.scrollY = 0;
	});
});

describe('debug marks', () => {
	beforeEach(init);

	test('AddRect and AddPoint draw rects of the given class using the matching style pref', () => {
		overlay.AddRect(1, 2, 30, 40, 'ObscuredRect');
		overlay.AddPoint(5, 6, 'ObscuredPoint');

		expect(rects('rect.ObscuredRect')).toEqual([[1, 2, 30, 40]]);
		expect(rects('rect.ObscuredPoint')).toEqual([[5, 6, 1, 1]]);
		expect(container.querySelector('rect.ObscuredPoint').getAttribute('style')).toBe(run('Prefs.HighlightStyles_ObscuredPoint'));
	});

	test('Release hides and recycles only the rects matching the selector', () => {
		overlay.AddRect(1, 2, 30, 40, 'ObscuredRect');
		overlay.AddPoint(5, 6, 'ObscuredPoint');

		overlay.Release('.ObscuredRect');

		expect(rects('rect.ObscuredRect')).toEqual([]);
		expect(rects('rect.ObscuredPoint')).toHaveLength(1);
	});
});

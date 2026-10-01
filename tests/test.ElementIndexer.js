/**
 * @jest-environment jsdom
 */
'use strict';

/* global test, expect, describe, beforeEach, jest, require */

const { loadScriptsInDom } = require('./_support/loadScripts');

const Scripts = [
	'StoragePrefs.js', 'CSP.js', 'globals.js', 'content-scripts/Utility.js', 'content-scripts/SelectionRect.js',
	'content-scripts/ElementIndexer.js', 'content-scripts/CategorizedCollection.js',
];

let run, Rect;

/** jsdom has no layout engine, so elements are told where they are */
const place = (el, ...rects) => {
	el.getClientRects = () => rects.map(([top, left, bottom, right]) => ({ top, left, bottom, right, width: right - left, height: bottom - top }));
	return el;
};

const build = (html) => {
	document.body.innerHTML = html;
	return Object.fromEntries(Array.from(document.body.querySelectorAll('[id]')).map(el => [el.id, el]));
};

beforeEach(() => {
	({ run } = loadScriptsInDom(Scripts, undefined, ['LastModifierKeys', 'ElemDocRects', 'SvgOverlay']));
	Rect = run('Rect');

	run(`Prefs = { DevMode: false, IndexBuckets: 10, DisableFontWeightFiltering: true,
		Debug_Measure_IndexingSpeed: false, Debug_Measure_SearchSpeed: false, Debug_Show_IndexBoundaryMarkers: false,
		Debug_Log_OutOfBoundElements: false, Debug_Show_ObscuredMarks: false }`);
	run('LastModifierKeys = 0');
});

describe('RectMapper', () => {
	let mapper;

	beforeEach(() => {
		mapper = new (run('RectMapper'))();
	});

	describe('GetElementRects', () => {
		test('applies the scroll offset to turn client rects into document rects', () => {
			let { a } = build('<a id="a" href="/"></a>');
			place(a, [10, 20, 30, 60]);

			let [r] = mapper.get(a, { x: 5, y: 100 });

			expect(r).toMatchObject({ top: 110, left: 25, bottom: 130, right: 65 });
		});

		test('drops rects with no width or height', () => {
			let { a } = build('<a id="a" href="/"></a>');
			place(a, [10, 20, 30, 60], [10, 20, 10, 60], [10, 20, 30, 20]);

			expect(mapper.get(a)).toHaveLength(1);
		});

		test('an anchor also covers the IMG elements inside it', () => {
			let { a, img } = build('<a id="a" href="/"><img id="img"></a>');
			place(a, [0, 0, 10, 10]);
			place(img, [20, 0, 40, 10]);

			expect(mapper.get(a).map(r => r.top)).toEqual([0, 20]);
		});

		test('a checkbox also covers its wrapping label', () => {
			let { cb, lbl } = build('<label id="lbl"><input id="cb" type="checkbox"> text</label>');
			place(cb, [0, 0, 10, 10]);
			place(lbl, [0, 0, 10, 80]);

			expect(mapper.getBounding(cb)).toMatchObject({ left: 0, right: 80 });
		});

		test('a radio button also covers labels that point at it with for=', () => {
			let { rd, l1, l2 } = build('<input id="rd" type="radio"><label id="l1" for="rd"></label><label id="l2" for="rd"></label>');
			place(rd, [0, 0, 10, 10]);
			place(l1, [0, 20, 10, 40]);
			place(l2, [30, 0, 40, 10]);

			expect(mapper.get(rd)).toHaveLength(3);
		});

		test('other input types do not pick up labels', () => {
			let { t, l } = build('<input id="t" type="text"><label id="l" for="t"></label>');
			place(t, [0, 0, 10, 10]);
			place(l, [0, 20, 10, 40]);

			expect(mapper.get(t)).toHaveLength(1);
		});
	});

	describe('getBounding', () => {
		test('is the smallest rect containing every element rect', () => {
			let { a } = build('<a id="a" href="/"></a>');
			place(a, [10, 50, 20, 60], [40, 10, 50, 30]);

			expect(mapper.getBounding(a)).toMatchObject({ top: 10, left: 10, bottom: 50, right: 60 });
		});

		test('is an empty Rect for an element with no layout', () => {
			let { a } = build('<a id="a" href="/"></a>');
			place(a);

			expect(mapper.getBounding(a)).toMatchObject({ width: 0, height: 0 });
		});
	});

	describe('font score', () => {
		test.each([
			['bold', 700], ['normal', 400], ['600', 600], ['', 400],
		])('TranslateWeight(%j) = %d', (weight, expected) => {
			expect(mapper.TranslateWeight(weight)).toBe(expected);
		});

		test('combines font size and weight, and caches per element until cleared', () => {
			let { a } = build('<a id="a" href="/" style="font-size: 16px; font-weight: 700"></a>');
			let spy   = jest.spyOn(window, 'getComputedStyle');

			expect(mapper.GetFontScore(a)).toBe(16 * 100 + 70);
			mapper.GetFontScore(a);
			expect(spy).toHaveBeenCalledTimes(1);

			mapper.clear();
			mapper.GetFontScore(a);
			expect(spy).toHaveBeenCalledTimes(2);
			spy.mockRestore();
		});

		// KNOWN BUG: GetFontScore strips every non-digit from the font size, so '12.5px' reads as 125 and outscores 13px.
		// Parse the number (parseFloat) instead, then remove `.failing`.
		test.failing('a fractional font size scores below the next whole size up', () => {
			let { a, b } = build('<a id="a" href="/" style="font-size: 12.5px"></a><a id="b" href="/" style="font-size: 13px"></a>');

			expect(mapper.GetFontScore(a)).toBeLessThan(mapper.GetFontScore(b));
		});
	});

	test.each(['DocSizeChanged', 'ElementPositionsChanged'])('the font cache is discarded on %s', (channel) => {
		let { a } = build('<a id="a" href="/" style="font-size: 16px"></a>');
		let spy   = jest.spyOn(window, 'getComputedStyle');

		mapper.GetFontScore(a);
		run(`pub(${channel}, {})`);
		mapper.GetFontScore(a);

		expect(spy).toHaveBeenCalledTimes(2);
		spy.mockRestore();
	});
});

describe('ElementIndexer', () => {
	let indexer;

	/**
	 * A 1000px tall, 1000px wide document with the SnapLinks container present.
	 * Elements are placed 100px apart vertically so each lands in its own bucket (IndexBuckets = 10).
	 */
	const setup = (html, positions, { obscuredBy = {} } = {}) => {
		let els = build(`${html}<div class="SnapLinksContainer"></div>`);

		for(let [id, rect] of Object.entries(positions))
			place(els[id], rect);

		Object.defineProperty(document.documentElement, 'scrollHeight', { value: 1000, configurable: true });
		Object.defineProperty(document.documentElement, 'scrollWidth', { value: 1000, configurable: true });
		document.elementFromPoint = jest.fn((x, y) => {
			let hit = Object.entries(positions).find(([, [t, l, b, r]]) => x >= l && x <= r && y >= t && y <= b);
			return (hit && els[obscuredBy[hit[0]]]) || (hit && els[hit[0]]) || document.body;
		});

		run('ElemDocRects = new RectMapper()');
		run('SvgOverlay = { AddRect() {}, AddPoint() {}, AddIndexBoundaryMark() {}, Release() {} }');
		indexer = new (run('ElementIndexer'))();

		return els;
	};

	const search = (top, left, bottom, right) => indexer.Search(new Rect(top, left, bottom, right));
	const ids    = (collection) => collection.All.map(el => el.id).sort();

	describe('which elements are indexed', () => {
		test('includes links, buttons, checkboxes, radios and ARIA widgets', () => {
			setup(`<a id="a" href="/x"></a><input id="b" type="button"><input id="s" type="submit"><input id="r" type="reset">
					<input id="c" type="checkbox"><input id="d" type="radio"><button id="e"></button>
					<div id="f" aria-checked="true"></div><div id="g" role="link"></div>`,
				Object.fromEntries('abcdefg'.split('').concat(['s', 'r']).map((id, i) => [id, [i * 10, 0, i * 10 + 5, 50]])));

			expect(Array.from(indexer.Elements).map(el => el.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'r', 's']);
		});

		test('excludes anchors without an href, text inputs and elements with no size', () => {
			setup('<a id="named"></a><a id="empty" href=""></a><input id="t" type="text"><a id="zero" href="/z"></a><a id="ok" href="/ok"></a>',
				{ named: [0, 0, 10, 10], empty: [0, 0, 10, 10], t: [0, 0, 10, 10], zero: [20, 0, 20, 10], ok: [40, 0, 50, 10] });

			expect(Array.from(indexer.Elements).map(el => el.id)).toEqual(['ok']);
		});
	});

	describe('Search', () => {
		const html = '<a id="top" href="/1"></a><a id="mid" href="/2"></a><a id="low" href="/3"></a>';
		const rects = { top: [10, 10, 40, 110], mid: [410, 10, 440, 110], low: [810, 10, 840, 110] };

		test('returns the elements intersecting the selection', () => {
			setup(html, rects);
			indexer.UpdateIndex();

			expect(ids(search(400, 0, 500, 200))).toEqual(['mid']);
		});

		test('a selection spanning several buckets finds everything inside, in any bucket', () => {
			setup(html, rects);
			indexer.UpdateIndex();

			expect(ids(search(0, 0, 900, 200))).toEqual(['low', 'mid', 'top']);
		});

		test('partially overlapping elements are included', () => {
			setup(html, rects);
			indexer.UpdateIndex();

			expect(ids(search(430, 100, 500, 300))).toEqual(['mid']);
		});

		test('elements outside the selection are excluded', () => {
			setup(html, rects);
			indexer.UpdateIndex();

			expect(ids(search(100, 0, 300, 200))).toEqual([]);
			expect(ids(search(400, 200, 500, 300))).toEqual([]);
		});

		test('an element covered by another element is excluded', () => {
			setup(`${html}<div id="cover"></div>`, { ...rects, cover: [405, 5, 445, 115] }, { obscuredBy: { mid: 'cover' } });
			indexer.UpdateIndex();

			expect(ids(search(400, 0, 500, 200))).toEqual([]);
		});

		test('an element whose center is a descendant of itself, or a label, is not considered covered', () => {
			let els = setup('<a id="a" href="/1"><span id="inner"></span></a><input id="cb" type="checkbox"><label id="lbl" for="cb"></label>',
				{ a: [10, 10, 40, 110], cb: [210, 10, 240, 40], lbl: [210, 10, 240, 40] },
				{ obscuredBy: { a: 'inner', cb: 'lbl' } });
			indexer.UpdateIndex();

			expect(ids(search(0, 0, 300, 200))).toEqual(['a', 'cb']);
			expect(els.inner).toBeDefined();
		});

		test('a non-Rect argument yields an empty collection', () => {
			setup(html, rects);

			expect(indexer.Search(undefined).All).toEqual([]);
		});

		test('the container is sent behind the page while searching and restored after', () => {
			let els = setup(html, rects);
			indexer.UpdateIndex();
			let container = document.querySelector('DIV.SnapLinksContainer');
			let seen;
			document.elementFromPoint.mockImplementation(() => { seen = container.style.zIndex; return els.mid; });

			search(400, 0, 500, 200);

			expect(seen).toBe('-999999');
			expect(container.style.zIndex).toBe('');
		});
	});

	describe('pub/sub integration', () => {
		const html = '<a id="a" href="/1"></a><a id="b" href="/2"></a>';

		test('DragRectChanged publishes ElementsSelected with a CategorizedCollection of the hits', () => {
			setup(html, { a: [10, 10, 40, 110], b: [610, 10, 640, 110] });
			let received = [];
			run('(fn) => sub(ElementsSelected, fn)')(c => received.push(c));

			run('(data) => pub(DragRectChanged, data)')({ dims: new Rect(600, 0, 700, 200), visible: true });

			expect(received).toHaveLength(1);
			expect(ids(received[0])).toEqual(['b']);
			expect(received[0].GreatestType).toBe(run('CT_LINKS'));
		});

		test('nothing is published for a rect that is not visible', () => {
			setup(html, { a: [10, 10, 40, 110], b: [610, 10, 640, 110] });
			let received = [];
			run('(fn) => sub(ElementsSelected, fn)')(c => received.push(c));

			run('(data) => pub(DragRectChanged, data)')({ dims: new Rect(600, 0, 700, 200), visible: false });

			expect(received).toEqual([]);
		});

		test('DragCompleted forgets the element set so the next drag re-queries the page', () => {
			let els = setup(html, { a: [10, 10, 40, 110], b: [610, 10, 640, 110] });
			let first = indexer.Elements;

			run('pub(DragCompleted, {})');
			els.a.remove();

			expect(indexer.Elements).not.toBe(first);
			expect(Array.from(indexer.Elements).map(el => el.id)).toEqual(['b']);
		});
	});
});

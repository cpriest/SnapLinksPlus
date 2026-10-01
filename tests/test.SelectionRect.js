/**
 * @jest-environment jsdom
 */
'use strict';

/* global test, expect, describe, beforeEach, afterEach, jest, require */

const { loadScriptsInDom }                              = require('./_support/loadScripts');
const { build, setDocumentSize, stubEmptyLayout, trackListeners } = require('./_support/dom');

const Scripts = ['StoragePrefs.js', 'CSP.js', 'globals.js', 'content-scripts/Utility.js', 'content-scripts/SelectionRect.js'];

let run, selection, published, cleanup;

const container = () => document.querySelector('.SnapLinksContainer');
const label     = () => selection.elRect.firstElementChild;

beforeEach(async () => {
	cleanup = trackListeners();
	stubEmptyLayout();
	build('');
	setDocumentSize(1000, 800);

	({ run } = loadScriptsInDom(Scripts));
	await run('DOMReady');

	published = [];
	run('(log) => { sub(DragRectChanged, d => log.push({ ...d, dims: { ...d.dims } })); }')(published);

	selection = new (run('SelectionRect'))();
});

afterEach(() => cleanup());

describe('construction', () => {
	test('adds a hidden, positioned container and a style node', () => {
		expect(container().style.display).toBe('none');
		expect(container().querySelector('.SL_SelectionRect > .SL_SelectionLabel')).not.toBeNull();
		expect(document.head.querySelector('style')).toBe(selection.StyleNode);
	});

	test('announces the container so the SVG overlay can attach to it', () => {
		let announced = [];
		run('(log) => { sub(ContainerElementCreated, c => log.push(c)); }')(announced);

		let second = new (run('SelectionRect'))();

		expect(announced).toEqual([second.elContainer]);
	});
});

describe('SetBottomRight', () => {
	test('sizes and positions the selection element and shows the container once it is large enough', () => {
		selection.SetOrigin(100, 200).SetBottomRight(300, 500);

		expect(selection.elRect.style).toMatchObject({ top: '100px', left: '200px', height: '200px', width: '300px' });
		expect(container().style.display).toBe('');
		expect(published).toEqual([expect.objectContaining({ visible: true, dims: expect.objectContaining({ top: 100, left: 200, bottom: 300, right: 500 }) })]);
	});

	test('stays hidden, and reports not visible, until the drag exceeds Activation_Min', () => {
		selection.SetOrigin(100, 200).SetBottomRight(103, 204);

		expect(container().style.display).toBe('none');
		expect(published.map(p => p.visible)).toEqual([false]);
	});

	test('publishes nothing when the size has not changed', () => {
		selection.SetOrigin(100, 200).SetBottomRight(300, 500);
		selection.SetBottomRight(300, 500);

		expect(published).toHaveLength(1);
	});

	test('dragging up and to the left still produces a normalized rect', () => {
		selection.SetOrigin(300, 500).SetBottomRight(100, 200);

		expect(published[0].dims).toMatchObject({ top: 100, left: 200, bottom: 300, right: 500 });
	});

	test('the selection is clipped to the document, less a 2px margin', () => {
		selection.SetOrigin(100, 200).SetBottomRight(5000, 5000);

		expect(published[0].dims).toMatchObject({ bottom: 798, right: 998 });
	});
});

describe('IsLargeEnoughToActivate', () => {
	test.each([
		[5, 5, false], [6, 0, true], [0, 6, true], [0, 0, false],
	])('%ipx wide by %ipx high → %s', (width, height, expected) => {
		selection.SetOrigin(100, 100).SetBottomRight(100 + height, 100 + width);

		expect(selection.IsLargeEnoughToActivate()).toBe(expected);
	});
});

describe('link counter', () => {
	const select = (...hrefs) => {
		let links = hrefs.map(href => ({ href }));
		run('(c) => pub(ElementsSelected, c)')({ Links: links });
	};

	test('counts distinct hrefs', () => {
		select('http://a/', 'http://b/', 'http://a/');

		expect(label().innerHTML).toBe('2 Links');
	});

	test('pins to the bottom right of the rect for a normal drag', () => {
		selection.SetOrigin(100, 100).SetBottomRight(200, 200);
		select('http://a/');

		expect(label().style).toMatchObject({ right: '2px', left: '', bottom: '2px', top: '' });
	});

	test.each([
		['left', 200, 50, { right: '', left: '2px', bottom: '2px', top: '' }],
		['up', 50, 200, { right: '2px', left: '', bottom: '', top: '2px' }],
		['up and left', 50, 50, { right: '', left: '18px', bottom: '', top: '2px' }],
	])('moves to follow the cursor when dragging %s', (_dir, bottom, right, expected) => {
		selection.SetOrigin(100, 100).SetBottomRight(bottom, right);
		select('http://a/');

		expect(label().style).toMatchObject(expected);
	});

	test('is hidden when ShowNumberOfLinks is off', () => {
		run('Prefs = { ...Prefs, SelectionLabel_CursorMargin: 2, ShowNumberOfLinks: false }');
		select('http://a/');

		expect(label().style.display).toBe('none');
	});
});

describe('DOM lifecycle', () => {
	test('DragStarted puts the container and style in the page', () => {
		selection.RemoveElements();
		expect(container()).toBeNull();

		run('pub(DragStarted, {})');

		expect(container()).toBe(selection.elContainer);
		expect(document.head.contains(selection.StyleNode)).toBe(true);
	});

	test('DragCompleted removes them, hides the container and resets the rect', () => {
		selection.SetOrigin(100, 200).SetBottomRight(300, 500);

		run('pub(DragCompleted, {})');

		expect(container()).toBeNull();
		expect(document.head.contains(selection.StyleNode)).toBe(false);
		expect(selection.elContainer.style.display).toBe('none');
		expect(selection.dims).toMatchObject({ width: 0, height: 0 });
	});
});

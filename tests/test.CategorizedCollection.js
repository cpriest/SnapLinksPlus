/**
 * @jest-environment jsdom
 */
'use strict';

/* global test, expect, describe, beforeEach, require */

const { loadScriptsInDom } = require('./_support/loadScripts');

const Declared = ['LastModifierKeys', 'ElemDocRects'];

let run, make, ElementsOf;

/** Builds elements from markup, returned in document order */
const build = (html) => {
	document.body.innerHTML = html;
	return Array.from(document.body.children);
};

/** Font scores are normally computed from layout, tests drive them through data-score */
const useScores = () => run('ElemDocRects = { GetFontScore: (el) => Number(el.dataset.score) }');

beforeEach(() => {
	({ run } = loadScriptsInDom(['StoragePrefs.js', 'globals.js', 'content-scripts/CategorizedCollection.js'], undefined, Declared));
	run('Prefs = { DevMode: false, DisableFontWeightFiltering: true }');
	run('LastModifierKeys = 0');

	make       = (elems) => new (run('CategorizedCollection'))(elems);
	ElementsOf = (list) => list.map(el => el.id);
});

describe('categorizing by tag', () => {
	test('anchors with an href are links', () => {
		let c = make(build('<a id="a" href="http://x/">x</a>'));

		expect(ElementsOf(c.Links)).toEqual(['a']);
	});

	test('an anchor with href="" resolves to the page URL, so it is a link', () => {
		let c = make(build('<a id="a" href="">x</a>'));

		expect(ElementsOf(c.Links)).toEqual(['a']);
	});

	test.each([
		['no href at all (matched via role=button)', '<a id="a" role="button">x</a>'],
		['a javascript: href', '<a id="a" href="javascript:void(0)">x</a>'],
	])('anchors with %s are clickable, not links', (_label, html) => {
		let c = make(build(html));

		expect(ElementsOf(c.Clickable)).toEqual(['a']);
		expect(c.Links).toEqual([]);
	});

	test('inputs and buttons are sorted by type', () => {
		let c = make(build(`
			<input id="sub" type="submit"><input id="rst" type="reset"><input id="btn" type="BUTTON"><button id="b"></button>
			<input id="cb" type="checkbox"><input id="rd" type="radio">`));

		expect(ElementsOf(c.Clickable)).toEqual(['sub', 'rst', 'btn', 'b']);
		expect(ElementsOf(c.Checkboxes)).toEqual(['cb']);
		expect(ElementsOf(c.RadioButtons)).toEqual(['rd']);
	});

	test('text inputs are not categorized', () => {
		let c = make(build('<input id="t" type="text">'));

		expect(c.All).toEqual([]);
	});
});

describe('categorizing by attributes', () => {
	test('aria-checked means checkbox regardless of tag or role', () => {
		let c = make(build('<div id="d" aria-checked="false" role="button"></div>'));

		expect(ElementsOf(c.Checkboxes)).toEqual(['d']);
		expect(c.Clickable).toEqual([]);
	});

	test.each([
		['checkbox', 'Checkboxes'], ['button', 'Clickable'], ['link', 'Links'], ['radio', 'RadioButtons'], ['BUTTON', 'Clickable'],
	])('role=%s lands in %s', (role, category) => {
		let c = make(build(`<span id="s" role="${role}"></span>`));

		expect(ElementsOf(c[category])).toEqual(['s']);
	});

	test('elements with unknown roles are ignored', () => {
		expect(make(build('<span id="s" role="tab"></span>')).All).toEqual([]);
	});
});

describe('GreatestType', () => {
	const CT = () => ({ links: run('CT_LINKS'), clickable: run('CT_CLICKABLE'), checkboxes: run('CT_CHECKBOXES'), radios: run('CT_RADIOBUTTONS') });

	test('is the category with the most elements, and Greatest is its list', () => {
		let c = make(build('<a href="/1"></a><a href="/2"></a><button></button><input type="checkbox">'));

		expect(c.GreatestType).toBe(CT().links);
		expect(c.Greatest).toBe(c.Links);
	});

	test('a tie goes to the earlier category (Links, Clickable, Checkboxes, Radio Buttons)', () => {
		let c = make(build('<input type="radio"><input type="checkbox"><button></button>'));

		expect(c.GreatestType).toBe(CT().clickable);
	});

	test('is undefined when nothing is categorized', () => {
		expect(make([]).GreatestType).toBeUndefined();
	});

	test('Counts reports every category', () => {
		let c = make(build('<a href="/1"></a><input type="checkbox"><input type="checkbox">'));

		expect(Object.fromEntries(c.Counts)).toEqual({ Links: 1, Clickable: 0, Checkboxes: 2, 'Radio Buttons': 0 });
	});

	test('All concatenates every category', () => {
		let c = make(build('<input id="cb" type="checkbox"><a id="a" href="/1"></a><button id="b"></button>'));

		expect(ElementsOf(c.All)).toEqual(['a', 'b', 'cb']);
	});
});

describe('constructor', () => {
	test('accepts any iterable, such as a Set', () => {
		let [a] = build('<a id="a" href="/1"></a>');

		expect(ElementsOf(make(new Set([a])).Links)).toEqual(['a']);
	});

	test('rejects non-iterables with a TypeError', () => {
		expect(() => make(42)).toThrow('CategorizedCollection requires an interable for its first parameter.');
	});

	test('an empty collection has empty categories', () => {
		expect(make().All).toEqual([]);
	});
});

describe('font score filtering', () => {
	const links = (...scores) => build(scores.map((score, i) => `<a id="l${i}" href="/${i}" data-score="${score}"></a>`).join(''));

	beforeEach(() => {
		useScores();
		run('Prefs.DisableFontWeightFiltering = false');
	});

	test('keeps only the links with the highest score, and records the rest as filtered', () => {
		let c = make(links(1640, 1640, 1240));

		expect(ElementsOf(c.Links)).toEqual(['l0', 'l1']);
		expect(ElementsOf(c.FilteredLinks)).toEqual(['l2']);
	});

	test('clickable elements are filtered too', () => {
		let c = make(build('<button id="b0" data-score="1640"></button><button id="b1" data-score="1240"></button>'));

		expect(ElementsOf(c.Clickable)).toEqual(['b0']);
		expect(ElementsOf(c.FilteredClickable)).toEqual(['b1']);
	});

	test('checkboxes are never filtered', () => {
		let c = make(build('<input type="checkbox" id="c0" data-score="1640"><input type="checkbox" id="c1" data-score="1240">'));

		expect(ElementsOf(c.Checkboxes)).toEqual(['c0', 'c1']);
	});

	test('holding Alt disables filtering', () => {
		run('LastModifierKeys = ALT');

		let c = make(links(1640, 1240));

		expect(ElementsOf(c.Links)).toEqual(['l0', 'l1']);
		expect(c.FilteredLinks).toEqual([]);
	});

	test('the DisableFontWeightFiltering pref disables filtering', () => {
		run('Prefs.DisableFontWeightFiltering = true');

		expect(ElementsOf(make(links(1640, 1240)).Links)).toEqual(['l0', 'l1']);
	});

	test('a larger font wins even when the smaller font has fewer score digits', () => {
		let c = make(links(1640, 940));

		expect(ElementsOf(c.Links)).toEqual(['l0']);
	});
});

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
	({ run } = loadScriptsInDom(['StoragePrefs.js', 'globals.js', 'content-scripts/Utility.js', 'content-scripts/CategorizedCollection.js'], undefined, Declared));
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
		['href="#"', '<a id="a" href="#">x</a>'],
		['href=" # "', '<a id="a" href=" # ">x</a>'],
		['the address of the same page and an empty #', '<a id="a" href="http://localhost/#">x</a>'],
	])('anchors with %s are clickable, not links', (_label, html) => {
		let c = make(build(html));

		expect(ElementsOf(c.Clickable)).toEqual(['a']);
		expect(c.Links).toEqual([]);
	});

	test('inputs and buttons are sorted by type', () => {
		let c = make(build(`
			<input id="sub" type="submit"><input id="rst" type="reset"><input id="btn" type="BUTTON"><button id="b">b</button>
			<input id="cb" type="checkbox"><input id="rd" type="radio">`));

		expect(ElementsOf(c.Clickable)).toEqual(['sub', 'rst', 'btn', 'b']);
		expect(ElementsOf(c.Checkboxes)).toEqual(['cb']);
		expect(ElementsOf(c.RadioButtons)).toEqual(['rd']);
	});

	test.each([
		['a place on the same page (a table of contents)', '#section-2'],
		['the same page and a #fragment (a hash route such as #inbox)', 'http://localhost/#inbox'],
		['a #/ path (single page apps)', '#/videos'],
		['another page with a #fragment', 'http://localhost/other#top'],
		['another page and an empty #', 'http://localhost/other#'],
	])('anchors with %s are links', (_label, href) => {
		let c = make(build(`<a id="a" href="${href}">x</a>`));

		expect(ElementsOf(c.Links)).toEqual(['a']);
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
		let c = make(build(`<span id="s" role="${role}">s</span>`));

		expect(ElementsOf(c[category])).toEqual(['s']);
	});

	test('elements with unknown roles are ignored', () => {
		expect(make(build('<span id="s" role="tab"></span>')).All).toEqual([]);
	});

	test.each(['tab', 'combobox', 'menuitem', 'switch'])('a button with role=%s is that widget, not a clickable button', (role) => {
		expect(make(build(`<button id="b" role="${role}">b</button>`)).All).toEqual([]);
	});

	test('a button with role=link is still clicked: it has no URL to open', () => {
		let c = make(build('<button id="b" role="link">Go</button>'));

		expect(ElementsOf(c.Clickable)).toEqual(['b']);
		expect(c.Links).toEqual([]);
		expect(c.GreatestType).toBe(run('CT_CLICKABLE'));
	});

	test('a button with role=checkbox is a checkbox', () => {
		let c = make(build('<button id="b" role="checkbox">b</button>'));

		expect(ElementsOf(c.Checkboxes)).toEqual(['b']);
	});
});

describe('GreatestType', () => {
	const CT = () => ({ links: run('CT_LINKS'), clickable: run('CT_CLICKABLE'), checkboxes: run('CT_CHECKBOXES'), radios: run('CT_RADIOBUTTONS') });

	test('is the category with the most elements, and Greatest is its list', () => {
		let c = make(build('<a href="/1">1</a><a href="/2">2</a><button>b</button><input type="checkbox">'));

		expect(c.GreatestType).toBe(CT().links);
		expect(c.Greatest).toBe(c.Links);
	});

	test('a tie goes to the earlier category (Links, Checkboxes, Radio Buttons)', () => {
		expect(make(build('<input type="radio"><input type="checkbox">')).GreatestType).toBe(CT().checkboxes);
		expect(make(build('<input type="checkbox"><a href="/1">1</a>')).GreatestType).toBe(CT().links);
	});

	test.each([
		['a link', '<a href="/1">video</a>', 'links'],
		['a checkbox', '<input type="checkbox">', 'checkboxes'],
		['a radio button', '<input type="radio">', 'radios'],
		['nothing else', '', 'clickable'],
	])('buttons are clicked only when the lasso holds nothing else (#282): three buttons and %s', (_label, html, expected) => {
		let c = make(build(`<button>Save</button><button>Share</button><a href="javascript:void(0)">hide</a>${html}`));

		expect(c.GreatestType).toBe(CT()[expected]);
	});

	test('is undefined when nothing is categorized', () => {
		expect(make([]).GreatestType).toBeUndefined();
	});

	test('Counts reports every category', () => {
		let c = make(build('<a href="/1">1</a><input type="checkbox"><input type="checkbox">'));

		expect(Object.fromEntries(c.Counts)).toEqual({ Links: 1, Clickable: 0, Checkboxes: 2, 'Radio Buttons': 0 });
	});

	test('All concatenates every category', () => {
		let c = make(build('<input id="cb" type="checkbox"><a id="a" href="/1">1</a><button id="b">b</button>'));

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
		let c = make(build('<button id="b0" data-score="1640">b</button><button id="b1" data-score="1240">b</button>'));

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

describe('controls of the page itself are never selected', () => {
	test.each([
		['opens a menu (aria-haspopup)', '<button id="x" aria-haspopup="menu">Options</button>'],
		['opens a popup (aria-haspopup=true)', '<div id="x" role="button" aria-haspopup="true">More</div>'],
		['shows or hides a part of the page (aria-expanded)', '<button id="x" aria-expanded="false">Show more</button>'],
		['switches something on or off (aria-pressed)', '<button id="x" aria-pressed="false">Like 12K</button>'],
		['is disabled', '<button id="x" disabled>Send</button>'],
		['is disabled (aria-disabled)', '<span id="x" role="button" aria-disabled="true">Next</span>'],
		['shows only an icon', '<button id="x" aria-label="More actions"><svg></svg></button>'],
		['shows only a symbol', '<button id="x">⋮</button>'],
		['shows only a count beside its icon (SoundCloud like)', '<button id="x" title="Like" aria-label="Like"><svg></svg>17</button>'],
		['shows only a short count', '<button id="x">1.2K</button>'],
		['is a script link that shows only a symbol', '<a id="x" href="javascript:void(0)">×</a>'],
	])('a button that %s', (_label, html) => {
		let c = make(build(html));

		expect(c.All).toEqual([]);
		expect(c.GreatestType).toBeUndefined();
	});

	test('a custom button whose disabled property is set', () => {
		let [x] = build('<div id="x" role="button">Send</div>');
		x.disabled = true;

		expect(make([x]).All).toEqual([]);
	});

	test('a button in a disabled fieldset', () => {
		build('<fieldset disabled><button id="x">Send</button></fieldset>');

		expect(make([document.getElementById('x')]).All).toEqual([]);
	});

	test.each([
		['aria-haspopup="false"', '<button id="x" aria-haspopup="false">Save</button>'],
		['aria-disabled="false"', '<button id="x" aria-disabled="false">Save</button>'],
		['text in another script', '<button id="x">保存</button>'],
		['a count in its label', '<button id="x">Load 20 more</button>'],
		['an input button without a value (shows Submit)', '<input id="x" type="submit">'],
	])('a button with %s stays clickable', (_label, html) => {
		expect(ElementsOf(make(build(html)).Clickable)).toEqual(['x']);
	});

	test('a link that also opens a menu is still a link: it leads to a page', () => {
		let c = make(build('<a id="a" href="/products" aria-haspopup="true" aria-expanded="false">Products</a>'));

		expect(ElementsOf(c.Links)).toEqual(['a']);
	});

	test('checkboxes that are switches stay checkboxes', () => {
		let c = make(build('<button id="s" role="switch" aria-checked="false"></button><div id="d" role="checkbox" aria-checked="true"></div>'));

		expect(ElementsOf(c.Checkboxes)).toEqual(['s', 'd']);
	});

	test('a row of video cards: the title links are selected, none of the card buttons (YouTube)', () => {
		useScores();
		run('Prefs.DisableFontWeightFiltering = false');

		let card = (n) => `
			<a id="thumb${n}" href="/watch?v=${n}" aria-hidden="true" tabindex="-1" data-score="1040">12:34</a>
			<a id="title${n}" href="/watch?v=${n}" data-score="1450">Video ${n}</a>
			<a id="channel${n}" href="/@channel" data-score="1240">Channel</a>
			<button id="menu${n}" aria-label="More actions" data-score="1450"><svg></svg></button>`;
		let c = make(build(card(1) + card(2) + card(3) + card(4) + `
			<button id="subscribe" aria-label="Subscribe" data-score="1450">Subscribe</button>
			<button id="viewAll" data-score="1450">View all</button>
			<button id="more" aria-label="Description, tap for more" data-score="1450">...more</button>
			<button id="next" aria-label="Next" data-score="1450"><svg></svg></button>
			<button id="chip" role="tab" data-score="1333">Popular</button>`));

		expect(c.GreatestType).toBe(run('CT_LINKS'));
		expect(ElementsOf(c.ActOn)).toEqual(['title1', 'title2', 'title3', 'title4']);
	});
});

describe('ActOn', () => {
	test('is one link to each page when links are acted upon: the one showing the most text, a title rather than its thumbnail', () => {
		let c = make(build('<a id="v1" href="/1"><img src="t.jpg">12:34</a><a id="t1" href="/1">Video one</a><a id="t2" href="/2">Two</a><input type="checkbox">'));

		expect(ElementsOf(c.ActOn)).toEqual(['t1', 't2']);
	});

	test('keeps document order', () => {
		let c = make(build('<a id="a" href="/a">A</a><a id="b" href="/b">A much longer title</a><a id="c" href="/c">C</a>'));

		expect(ElementsOf(c.ActOn)).toEqual(['a', 'b', 'c']);
	});

	test('is the greatest category otherwise', () => {
		let c = make(build('<a id="a" href="/1"></a><input id="c1" type="checkbox"><input id="c2" type="checkbox"><button id="b">b</button>'));

		expect(ElementsOf(c.ActOn)).toEqual(['c1', 'c2']);
	});

	test('is empty when nothing is selected', () => {
		expect(make([]).ActOn).toEqual([]);
	});
});

describe('links that show nothing (icons)', () => {
	const vote = (n) => `<a id="up${n}" href="/vote?id=${n}&how=up"><div title="upvote"></div></a><a id="story${n}" href="https://example.com/${n}">Story ${n}</a>`;

	test('are left out when the lasso also holds links that show text (Hacker News vote arrows)', () => {
		let c = make(build(vote(1) + vote(2)));

		expect(ElementsOf(c.Links)).toEqual(['story1', 'story2']);
	});

	test.each([
		['an image', '<a id="i" href="/v/1"><img src="t.jpg"></a>'],
		['a picture', '<a id="i" href="/v/1"><picture></picture></a>'],
		['only a number (a duration over a thumbnail)', '<a id="i" href="/v/1">12:34</a>'],
		['only punctuation (a pager\'s »)', '<a id="i" href="/v/1">»</a>'],
		['only a bracket (a pager\'s [ for page 1)', '<a id="i" href="/v/1">[</a>'],
	])('a link showing %s shows content', (_label, html) => {
		let c = make(build(html + '<a id="t" href="/v/2">Title</a>'));

		expect(ElementsOf(c.Links)).toEqual(['i', 't']);
	});

	test.each(['⬇', '×', '★', '▲'])('a link that shows only the symbol %s is an icon, so rows of a checkbox and it toggle the checkbox', (symbol) => {
		let c = make(build(`<input id="c1" type="checkbox"><a id="d1" href="/get/1"><i>${symbol}</i></a>`));

		expect(c.GreatestType).toBe(run('CT_CHECKBOXES'));
	});

	test('a link that shows only an icon font glyph (a private-use character) is an icon', () => {
		let c = make(build('<a id="f" href="https://share.example/"><i>\uf099</i></a><a id="t" href="/v/2">Title</a>'));

		expect(ElementsOf(c.Links)).toEqual(['t']);
	});

	test('a link that shows only an SVG icon is an icon', () => {
		let c = make(build('<a id="s" href="https://share.example/?u=1"><svg></svg></a><a id="t" href="/v/2">Title</a>'));

		expect(ElementsOf(c.Links)).toEqual(['t']);
	});

	test('a link without text or a picture that is larger than an icon shows content (a CSS background thumbnail, a card overlay)', () => {
		let [thumb] = build('<a id="bg" href="/v/1" style="background-image: url(t.jpg)"></a><a id="t" href="/v/2">Title</a>');
		thumb.getBoundingClientRect = () => ({ width: 200, height: 112 });

		expect(ElementsOf(make([thumb, document.getElementById('t')]).Links)).toEqual(['bg', 't']);
	});

	test('a link larger than an icon shows content even with an SVG in it (a CSS background thumbnail with a play icon)', () => {
		let [thumb, title] = build('<a id="bg" href="/v/1" style="background-image: url(t.jpg)"><svg></svg></a><a id="t" href="/v/2">Title</a>');
		thumb.getBoundingClientRect = () => ({ width: 320, height: 180 });

		expect(ElementsOf(make([thumb, title]).Links)).toEqual(['bg', 't']);
	});

	test('an icon link of 48 by 48 pixels (a touch target) is still an icon', () => {
		let [icon, title] = build('<a id="s" href="https://share.example/"><svg></svg></a><a id="t" href="/v/2">Title</a>');
		icon.getBoundingClientRect = () => ({ width: 48, height: 48 });

		expect(ElementsOf(make([icon, title]).Links)).toEqual(['t']);
	});

	test('are left out next to checkboxes, so rows of a checkbox and an icon link toggle the checkboxes', () => {
		let c = make(build('<input id="c1" type="checkbox"><a id="d1" href="/get/1"><i></i></a><input id="c2" type="checkbox"><a id="d2" href="/get/2"><i></i></a>'));

		expect(c.Links).toEqual([]);
		expect(c.GreatestType).toBe(run('CT_CHECKBOXES'));
	});

	test('are kept when no link shows anything, so a lasso over icons alone still works', () => {
		let c = make(build('<a id="a" href="/a"><svg></svg></a><a id="b" href="/b"><i class="icon"></i></a>'));

		expect(ElementsOf(c.Links)).toEqual(['a', 'b']);
	});

	test('holding Alt keeps them', () => {
		run('LastModifierKeys = ALT');

		expect(ElementsOf(make(build(vote(1))).Links)).toEqual(['up1', 'story1']);
	});
});

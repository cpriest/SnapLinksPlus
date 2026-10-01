'use strict';

/**
 * jsdom has no layout engine.  These helpers tell elements where they are, and give the page a size, so scripts
 * that depend on geometry (getClientRects, elementFromPoint, scroll dimensions) can run.
 */

/* global jest */

/** [top, left, bottom, right] → a DOMRect-like object */
const rectOf = ([top, left, bottom, right]) => ({ top, left, bottom, right, width: right - left, height: bottom - top });

/** Places the element at the given [top, left, bottom, right] client rect(s) */
function place(el, ...rects) {
	el.getClientRects = () => rects.map(rectOf);
	return el;
}

/** Replaces the body contents and returns the elements that have an id, keyed by id */
function build(html) {
	document.body.innerHTML = html;
	return Object.fromEntries(Array.from(document.body.querySelectorAll('[id]')).map(el => [el.id, el]));
}

function setDocumentSize(width, height) {
	Object.defineProperty(document.documentElement, 'scrollWidth', { value: width, configurable: true });
	Object.defineProperty(document.documentElement, 'scrollHeight', { value: height, configurable: true });
}

/** Elements that were never placed answer with a single empty rect at the origin, like an element in an empty layout */
function stubEmptyLayout() {
	Element.prototype.getClientRects = () => [rectOf([0, 0, 0, 0])];
}

/**
 * Makes document.elementFromPoint hit-test the given placements.
 *
 * @param {Object<string, number[]>}  placements   id → [top, left, bottom, right]
 * @param {Object<string, Element>}   els          id → element
 * @param {Object<string, string>}    [coveredBy]  id → id of the element that covers it
 */
function stubHitTesting(placements, els, coveredBy = {}) {
	document.elementFromPoint = jest.fn((x, y) => {
		let hit = Object.entries(placements).find(([, [t, l, b, r]]) => x >= l && x <= r && y >= t && y <= b);
		return (hit && els[coveredBy[hit[0]]]) || (hit && els[hit[0]]) || document.body;
	});
}

/**
 * Records every listener added from now on so they can all be removed, as the scripts attach theirs to the
 * shared jsdom document and would otherwise keep reacting in later tests.
 *
 * @return {function(): void}  Removes the recorded listeners and restores addEventListener
 */
function trackListeners() {
	let original = EventTarget.prototype.addEventListener,
		added    = [];

	EventTarget.prototype.addEventListener = function(type, fn, options) {
		added.push([this, type, fn, options]);
		return original.call(this, type, fn, options);
	};

	return () => {
		EventTarget.prototype.addEventListener = original;
		for(let [target, type, fn, options] of added)
			target.removeEventListener(type, fn, options);
	};
}

module.exports = { rectOf, place, build, setDocumentSize, stubEmptyLayout, stubHitTesting, trackListeners };

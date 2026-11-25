/**
 * @jest-environment jsdom
 */
'use strict';

/* global test, expect, describe, beforeEach, jest, require */

const { loadScriptsInDom } = require('./_support/loadScripts');

let CreateElement;

beforeEach(() => {
	let { run } = loadScriptsInDom(['StoragePrefs.js', 'CSP.js', 'globals.js', 'content-scripts/Utility.js']);
	CreateElement = run('CreateElement');
});

describe('CreateElement', () => {
	test('builds a <style> element with its CSS, owned by the page and not attached yet', () => {
		let style = CreateElement('\n\t<style>\n\t\t.x { color: red; }\n\t</style>\n');

		expect(style.tagName).toBe('STYLE');
		expect(style.textContent).toContain('.x { color: red; }');
		expect(style.ownerDocument).toBe(document);
		expect(style.parentNode).toBeNull();
	});

	test('builds an element tree', () => {
		let div = CreateElement('<div class="A">\t<div class="B">\t\t<div class="C"></div>\t</div></div>');

		expect(div.className).toBe('A');
		expect(div.querySelector('.B > .C')).not.toBeNull();
		expect(div.parentNode).toBeNull();
	});

	test('builds SVG elements in the SVG namespace', () => {
		let svg = CreateElement('<svg class="S" xmlns="http://www.w3.org/2000/svg"><rect width="0" height="0"/> <!-- a comment --></svg>');

		expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
		expect(svg.firstElementChild.namespaceURI).toBe('http://www.w3.org/2000/svg');
		expect(svg.firstElementChild.tagName).toBe('rect');
	});

	test('does not assign innerHTML, which web-ext lint reports as UNSAFE_VAR_ASSIGNMENT', () => {
		let innerHTML = jest.spyOn(Element.prototype, 'innerHTML', 'set');

		CreateElement('<div></div>');

		expect(innerHTML).not.toHaveBeenCalled();
		innerHTML.mockRestore();
	});
});

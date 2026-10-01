'use strict';

/**
 * Loads the extension's plain-global browser scripts into an isolated vm context so they can be
 * tested without adding module.exports to them.  Scripts share one global lexical scope, exactly as
 * they do when listed together in manifest.hbs, so list them in manifest order.
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const SrcDir = path.resolve(__dirname, '../../src');

/**
 * An in-memory stand-in for browser.storage.{local,sync}
 *
 * @param {object} [initial]    Starting contents
 */
function makeStorageArea(initial = {}) {
	let data = { ...initial };

	return {
		data,
		get: jest.fn(async (key) => {
			if(key === undefined)
				return { ...data };
			return key in data ? { [key]: data[key] } : {};
		}),
		set: jest.fn(async (items) => { Object.assign(data, items); }),
		remove: jest.fn(async (key) => { delete data[key]; }),
	};
}

/**
 * @param {{local?: object, sync?: object}} [stores]    Starting contents of each storage area
 */
function makeBrowser({ local, sync } = {}) {
	let changeListeners = [];

	return {
		storage: {
			local:     makeStorageArea(local),
			sync:      makeStorageArea(sync),
			onChanged: { addListener: (fn) => changeListeners.push(fn) },
		},
		runtime: { sendMessage: jest.fn() },
		/** Simulates the browser notifying every storage.onChanged listener */
		fireStorageChanged: (changes, area) => changeListeners.forEach(fn => fn(changes, area)),
	};
}

/**
 * @param {string[]} files             Files relative to src/, in load order
 * @param {object}   [browser]         The browser mock to expose, defaults to an empty makeBrowser()
 * @param {object}   [globals]         Extra globals for the context (eg: navigator, chrome), or overrides such as location
 *
 * @return {{ctx: object, run: function(string): *, browser: object}}
 *      run() evaluates an expression in the context, which is how top-level let/class bindings are reached.
 */
function loadScripts(files, browser = makeBrowser(), globals = {}) {
	let ctx = vm.createContext({
		browser,
		document: { documentElement: {}, readyState: 'complete', addEventListener() {} },
		window:   { addEventListener() {} },
		location: { protocol: 'moz-extension:' },
		setTimeout,
		clearTimeout,
		setInterval,
		clearInterval,
		...globals,
	});

	// Created inside the context, globals.js adds methods to Function.prototype and console that must live in that realm
	vm.runInContext('console = { log() {}, info() {}, warn() {}, error() {} };', ctx);

	for(let file of files)
		vm.runInContext(fs.readFileSync(path.join(SrcDir, file), 'utf8'), ctx, { filename: file });

	return { ctx, browser, run: (expr) => vm.runInContext(expr, ctx) };
}

/**
 * jsdom's selector engine mishandles some upper-case tag names (eg: `DIV.x`, `closest('LABEL')`), which browsers
 * match case-insensitively for HTML elements.  Lower-cases leading tag names to restore browser behavior.
 * SVG is deliberately excluded: it is not an HTML element, so browsers match it case-sensitively and `SVG` never matches <svg>.
 */
function installSelectorShim() {
	const fix = (selector) => typeof selector !== 'string' ? selector
		: selector.replace(/(^|[\s,>+~])(?!SVG\b)([A-Z][A-Z0-9]*)(?=[.#[:\s,>+~]|$)/g, (m, lead, tag) => lead + tag.toLowerCase());

	for(let [proto, names] of [[Element.prototype, ['closest', 'matches', 'querySelector', 'querySelectorAll']], [Document.prototype, ['querySelector', 'querySelectorAll']]]) {
		for(let name of names) {
			if(proto[name].shimmed)
				continue;
			let original = proto[name];
			proto[name]  = Object.assign(function(selector, ...rest) { return original.call(this, fix(selector), ...rest); }, { shimmed: true });
		}
	}
}

/**
 * Like loadScripts() but runs the scripts against the real (jsdom) `document`/`window` of the current jest environment,
 * for test files that declare `@jest-environment jsdom`.  The scripts are wrapped in a function so their top-level
 * bindings stay private; `console` and `browser` are passed in so globals.js can't patch the test runner's console.
 *
 * @param {string[]} files        Files relative to src/, in load order
 * @param {object}   [browser]    The browser mock to expose
 * @param {string[]} [declare]    Globals normally declared by files that aren't loaded (eg: EventHandler.js owns ElemDocRects), declared here so tests can assign them
 *
 * @return {{run: function(string): *, browser: object}}
 *      run() direct-evals an expression inside the scripts' scope, which is how top-level bindings are read and assigned.
 */
function loadScriptsInDom(files, browser = makeBrowser(), declare = []) {
	installSelectorShim();

	let source  = files.map(file => fs.readFileSync(path.join(SrcDir, file), 'utf8')).join('\n'),
		console = { log() {}, info() {}, warn() {}, error() {} };

	let run = new Function('browser', 'console', `${source}\n${declare.length ? `let ${declare.join(', ')};` : ''}\nreturn (expr) => eval(expr);`)(browser, console);

	return { run, browser };
}

module.exports = { loadScripts, loadScriptsInDom, makeBrowser };

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
 *
 * @return {{ctx: object, run: function(string): *, browser: object}}
 *      run() evaluates an expression in the context, which is how top-level let/class bindings are reached.
 */
function loadScripts(files, browser = makeBrowser()) {
	let ctx = vm.createContext({
		browser,
		document: { documentElement: {}, readyState: 'complete', addEventListener() {} },
		window:   { addEventListener() {} },
		location: { protocol: 'moz-extension:' },
		setTimeout,
		clearTimeout,
		setInterval,
		clearInterval,
	});

	// Created inside the context, globals.js adds methods to Function.prototype and console that must live in that realm
	vm.runInContext('console = { log() {}, info() {}, warn() {}, error() {} };', ctx);

	for(let file of files)
		vm.runInContext(fs.readFileSync(path.join(SrcDir, file), 'utf8'), ctx, { filename: file });

	return { ctx, browser, run: (expr) => vm.runInContext(expr, ctx) };
}

module.exports = { loadScripts, makeBrowser };

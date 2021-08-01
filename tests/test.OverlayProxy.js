'use strict';

/* global require */
/* global jest, afterAll, afterEach, beforeAll, beforeEach, */
/* global 	describe, test, xtest, skip, todo */
/* global	expect */

const { OverlayProxy } = require('../src/DeepProxy.js');

const Util = require('util');

const base = {
	Dev: {
		Mode:   false,
		Skip:   {
			Actions: true,
		},
		Report: {
			IndexTimes: true,
		},
		css:    'background: red;',
		types:  ['links', 'checkboxes'],
	},
};

const origBase = JSON.parse(JSON.stringify(base));

const over = {
	Dev:    {
		Mode: true,
	},
	Report: {},

	eggs: {
		over: {
			easy: false,
		},
	},
};

const origOver = JSON.parse(JSON.stringify(over));


function inspectAll(arg) {
	console.log(Util.inspect(arg, {
		showHidden: true,
		showProxy:  true,
		depth:      Math.Infinity,
	}));
}

function inspect(arg) {
	console.log(Util.inspect(arg, {
		depth: Math.Infinity,
	}));
}

self.inspect    = inspect;
self.inspectAll = inspectAll;

/**
 *  - Get
 *    - Should return base value if no overlay value
 *    - Should return overlay value if set
 *
 *  - Set
 *    - Should never modify base layer, all changes are on overlay, base is immutable
 *    - Should allow setting overlay of compatible base value type or extension of undefined (OpenOverlayProxy?)
 *    - Should not allow setting overlay of incompatible base value type (ignoring/allowing undefined)
 *    - Should clear the overlay value if set to value equal to base value
 *    -
 *
 *  - Thoughts
 *    - How to get type of base[key]/over[key]
 *
 */

/** @type {OverlayProxy} */
const ap = new OverlayProxy(base, over);

expect(JSON.stringify(base))
	.toBe(JSON.stringify(origBase));
expect(JSON.stringify(over))
	.toBe(JSON.stringify(origOver));

describe('OverlayProxy Get', () => {

	test('Returns base value with no overlay set', async () => {
		expect(ap.Dev.Skip.Actions)
			.toBe(base.Dev.Skip.Actions);
	});

	test('Returns overlayed value for value in overlay', async () => {
		expect(ap.Dev.Mode)
			.toBe(over.Dev.Mode);
	});

	test('A deep path should be an empty object', async () => {
		let x = ap.Random.Path.Into.Proxy;

		expect(typeof x)
			.toEqual('object');
		expect(Object.keys(x))
			.toEqual([]);
	});

});

describe('OverlayProxy Set', () => {

	test('A deep path should be settable', async () => {
		ap.Second.Random.Path.Into.Proxy = 'test-value';
		expect(ap.Second.Random.Path.Into.Proxy)
			.toBe('test-value');
	});

	test('Should allow setting overlay of compatible base value type or extension of undefined (OpenOverlayProxy?)', async () => {
		ap.Dev.Skip.Actions = false;

		expect(ap.Dev.Skip.Actions)
			.toBe(false);

		expect(ap.Dev.Skip.Actions)
			.toBe(over.Dev.Skip.Actions);

		expect(base.Dev.Skip.Actions)
			.toBe(origBase.Dev.Skip.Actions);
	});

	test('Should not allow setting overlay value to incompatible base value type (ignoring/allowing undefined)', async () => {
		expect(() => ap.Dev.Skip.Actions = 'true')
			.toThrow();
		expect(() => ap.Dev.Report.IndexTimes = ['true'])
			.toThrow();
		expect(() => ap.Dev.css = {})
			.toThrow();
		expect(() => ap.Dev.types[0] = true)
			.toThrow();
		expect(() => ap.Dev.types[1] = {})
			.toThrow();
		expect(() => ap.Dev.types = {})
			.toThrow();
	});

	test('Should clear the overlay value if set to value equal to base value', async () => {
		ap.Dev.Mode = !base.Dev.Mode;	// Set to what base isn't (in overlay)
		ap.Dev.Mode = false;			// Set to what base is (should clear overlay)

		expect(over.Dev.Mode)
			.toBeUndefined();
	});

	test('Should not be able to set overlay to an base-incompatible object value', async () => {
		expect(() => {
			ap.Dev.Skip = {
				Actions: 'true',
			};
		})
			.toThrow();
	});
	test('Should be able to set overlay to an base-compatible object value', async () => {
		ap.Dev.Skip = {
			Actions: false,
			Testing: 'blah',
		};
		expect(over.Dev.Skip.Actions)
			.toBe(false);
		expect(over.Dev.Skip.Testing)
			.toBe('blah');

		// Revert
		delete ap.Dev.Skip.Testing;
	});
});

describe('OverlayProxy other handlers', () => {
	test('ownKeys are correct', async () => {
		expect(Object.keys(ap.Dev.Skip))
			.toEqual(['Actions']);

		ap.Dev.Skip.Actions2 = true;
		expect(Object.keys(ap.Dev.Skip))
			.toEqual(['Actions', 'Actions2']);

		// Revert
		delete ap.Dev.Skip.Actions2;
		expect(Object.keys(ap.Dev.Skip))
			.toEqual(['Actions']);
	});

	test('delete of base key fails', () => {
		expect(() => delete ap.Dev.Skip.Actions)
			.toThrow();
	});

	test('Test for has on (in operator) base key', () => {
		expect('Mode' in ap.Dev)
			.toBe(true);
	});

	test('Test for has (in operator) on overlay key', () => {
		ap.Dev.Report.IndexRaces = true;
		expect('IndexRaces' in ap.Dev.Report)
			.toBe(true);

		delete ap.Dev.Report.IndexRaces;

		expect('missing key' in ap.Dev.Report)
			.toBe(false);
	});

	test('Cannot setPrototypeOf', () => {
		expect(() => Object.setPrototypeOf(ap.Dev, Array))
			.toThrow();
	});

	test('getPrototypeOf base works', () => {
		expect(Object.getPrototypeOf(ap.Dev.Skip))
			.toStrictEqual(Object.prototype);
	});

	test('getPrototypeOf over works (predefined)', () => {
		expect(Object.getPrototypeOf(ap.eggs.over.easy))
			.toStrictEqual(Boolean.prototype);
	});

	test('getPrototypeOf over works (undefined)', () => {
		expect(Object.getPrototypeOf(ap.eggs.over.hard))
			.toStrictEqual(Object.prototype);
	});

	test('Disallow defineProperty on existing base', () => {
		expect(() => Object.defineProperty(ap.Dev, 'Skip', { value: true }))
			.toThrow();
	});

	test('Disallow defineProperty on existing overlay', () => {
		expect(() => Object.defineProperty(ap.eggs, 'over', { value: true }))
			.toThrow();
	});

	test('Allow defineProperty on overlay of new property', () => {
		expect(() => Object.defineProperty(ap.eggs, 'scrambled', { value: true }))
			.not
			.toThrow();

		expect(ap.eggs.scrambled)
			.toBe(true);
	});

});

afterAll(() => {
	expect(JSON.stringify(base))
		.toBe(JSON.stringify(origBase));
});

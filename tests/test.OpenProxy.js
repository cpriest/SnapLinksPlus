'use strict';

/* global jest, test, expect, require, describe */

const { OpenProxy } = require('../src/DeepProxy.js');

const data = {
	a: {
		b:  {
			c: 1487,
		},
		b1: [
			89, 776, 42,
		],
	},
};

const ap = new OpenProxy(data);

test('OpenProxy returns deep value', async () => {
	expect(ap.a.b.c)
		.toBe(data.a.b.c);
	expect(ap.a.b1.length)
		.toBe(data.a.b1.length);
	expect(ap.a.b1[1])
		.toBe(data.a.b1[1]);
});

test('OpenProxy returns new object', async () => {
	expect(ap.a1)
		.not
		.toBeUndefined();
});

describe('Set new deep value and retrieve', () => {
	test('set / retrieve through proxy', (done) => {
		ap.a1.b.c.d.e.f = 42;

		expect(ap.a1.b.c.d.e.f)
			.toBe(42);

		done();
	});

	test('Retrieve value from original data', (done) => {
		expect(data.a1.b.c.d.e.f)
			.toBe(42);

		done();
	});
});


'use strict';

/* global jest, test, expect, require */

const { DeepProxy } = require('../src/DeepProxy.js');

const data  = {
	a: {
		b:  {
			c: 1487,
		},
		b1: [
			89, 776, 42,
		],
	},
};
const b1Sum = data.a.b1.reduce((prev, cur) => prev + cur, 0);

const dp = new DeepProxy(data);

test('DeepProxy returns deep value', async () => {
	expect(dp.a.b.c)
		.toBe(data.a.b.c);
	expect(dp.a.b1.length)
		.toBe(data.a.b1.length);
	expect(dp.a.b1[1])
		.toBe(data.a.b1[1]);
});

test('Iterate over deep array value', async () => {
	let sum2 = 0;
	for(let val of dp.a.b1)
		sum2 += val;

	expect(sum2)
		.toBe(b1Sum);
});

test('Array reduce deep array', async () => {
	let sum2 = dp.a.b1.reduce((prev, cur) => prev + cur, 0);

	expect(sum2)
		.toBe(b1Sum);
});

test('DeepProxy returns undefined', async () => {
	expect(dp.a1)
		.toBeUndefined();
});

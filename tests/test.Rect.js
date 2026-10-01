'use strict';

/* global test, expect, describe, require */

const { loadScripts } = require('./_support/loadScripts');

const { run } = loadScripts(['content-scripts/SelectionRect.js']);
const Rect    = run('Rect');

describe('Rect', () => {
	test('constructor sets edges and derives width/height', () => {
		let r = new Rect(10, 20, 50, 80);

		expect(r).toMatchObject({ top: 10, left: 20, bottom: 50, right: 80, width: 60, height: 40 });
	});

	test('defaults to an empty rect at the origin', () => {
		expect(new Rect()).toMatchObject({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 });
	});

	describe('SetOrigin / SetBottomRight', () => {
		test('drag down and right', () => {
			let r = new Rect();
			r.SetOrigin(100, 200);
			r.SetBottomRight(150, 260);

			expect(r).toMatchObject({ top: 100, left: 200, bottom: 150, right: 260, width: 60, height: 50 });
		});

		test('drag up and left normalizes so top/left are the lowest values', () => {
			let r = new Rect();
			r.SetOrigin(100, 200);
			r.SetBottomRight(40, 150);

			expect(r).toMatchObject({ top: 40, left: 150, bottom: 100, right: 200, width: 50, height: 60 });
		});

		test('drag past the origin on one axis only', () => {
			let r = new Rect();
			r.SetOrigin(100, 200);
			r.SetBottomRight(150, 120);

			expect(r).toMatchObject({ top: 100, left: 120, bottom: 150, right: 200 });
		});

		test('repeated moves recompute from the origin rather than accumulate', () => {
			let r = new Rect();
			r.SetOrigin(100, 100);
			r.SetBottomRight(300, 300);
			r.SetBottomRight(120, 130);

			expect(r).toMatchObject({ top: 100, left: 100, bottom: 120, right: 130 });
		});
	});

	describe('Expand', () => {
		test('grows every side by the given amount', () => {
			expect(new Rect(10, 10, 20, 30).Expand(2, 5))
				.toMatchObject({ top: 5, bottom: 25, left: 8, right: 32, width: 24, height: 20 });
		});

		test('negative values shrink', () => {
			expect(new Rect(10, 10, 30, 30).Expand(-5, -5))
				.toMatchObject({ top: 15, bottom: 25, left: 15, right: 25, width: 10, height: 10 });
		});
	});

	describe('Intersects', () => {
		let base = () => new Rect(100, 100, 200, 200);

		test.each([
			['overlapping corner', new Rect(150, 150, 250, 250)],
			['fully contained', new Rect(120, 120, 130, 130)],
			['fully containing', new Rect(0, 0, 500, 500)],
			['crossing like a plus sign', new Rect(0, 150, 500, 160)],
			['sharing only an edge', new Rect(200, 100, 300, 200)],
			['sharing only a corner point', new Rect(200, 200, 300, 300)],
		])('%s intersects', (_name, other) => {
			expect(base().Intersects(other)).toBe(true);
			expect(other.Intersects(base())).toBe(true);
		});

		test.each([
			['above', new Rect(0, 100, 99, 200)],
			['below', new Rect(201, 100, 300, 200)],
			['left of', new Rect(100, 0, 200, 99)],
			['right of', new Rect(100, 201, 200, 300)],
			['diagonal', new Rect(300, 300, 400, 400)],
		])('%s does not intersect', (_name, other) => {
			expect(base().Intersects(other)).toBe(false);
			expect(other.Intersects(base())).toBe(false);
		});
	});

	describe('ClipTo', () => {
		test('clips to the overlap of both rects', () => {
			expect(new Rect(0, 0, 100, 100).ClipTo(new Rect(50, 25, 200, 75)))
				.toMatchObject({ top: 50, left: 25, bottom: 100, right: 75, width: 50, height: 50 });
		});

		test('clipping to a larger rect changes nothing', () => {
			expect(new Rect(10, 10, 20, 20).ClipTo(new Rect(0, 0, 100, 100)))
				.toMatchObject({ top: 10, left: 10, bottom: 20, right: 20 });
		});
	});

	test('toString includes every edge and dimension', () => {
		expect(new Rect(1, 2, 3, 5).toString())
			.toBe('{ top: 1, left: 2, bottom: 3, right: 5, width: 3, height: 2 }');
	});
});

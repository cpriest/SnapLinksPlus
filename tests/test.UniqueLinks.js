'use strict';

/* global test, expect, describe, beforeEach, require, URL, URLSearchParams */

const { loadScripts } = require('./_support/loadScripts');

const Scripts = ['StoragePrefs.js', 'globals.js', 'content-scripts/Utility.js'];

let run;

beforeEach(async () => {
	({ run } = loadScripts(Scripts, undefined, { URL, URLSearchParams }));
	await run('DOMReady');
});

const key = (href) => run('SamePageKey')(href);

describe('SamePageKey', () => {
	test.each([
		['http vs https', 'http://example.com/page', 'https://example.com/page'],
		['a leading www.', 'https://www.example.com/page', 'https://example.com/page'],
		['a trailing slash', 'https://example.com/page/', 'https://example.com/page'],
		['the root path', 'https://example.com/', 'https://example.com'],
		['the #anchor', 'https://example.com/page#comments', 'https://example.com/page'],
		['tracking parameters', 'https://example.com/page?utm_source=feed&utm_medium=rss&fbclid=x1', 'https://example.com/page'],
		['tracking parameters next to real ones', 'https://example.com/page?id=7&gclid=abc', 'https://example.com/page?id=7'],
		['the order of parameters', 'https://example.com/page?b=2&a=1', 'https://example.com/page?a=1&b=2'],
		['the case of the host', 'https://EXAMPLE.com/page', 'https://example.com/page'],
		['a default port', 'https://example.com:443/page', 'https://example.com/page'],
	])('ignores %s', (_label, a, b) => {
		expect(key(a)).toBe(key(b));
	});

	test.each([
		['paths', 'https://example.com/a', 'https://example.com/b'],
		['parameter values', 'https://example.com/page?id=1', 'https://example.com/page?id=2'],
		['hosts', 'https://example.com/page', 'https://example.org/page'],
		['subdomains', 'https://blog.example.com/page', 'https://example.com/page'],
		['ports', 'https://example.com:8080/page', 'https://example.com/page'],
		['the case of the path', 'https://example.com/Page', 'https://example.com/page'],
		['#/ routes of single page apps', 'https://example.com/#/inbox', 'https://example.com/#/sent'],
		['#! routes of single page apps', 'https://example.com/#!/inbox', 'https://example.com/#!/sent'],
	])('keeps different %s apart', (_label, a, b) => {
		expect(key(a)).not.toBe(key(b));
	});

	test.each([
		'mailto:someone@example.com',
		'ftp://example.com/file#part',
		'not a url',
	])('returns %s unchanged when it is not an http(s) URL', (href) => {
		expect(key(href)).toBe(href);
	});
});

describe('UniqueLinks', () => {
	const links = (...hrefs) => hrefs.map(href => ({ href }));
	const unique = (on, list) => {
		run('(on) => { Prefs = { SmartDuplicateDetection: on }; }')(on);
		return run('UniqueLinks')(list).map(l => l.href);
	};
	const list = links('https://a.test/1', 'https://a.test/1#top', 'http://www.a.test/1/', 'https://a.test/2', 'https://a.test/1');

	test('keeps the first link to each page, in order, when SmartDuplicateDetection is on', () => {
		expect(unique(true, list)).toEqual(['https://a.test/1', 'https://a.test/2']);
	});

	test('removes only identical hrefs when SmartDuplicateDetection is off', () => {
		expect(unique(false, list)).toEqual(['https://a.test/1', 'https://a.test/1#top', 'http://www.a.test/1/', 'https://a.test/2']);
	});

	test('returns the link elements themselves', () => {
		run('Prefs = { SmartDuplicateDetection: true }');

		expect(run('UniqueLinks')(list)[1]).toBe(list[3]);
	});

	test('SmartDuplicateDetection is on by default', () => {
		expect(run('DefaultPrefs').SmartDuplicateDetection).toBe(true);
	});
});

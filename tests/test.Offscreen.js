/**
 * @jest-environment jsdom
 *
 * The offscreen document Chrome's service worker opens to copy (src/html/offscreen.html, src/lib/Offscreen.js).
 */
'use strict';

/* global test, expect, beforeEach, jest, require, __dirname */

const fs   = require('fs');
const path = require('path');

const Html   = fs.readFileSync(path.resolve(__dirname, '../src/html/offscreen.html'), 'utf8');
const Script = fs.readFileSync(path.resolve(__dirname, '../src/lib/Offscreen.js'), 'utf8');

let listener, execCommand;

beforeEach(() => {
	document.body.innerHTML = Html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
	execCommand             = document.execCommand = jest.fn(() => true);	// jsdom has no execCommand

	let chrome = { runtime: { onMessage: { addListener: (fn) => { listener = fn; } } } };
	new Function('chrome', Script)(chrome);
});

test('copies the text it is sent, and answers whether that worked', () => {
	let respond = jest.fn();

	listener({ Action: 'OffscreenCopy', text: 'http://a/\nhttp://b/' }, {}, respond);

	expect(document.getElementById('Clipboard').value).toBe('http://a/\nhttp://b/');
	expect(execCommand).toHaveBeenCalledWith('copy');
	expect(respond).toHaveBeenCalledWith(true);
});

test('leaves other messages to other listeners (content scripts\' messages reach this page too)', () => {
	let respond = jest.fn();

	expect(listener({ Action: 'OpenUrlsInTabs', tUrls: [] }, {}, respond)).toBeUndefined();
	expect(execCommand).not.toHaveBeenCalled();
	expect(respond).not.toHaveBeenCalled();
});

test('the background sends the action name this page answers to', () => {
	expect(fs.readFileSync(path.resolve(__dirname, '../src/background-scripts/OffscreenClipboard.js'), 'utf8')).toMatch(/OFFSCREEN_COPY\s*=\s*'OffscreenCopy'/);
});

'use strict';

/* global test, expect, describe, beforeAll, require, __dirname, process */

const fs            = require('fs');
const path          = require('path');
const vm            = require('vm');
const { execFileSync } = require('child_process');

const Root    = path.resolve(__dirname, '..');
const Package = require('../package.json');

const Targets = ['ff', 'chrome'];

const read   = (...parts) => fs.readFileSync(path.join(Root, ...parts));
const exists = (...parts) => fs.existsSync(path.join(Root, ...parts));

const readManifest = (target) => JSON.parse(read('build', target, 'manifest.json'));

const ScriptSrcs = (html) => Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g), m => m[1]);

/**
 * The scripts the background loads, in order, relative to the build: Firefox lists them in the manifest, Chrome's service
 * worker loads them with importScripts(), which this runs (with the build's manifest) to see which.
 */
function BackgroundScripts(target) {
	let m = readManifest(target);

	if(m.background.scripts)
		return m.background.scripts;

	let worker   = m.background.service_worker,
		imported = [];

	vm.runInNewContext(read('build', target, worker).toString(), {
		chrome:        { runtime: { getManifest: () => m } },
		importScripts: (...files) => imported.push(...files.map(file => path.posix.normalize(path.posix.join(path.posix.dirname(worker), file)))),
	});
	return [worker, ...imported];
}

beforeAll(() => {
	// Run gulp's JS entry with this node: node_modules/.bin/gulp is a shell script, which execFileSync can't run on Windows
	let GulpDir = path.join(Root, 'node_modules/gulp');
	execFileSync(process.execPath, [path.join(GulpDir, require(path.join(GulpDir, 'package.json')).bin.gulp), 'default'], { cwd: Root, stdio: 'pipe' });
}, 60000);

describe.each(Targets)('build/%s', (target) => {
	const manifest = () => readManifest(target);

	test('manifest.json is valid and carries the package version', () => {
		expect(manifest().manifest_version).toBe(3);
		expect(target === 'ff' ? manifest().version : manifest().version_name).toBe(Package.version);
	});

	test('every script and page the manifest references exists in the build', () => {
		let m    = manifest();
		let refs = [
			...BackgroundScripts(target),
			...m.content_scripts.flatMap(cs => cs.js),
			m.options_ui.page,
			...Object.values(m.icons),
		];

		for(let ref of refs)
			expect({ ref, exists: exists('build', target, ref) }).toEqual({ ref, exists: true });
	});

	test('scripts loaded by the options page exist in the build', () => {
		let page = manifest().options_ui.page;

		for(let src of ScriptSrcs(read('build', target, page).toString())) {
			let resolved = path.posix.normalize(path.posix.join(path.posix.dirname(page), src));
			expect({ resolved, exists: exists('build', target, resolved) }).toEqual({ resolved, exists: true });
		}
	});

	test('production builds contain no Dev* files or dev commands', () => {
		let m = manifest();
		let scripts = [...BackgroundScripts(target), ...m.content_scripts.flatMap(cs => cs.js)];

		expect(scripts.filter(s => /Dev/.test(path.basename(s)))).toEqual([]);
		expect(Object.keys(m.commands)).toEqual([]);
	});

	test('browser-polyfill is bundled for Chrome only', () => {
		let m         = manifest();
		let hasPoly   = (list) => list.includes('src/lib/browser-polyfill.js');

		expect(hasPoly(BackgroundScripts(target))).toBe(target === 'chrome');
		expect(hasPoly(m.content_scripts[0].js)).toBe(target === 'chrome');
	});

	test('binary resources are copied byte-for-byte (gulp 5 corrupts PNGs without encoding: false)', () => {
		let icons = fs.readdirSync(path.join(Root, 'res')).filter(f => f.endsWith('.png'));

		expect(icons.length).toBeGreaterThan(0);
		for(let icon of icons)
			expect({ icon, identical: read('res', icon).equals(read('build', target, 'res', icon)) }).toEqual({ icon, identical: true });
	});
});

test('Firefox manifest declares the gecko id and data collection policy', () => {
	let gecko = readManifest('ff').browser_specific_settings.gecko;

	expect(gecko.id).toBe('snaplinks@snaplinks.mozdev.org');
	expect(gecko.data_collection_permissions).toEqual({ required: ['none'] });
});

describe('Firefox Manifest V3', () => {
	const ff = () => readManifest('ff');

	test('the background scripts run as an event page: no persistent flag, no service worker', () => {
		let bg = ff().background;

		expect(bg.scripts.length).toBeGreaterThan(0);
		expect(bg).not.toHaveProperty('persistent');
		expect(bg).not.toHaveProperty('service_worker');
		expect(bg).not.toHaveProperty('page');
	});

	test('has no keys that Manifest V3 removed or reshaped', () => {
		let m = ff();

		for(let key of ['browser_action', 'page_action', 'applications'])
			expect(m).not.toHaveProperty(key);
		expect(m.options_ui).toEqual({ page: 'src/html/options.html' });	// chrome_style and browser_style are Manifest V2 only
		if('content_security_policy' in m)
			expect(typeof m.content_security_policy).toBe('object');
		if('web_accessible_resources' in m)
			expect(m.web_accessible_resources.every(war => typeof war === 'object')).toBe(true);
	});

	test('asks for the same API permissions as before, and for sites only through its content scripts', () => {
		let m = ff();

		expect(m.permissions).toEqual(['cookies', 'storage', 'notifications', 'clipboardWrite', 'browserSettings']);
		expect(m.optional_permissions).toEqual(['bookmarks']);
		expect(m).not.toHaveProperty('host_permissions');
		expect(m).not.toHaveProperty('optional_host_permissions');
		expect(m.content_scripts.map(cs => cs.matches)).toEqual([['<all_urls>']]);
	});
});

describe('Chrome Manifest V3', () => {
	const chrome = () => readManifest('chrome');

	test('the background is a service worker that loads the polyfill, the Firefox background scripts and its offscreen clipboard', () => {
		let ff = BackgroundScripts('ff');

		expect(chrome().background).toEqual({ service_worker: 'src/background-scripts/service-worker.js' });
		expect(BackgroundScripts('chrome')).toEqual(['src/background-scripts/service-worker.js', 'src/lib/browser-polyfill.js',
			...ff.slice(0, -1), 'src/background-scripts/OffscreenClipboard.js', ff.at(-1)]);
	});

	test('the Chrome-only files are in the Chrome build and left out of the Firefox build', () => {
		let chromeOnly = ['src/background-scripts/service-worker.js', 'src/background-scripts/OffscreenClipboard.js', 'src/html/offscreen.html', 'src/lib/Offscreen.js'];

		expect(chromeOnly.filter(file => !exists('build', 'chrome', file))).toEqual([]);
		expect(chromeOnly.filter(file => exists('build', 'ff', file))).toEqual([]);
	});

	// No cookies: only Firefox uses it (containers, cookieStoreId), and the Chrome Web Store rejects unused permissions
	test('asks for the permissions it uses, plus offscreen for copying', () => {
		let m = chrome();

		expect(m.permissions).toEqual(['storage', 'notifications', 'clipboardWrite', 'offscreen']);
		expect(m.optional_permissions).toEqual(['bookmarks']);
		expect(m).not.toHaveProperty('host_permissions');
		expect(m.content_scripts.map(cs => cs.matches)).toEqual([['<all_urls>']]);
	});

	test('has no Manifest V2 keys, and needs Chrome 116 (runtime.getContexts)', () => {
		let m = chrome();

		for(let key of ['browser_action', 'page_action'])
			expect(m).not.toHaveProperty(key);
		expect(m.options_ui).toEqual({ page: 'src/html/options.html' });	// chrome_style is Manifest V2 only
		expect(m.minimum_chrome_version).toBe('116');
	});

	test('the offscreen document that copies, and its script, are in the build', () => {
		let page = 'src/html/offscreen.html';

		expect(exists('build', 'chrome', page)).toBe(true);
		expect(ScriptSrcs(read('build', 'chrome', page).toString())
			.map(src => path.posix.normalize(path.posix.join(path.posix.dirname(page), src)))
			.filter(file => !exists('build', 'chrome', file))).toEqual([]);
	});
});

test('the DevBuild service worker also loads DevBuild.js, before the background scripts', () => {
	let m      = readManifest('chrome'),
		loaded = [];

	vm.runInNewContext(read('build', 'chrome', m.background.service_worker).toString(), {
		chrome:        { runtime: { getManifest: () => ({ ...m, commands: { 'dev-do-1': {} } }) } },
		importScripts: (...files) => loaded.push(...files),
	});
	expect(loaded.slice(-3)).toEqual(['DevBuild.js', 'OffscreenClipboard.js', 'background.js']);
});

test.each(Targets)('build/%s scripts evaluate no strings as code (blocked by the Manifest V3 content security policy)', (target) => {
	const scripts = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
		e.isDirectory() ? scripts(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []);

	let offenders = scripts(path.join(Root, 'build', target, 'src'))
		.filter(file => !file.endsWith('browser-polyfill.js'))
		.filter(file => /\bnew Function\s*\(|\beval\s*\(/.test(fs.readFileSync(file, 'utf8')))
		.map(file => path.relative(Root, file));

	expect(offenders).toEqual([]);
});

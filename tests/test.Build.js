'use strict';

/* global test, expect, describe, beforeAll, require, __dirname */

const fs            = require('fs');
const path          = require('path');
const { execFileSync } = require('child_process');

const Root    = path.resolve(__dirname, '..');
const Package = require('../package.json');

const Targets = ['ff', 'chrome'];

const read   = (...parts) => fs.readFileSync(path.join(Root, ...parts));
const exists = (...parts) => fs.existsSync(path.join(Root, ...parts));

const readManifest = (target) => JSON.parse(read('build', target, 'manifest.json'));

const ScriptSrcs = (html) => Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g), m => m[1]);

beforeAll(() => {
	execFileSync(path.join(Root, 'node_modules/.bin/gulp'), ['default'], { cwd: Root, stdio: 'pipe' });
}, 60000);

describe.each(Targets)('build/%s', (target) => {
	const manifest = () => readManifest(target);

	test('manifest.json is valid and carries the package version', () => {
		expect(manifest().manifest_version).toBe(2);
		expect(target === 'ff' ? manifest().version : manifest().version_name).toBe(Package.version);
	});

	test('every script and page the manifest references exists in the build', () => {
		let m    = manifest();
		let refs = [
			...m.background.scripts,
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
		let scripts = [...m.background.scripts, ...m.content_scripts.flatMap(cs => cs.js)];

		expect(scripts.filter(s => /Dev/.test(path.basename(s)))).toEqual([]);
		expect(Object.keys(m.commands)).toEqual([]);
	});

	test('browser-polyfill is bundled for Chrome only', () => {
		let m         = manifest();
		let hasPoly   = (list) => list.includes('src/lib/browser-polyfill.js');

		expect(hasPoly(m.background.scripts)).toBe(target === 'chrome');
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

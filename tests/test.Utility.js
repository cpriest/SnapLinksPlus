'use strict';

/* global test, expect, require */

const { loadScripts } = require('./_support/loadScripts');

test('RateReporter fills in its ${...} placeholders without evaluating code (blocked in Manifest V3 content scripts)', () => {
	// codeGeneration.strings false makes eval() and new Function() throw, as the Manifest V3 content security policy does
	let { run } = loadScripts(['StoragePrefs.js', 'globals.js', 'content-scripts/Utility.js'], undefined, {}, { codeGeneration: { strings: false } });
	let logged = [];
	run('(log) => { console.log = (...args) => log.push(args); }')(logged);

	new (run('RateReporter'))('Found ${Count} Elements in ${Elapsed} (${PerSecond}), ${Other} stays').report(5);

	expect(logged).toHaveLength(1);
	expect(logged[0][0]).toMatch(/^Found 5 Elements in \d+(ms|(\.\d+)?s) \((\d+(\.\d+)?|Infinity)\/s\), \$\{Other\} stays$/);
});

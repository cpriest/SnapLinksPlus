'use strict';

const { FlatCompat } = require('@eslint/eslintrc');
const path = require('path');

const compat = new FlatCompat({ baseDirectory: __dirname });

const customGlobals = require('./eslint/globals').globals;
const customRules   = require('./eslint/rules').rules;

// Files that run in Node: this config, the build and run scripts. The tests get Node and Jest below.
const NodeFiles = [
	'eslint.config.js',
	'eslint/**/*.js',
	'gulpfile.js',
	'jest.config.js',
	'.webext-run.cjs',
	'scripts/**/*.{js,mjs}',
];

module.exports = [
	// Build output and local folders (all gitignored)
	{
		ignores: [
			'build/',
			'artifacts/',
			'insecure/',
			'local/',
			'SnapLinksDev*/',
		],
	},

	// Browser + webextension environments (via legacy compat)
	...compat.env({
		browser:       true,
		webextensions: true,
		es6:           true,
	}),

	// jQuery eslint ruleset (legacy compat)
	...compat.extends('jquery'),

	// Override removed ESLint 9+ rules from jquery config and apply custom config
	{
		languageOptions: {
			ecmaVersion: 2020,
			sourceType:  'script',
			globals:     customGlobals,
		},
		rules: {
			// Rules removed in ESLint 9 (were in eslint-config-jquery)
			'no-negated-in-lhs': 'off', // replaced by no-unsafe-negation
			'no-spaced-func':    'off', // replaced by func-call-spacing

			// From original .eslintrc.js top-level rules
			'template-curly-spacing': 'off',

			// Custom project rules
			...customRules,
		},
	},

	// Node files and tests: Node's globals and its current syntax (top-level await in scripts/run-browser.mjs)
	...compat.env({ node: true }).map(config => ({ ...config, files: [...NodeFiles, 'tests/**/*.js'] })),
	{
		files:           [...NodeFiles, 'tests/**/*.js'],
		languageOptions: { ecmaVersion: 'latest' },
	},
	{
		files:           ['**/*.mjs'],
		languageOptions: { sourceType: 'module' },
	},

	// Tests: Jest's globals
	...compat.env({ jest: true }).map(config => ({ ...config, files: ['tests/**/*.js'] })),
];

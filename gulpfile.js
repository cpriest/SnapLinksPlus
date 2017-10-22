/*
 * Copyright (c) 2017 Clint Priest
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
 * WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
 * CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

"use strict";

const gulp = require('gulp');
// const babel      = require('gulp-babel');
const del  = require('del').sync;
const cp   = require('child_process');
// const sourcemaps = require('gulp-sourcemaps');
const hb   = require('gulp-hb');
const fs   = require('fs');

const gutil  = require('gulp-util');
const rename = require('gulp-rename');
const merge  = require('merge-stream');

const sequence = require('run-sequence');

let execDefaultOpts = {
	stdio: 'inherit',
};

const PackageData = JSON.parse(fs.readFileSync('./package.json'));

const Chrome = {
	SecureDataPath: './insecure/Chrome',
	BuildPath     : './build/chrome',
	BuildData     : {
		Chrome      : true,
		quad_version: PackageData.version.replace(/\D+/, '.')
	}
};

const FireFox = {
	BuildPath: './build/ff',
	BuildData: {
		Firefox: true,
	}
};

const WebExtCommand = `web-ext -s ${FireFox.BuildPath} -a ./artifacts`;

/** Wrapper for child_process.spawnSync */
function npx(cmd, options = execDefaultOpts) {
	return cp.spawnSync('npx.cmd', ['-c', cmd], options);
}

const SourceFiles = [
	'src/**/*.es6',
	'src/**/*.js',

	'!**/*Test*',
	'!**/*JetBrains*',
	'!**/lib/lodash*',
	'!**/*-compiled*',
	'!**/*Playground*',
];

const UIFiles = [
	'src/**/*.htm*',
];

const ResourceFiles = [
	'res/**',

	'!res/Screenshot*'
];

const watchOpts = {
	debounceDelay: 2000
};

/**
 *        General Building Tasks
 */

gulp.task('clean', () => del(['./build/tmp']));

gulp.task('src', ['clean'], () =>
	merge(
		gulp.src(SourceFiles)
			.pipe(gulp.dest('./build/tmp/src')),
		gulp.src(UIFiles)
			.pipe(gulp.dest('./build/tmp/src'))
	)
);

gulp.task('res', ['clean'], () =>
	gulp.src(ResourceFiles)
		.pipe(gulp.dest('./build/tmp/res'))
);


gulp.task('build', ['chrome', 'ff']);

gulp.task('default', ['build'], () => {
	// gulp.watch(SourceFiles, watchOpts, ['src']);
	// gulp.watch('./defs/*.json5', watchOpts, ['defs']);
	// gulp.watch('./package.json', watchOpts, ['infra']);
});

/**
 *        Chrome Building Tasks
 */
gulp.task('chrome', ['res', 'src'], (cb) =>
	sequence(
		'chrome:clean',
		'chrome:copy-tmp',
		'chrome:manifest',
		cb
	)
);

gulp.task('chrome:clean', () => del(Chrome.BuildPath));
gulp.task('chrome:copy-tmp', () =>
	gulp.src('./build/tmp/**')
		.pipe(gulp.dest(Chrome.BuildPath))
);

gulp.task('chrome:manifest', () =>
	gulp.src('src/templates/manifest.hbs')
		.pipe(
			hb()
				.data('./package.json')
				.data(Chrome.BuildData)
		)
		.pipe(rename({
			extname: '.json',
		}))
		.pipe(gulp.dest(Chrome.BuildPath))
);

gulp.task('chrome:package', ['chrome'], () => {
	const SigningFilepath = `${Chrome.SecureDataPath}/ChromeExtension.pem`;

	if(!fs.existsSync(SigningFilepath))
		return console.error('Unable to pack Chrome extension, signing PEM file not available.');

	npx(`crx pack ${Chrome.BuildPath} -o ./artifacts/SnapLinks-${Chrome.BuildData.quad_version}.crx -p ${SigningFilepath}`);
});


/**
 *        Firefox Building Tasks
 */

gulp.task('ff', ['res', 'src'], (cb) =>
	sequence(
		'ff:clean',
		'ff:copy-tmp',
		'ff:manifest',
		cb
	)
);

gulp.task('ff:clean', () => del(FireFox.BuildPath));
gulp.task('ff:copy-tmp', () =>
	gulp.src('./build/tmp/**')
		.pipe(gulp.dest(FireFox.BuildPath))
);

gulp.task('ff:manifest', () =>
	gulp.src('src/templates/manifest.hbs')
		.pipe(
			hb()
				.data('./package.json')
				.data(FireFox.BuildData)
		)
		.pipe(rename({
			extname: '.json',
		}))
		.pipe(gulp.dest(FireFox.BuildPath))
);

gulp.task('ff:package', ['firefox'], (cb) => {
	npx(WebExtCommand + ' build --overwrite-dest');
	cb();
});

/**
 * NOTE: Using the web-ext sign will automatically upload for submission to AMO
 *
 * NOTE: To upload to the **BETA Channel**, the version string needs to match /(a|alpha|b|beta)\d+$/
 */
gulp.task('ff:sign', ['ff:package'], (cb) => {
	let SecureDataFilepath = './insecure/Firefox/api-key.json';

	if(!fs.existsSync(SecureDataFilepath)) {
		console.error("Unable to sign Firefox extension, secret data not available.");
		return;
	}

	let SecureData = JSON.parse(fs.readFileSync(SecureDataFilepath));
	npx(`${WebExtCommand} sign --api-key ${SecureData.jwt_issuer} --api-secret ${SecureData.jwt_secret}`);
	cb();
});

gulp.task('ff:lint', ['ff'], (cb) => {
	npx(`${WebExtCommand} lint`);
	cb();
});

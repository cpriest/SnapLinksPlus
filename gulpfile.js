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
const hb     = require('gulp-hb');
const fs	= require('fs');

const gutil  = require('gulp-util');
const rename = require('gulp-rename');
const merge	 = require('merge-stream');

let execDefaultOpts = {
	stdio: 'inherit',
};

const PackageData = JSON.parse(fs.readFileSync('./package.json'));

const Chrome = {
	SecureDataPath: './insecure/Chrome',
	BuildData: {
		Chrome: true,
		quad_version: PackageData.version.replace(/-\D+/, '.')
	}
};

const FireFox = {
	BuildData: {
		Firefox: true,
	}
};

const WebExtCommand = 'web-ext -s ./build -a ./artifacts';

/** Wrapper for child_process.spawnSync */
function npx(cmd, options=execDefaultOpts) {
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

gulp.task('clean', () => {
	return del(['./build']);
});

gulp.task('src', ['clean'], () => {
	return merge(
		gulp.src(SourceFiles)
			.pipe(gulp.dest('./build/src')),
		gulp.src(UIFiles)
			.pipe(gulp.dest('./build/src'))
	);
});

gulp.task('res', ['src'], () => {
	return gulp.src(ResourceFiles)
		.pipe(gulp.dest('./build/res'));
});

gulp.task('manifest:chrome', () => {
	return gulp.src('src/templates/manifest.hbs')
		.pipe(
			hb()
				.data('./package.json')
				.data(Chrome.BuildData)
		)
		.pipe(rename({
			extname: '.json',
		}))
		.pipe(gulp.dest('./build'));
});

gulp.task('manifest:ff', () => {
	return gulp.src('src/templates/manifest.hbs')
		.pipe(
			hb()
				.data('./package.json')
				.data(FireFox.BuildData)
		)
		.pipe(rename({
			extname: '.json',
		}))
		.pipe(gulp.dest('./build'));
		fs.copyFile('./build/manifest.json', '.')
});


gulp.task('build', ['src', 'res']);

gulp.task('chrome:build', ['build', 'manifest:chrome'], () => {
	const SigningFilepath = `${Chrome.SecureDataPath}/ChromeExtension.pem`;

	if(!fs.existsSync(SigningFilepath))
		return console.error('Unable to pack Chrome extension, signing PEM file not available.');

	npx(`crx pack ./build -o ./artifacts/SnapLinks-${Chrome.BuildData.quad_version}.crx -p ${SigningFilepath}`);
});

gulp.task('ff:build', ['build', 'manifest:ff'], () => {
	npx(WebExtCommand + ' build --overwrite-dest');
});

/**
 * NOTE: Using the web-ext sign will automatically upload for submission to AMO
 *
 * NOTE: To upload to the **BETA Channel**, the version string needs to match /(a|alpha|b|beta)\d+$/
 */
gulp.task('ff:build-sign', ['ff:build'], () => {
	let SecureDataFilepath = './insecure/Firefox/api-key.json';

	if(!fs.existsSync(SecureDataFilepath)) {
		console.error("Unable to sign Firefox extension, secret data not available.");
		return;
	}

	let SecureData = JSON.parse(fs.readFileSync(SecureDataFilepath));
	npx(WebExtCommand + ` sign --api-key ${SecureData.jwt_issuer} --api-secret ${SecureData.jwt_secret}`);
});

gulp.task('ff:lint', ['build', 'manifest:ff'], () => {
	npx('web-ext -s ./build -a ./artifacts lint');
});


gulp.task('default', ['build'], () => {
	// gulp.watch(SourceFiles, watchOpts, ['src']);
	// gulp.watch('./defs/*.json5', watchOpts, ['defs']);
	// gulp.watch('./package.json', watchOpts, ['infra']);
});

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
const fs = require('fs');
// const run = require('gulp-run-command').default;

// const gutil  = require('gulp-util');
const rename = require('gulp-rename');
// const merge  = require('merge-stream');

const sequence = require('run-sequence');


let execDefaultOpts = {
	stdio: 'inherit',
};

const PackageData = JSON.parse(fs.readFileSync('./package.json'));

const Chrome = {
	ArtifactsPath:	'./artifacts/chrome',
	BuildPath     : './build/chrome',
	BuildData     : {
		Chrome      : true,
		quad_version: PackageData.version.replace(/[^\d.]+/g, '.')
	}
};

const FireFox = {
	ArtifactsPath: './artifacts/ff',
	BuildPath:     './build/ff',
	BuildData:     {
		Firefox: true,
	}
};

/** Wrapper for child_process.spawnSync */
function exec(cmd, options = execDefaultOpts) {
	// console.log(cmd);
	return cp.spawnSync('cmd.exe', ['/A', '/D', '/C', cmd], options);
}

const TaskGlobs = new Map(),
		SpecialGlobs = new Map();

TaskGlobs.set('root', [
	'LICENSE',
]);

TaskGlobs.set('src', [
	'src/**/*.js',

	'!**/*Test*',
	'!**/*JetBrains*',
	'!**/lib/lodash*',
	'!**/*-compiled*',
	'!**/*Playground*',
]);

TaskGlobs.set('lib', [
	'node_modules/webextension-polyfill/dist/browser-polyfill.min.js',
	'node_modules/js-csp/build/csp.min.js'
]);
TaskGlobs.set('ui', [
	'src/**/*.htm*',
]);
TaskGlobs.set('res', [
	'res/**/*Logo*.png',
]);

SpecialGlobs.set('manifest', [
	'src/templates/*.hbs',
	'package.json'
]);

const watchOpts = {
	debounceDelay: 2000
};

/**
 *        General Building Tasks
 */

gulp.task('clean', () => del(['./build/tmp']));

gulp.task('root', ['clean'], () =>
	gulp.src(TaskGlobs.get('root'))
		.pipe(gulp.dest('./build/tmp'))
);

gulp.task('src', ['clean'], () =>
	gulp.src(TaskGlobs.get('src'))
		.pipe(gulp.dest('./build/tmp/src'))
);

gulp.task('ui', ['clean'], () =>
	gulp.src(TaskGlobs.get('ui'))
		.pipe(gulp.dest('./build/tmp/src'))
);

gulp.task('res', ['clean'], () =>
	gulp.src(TaskGlobs.get('res'))
		.pipe(gulp.dest('./build/tmp/res'))
);

gulp.task('lib', ['clean'], () =>
	gulp.src(TaskGlobs.get('lib'))
		.pipe(gulp.dest('./build/tmp/src/lib'))
);

gulp.task('build:tmp', Array.from(TaskGlobs.keys()));

gulp.task('build', ['chrome', 'ff']);

gulp.task('default', ['build'], () => {
	// gulp.watch(SourceFiles, watchOpts, ['src']);
	// gulp.watch('./defs/*.json5', watchOpts, ['defs']);
	// gulp.watch('./package.json', watchOpts, ['infra']);
});

gulp.task('watch', ['build'], (cb) => {
	let files = [].concat(...TaskGlobs.values(), ...SpecialGlobs.values());
	let watcher = gulp.watch(files, watchOpts, ['build']);
	watcher.on('change', (e) => {
		console.log(`${new Date} - ${e.path} changed, rebuilding...`);
	});
});


let webext = (cmd, data) => `web-ext ${cmd} -s ${data.BuildPath} -a ${data.ArtifactsPath} -o`;


/*************************************************************************************************
 *   Chrome Building Tasks
 ************************************************************************************************/
gulp.task('chrome', ['build:tmp'], (cb) =>
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
	exec(webext('build', Chrome));
});


/*************************************************************************************************
 *        Firefox Building Tasks
 ************************************************************************************************/

gulp.task('ff', ['build:tmp'], (cb) =>
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

gulp.task('ff:package', ['ff'], (cb) => {
	exec(webext('build', FireFox));
	cb();
});

/**
 * NOTE: Using the web-ext sign will automatically upload for submission to AMO
 */
gulp.task('ff:sign', ['ff:package'], (cb) => {
	let SecureDataFilepath = './insecure/Firefox/api-key.json';

	if(!fs.existsSync(SecureDataFilepath)) {
		console.error("Unable to sign Firefox extension, secret data not available.");
		return;
	}

	let SecureData = JSON.parse(fs.readFileSync(SecureDataFilepath));
	exec(webext(`sign --api-key ${SecureData.jwt_issuer} --api-secret ${SecureData.jwt_secret}`, FireFox));
	cb();
});

gulp.task('ff:lint', ['ff'], (cb) => {
	exec(webext('lint', FireFox));
	cb();
});

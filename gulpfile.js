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

const gulp       = require('gulp');
// const babel      = require('gulp-babel');
const del        = require('del').sync;
const execSync   = require('child_process').execSync;
const sourcemaps = require('gulp-sourcemaps');

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
	gulp.src(SourceFiles)
		// .pipe(sourcemaps.init())
		// .pipe(babel())
		// .pipe(sourcemaps.write('.'))
		.pipe(gulp.dest('./build/src'));

	gulp.src(UIFiles)
		.pipe(gulp.dest('./build/src'));
	// gulp.src('code/**/*.js')
	// 	.pipe(sourcemaps.init())
	// 	// .pipe(babel())
	// 	.pipe(sourcemaps.write('.'))
	// 	.pipe(gulp.dest('./build/code'));
});

gulp.task('res', ['src'], () => {
	gulp.src(ResourceFiles)
		.pipe(gulp.dest('./build/res'));

	// gulp.src('code/**/*.js')
	// 	.pipe(sourcemaps.init())
	// 	// .pipe(babel())
	// 	.pipe(sourcemaps.write('.'))
	// 	.pipe(gulp.dest('./build/code'));
});

// gulp.task('defs', () => {
// 	del(['./build/defs']);
// 	gulp.src('./defs/*.json5')
// 		.pipe(gulp.dest('./build/defs'));
//
// });

// gulp.task('samples', () => {
// 	del(['./build/defs']);
//
// 	let output = execSync('git ls-files defs', { encoding: 'utf8' }),
// 		files  = output
// 			.trim()
// 			.split("\n");
//
// 	gulp.src(files)
// 		.pipe(gulp.dest('./build/defs'));
//
// });

// gulp.task('infra', () => {
// 	gulp.src('./package.json')
// 		.pipe(gulp.dest('./build'));
// });

gulp.task('build', ['src', 'res']);

gulp.task('default', ['build'], () => {
	// gulp.watch(SourceFiles, watchOpts, ['src']);
	// gulp.watch('./defs/*.json5', watchOpts, ['defs']);
	// gulp.watch('./package.json', watchOpts, ['infra']);
});

// gulp.task('release', ['src'], () => {
//
// });

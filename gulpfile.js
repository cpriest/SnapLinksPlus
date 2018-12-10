'use strict';

const gulp					= require('gulp');
const { series, parallel } = gulp;

// const babel      = require('gulp-babel');
const del = require('del').sync;
const cp	= require('child_process');
// const sourcemaps = require('gulp-sourcemaps');
const hb	= require('gulp-hb');
const fs	= require('fs');

// const gutil  = require('gulp-util');
const rename = require('gulp-rename');
const merge	= require('merge-stream');


let execDefaultOpts = {
	stdio: 'inherit',
};

const PackageData = JSON.parse(fs.readFileSync('./package.json'));

const Chrome = {
	ArtifactsPath: './artifacts/chrome',
	BuildPath:		'./build/chrome',
	BuildData:		{
		Chrome:			true,
		quad_version: PackageData.version.replace(/[^\d.]+/g, '.')
	}
};

const FireFox = {
	ArtifactsPath: './artifacts/ff',
	BuildPath:		'./build/ff',
	BuildData:		{
		Firefox: true,
	}
};

/** Wrapper for child_process.spawnSync */
function exec(cmd, options = execDefaultOpts) {
	// console.log(cmd);
	return cp.spawn('cmd.exe', ['/A', '/D', '/C', cmd], options);
}

const TaskGlobs		= new Map(),
		SpecialGlobs = new Map();

TaskGlobs.set('', [
	'LICENSE',
]);

TaskGlobs.set('src', [
	'src/**/*.js',

	'!**/*Test*',
	'!**/*JetBrains*',
	'!**/lib/lodash*',
	'!**/*-compiled*',
	'!**/*Playground*',

	// ui
	'src/**/*.htm*',
]);

TaskGlobs.set('src/lib', [
	'node_modules/webextension-polyfill/dist/browser-polyfill.min.js',
	'node_modules/js-csp/dist/js-csp.min.js'
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

function buildTmp() {
	del(['./build/tmp']);

	return merge(...
		Array.from(TaskGlobs.keys())
			.map((key) =>
				gulp.src(TaskGlobs.get(key))
					.pipe(gulp.dest(`./build/tmp/${key}`))
			)
	);
}

let webext = (cmd, data) => `web-ext ${cmd} -s ${data.BuildPath} -a ${data.ArtifactsPath} -o`;

function buildFor({ BuildPath, BuildData }) {
	del(BuildPath);

	return merge(
		gulp.src('./build/tmp/**')
			.pipe(gulp.dest(BuildPath)),
		gulp.src('src/templates/manifest.hbs')
			.pipe(
				hb()
					.data('./package.json')
					.data(BuildData)
			)
			.pipe(rename({
				extname: '.json',
			}))
			.pipe(gulp.dest(BuildPath))
	);
}

/*************************************************************************************************
 *   Chrome Building Tasks
 ************************************************************************************************/

function buildChrome() { return buildFor(Chrome); }

gulp.task('chrome:package', series(buildChrome, () => {
	return exec(webext('build', Chrome));
}));

/*************************************************************************************************
 *        Firefox Building Tasks
 ************************************************************************************************/

function buildFirefox() { return buildFor(FireFox); }

let PackageFirefox = series(buildFirefox, () => {
	return exec(webext('build', FireFox));
});

/**
 * NOTE: Using the web-ext sign will automatically upload for submission to AMO
 */
let SignFirefox = series(PackageFirefox, () => {
	let SecureDataFilepath = './insecure/Firefox/api-key.json';

	if(!fs.existsSync(SecureDataFilepath)) {
		console.error('Unable to sign Firefox extension, secret data not available.');
		return;
	}

	let SecureData = JSON.parse(fs.readFileSync(SecureDataFilepath));
	return exec(webext(`sign --api-key ${SecureData.jwt_issuer} --api-secret ${SecureData.jwt_secret}`, FireFox));
});

let LintFirefox = series(buildFirefox, () => {
	return exec(webext('lint', FireFox));
});

/*************************************************************************************************
 *  Main Build Tasks
 ************************************************************************************************/

module.exports.default = series(
	buildTmp,
	parallel(buildChrome, buildFirefox)
);

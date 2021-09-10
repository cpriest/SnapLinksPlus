'use strict';

/* global require */

const gulp                 = require('gulp');
const { series, parallel } = gulp;

// const babel      = require('gulp-babel');
const del = require('del').sync;
const cp  = require('child_process');
// const sourcemaps = require('gulp-sourcemaps');
const hb  = require('gulp-hb');
const fs  = require('fs');

// const gutil  = require('gulp-util');
const rename = require('gulp-rename');
const merge  = require('merge-stream');

let execDefaultOpts = {
	stdio: 'inherit',
};

const PackageData = JSON.parse(fs.readFileSync('./package.json'));

const Chrome = {
	ArtifactsPath: './artifacts/chrome',
	BuildPath:     './build/chrome',
	BuildData:     {
		Chrome:       true,
		quad_version: PackageData.version.replace(/[^\d.]+/g, '.'),
	},
};

const FireFox = {
	ArtifactsPath: './artifacts/ff',
	BuildPath:     './build/ff',
	BuildData:     {
		Firefox: true,
	},
};

/** This is passed to all handlebar builds */
const GeneralBuildConfig = {};

/** Wrapper for child_process.spawnSync */
function exec(cmd, options = execDefaultOpts) {
	// console.log(cmd);
	return cp.spawn('cmd.exe', ['/A', '/D', '/C', cmd], options);
}

const TaskGlobs    = new Map(),
		SpecialGlobs = new Map();

TaskGlobs.set('', [
	'LICENSE',
]);

TaskGlobs.set('src', [
	'src/**/*.js',

	'!**/*Test*',
	'!**/*JetBrains*',
	'!**/*-compiled*',
	'!**/*Playground*',
	'!**/Dev*',

	// ui
	'src/**/*.htm*',
]);

TaskGlobs.set('src/lib', [
	'node_modules/webextension-polyfill/dist/browser-polyfill.js',
]);

TaskGlobs.set('res', [
	'res/**/*.png',
	'!res/Marketing/*.png',
]);

SpecialGlobs.set('manifest', [
	'src/templates/*.hbs',
	'package.json',
]);

const watchOpts = {
	delay:         500,
	ignoreInitial: false,

};

/**
 *  General Building Tasks
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

let webext = (cmd, data) => `web-ext ${cmd} -s ${data.BuildPath} -a ${data.ArtifactsPath} `;

function buildFor({ BuildPath, BuildData }) {
	del(BuildPath);

	return merge(
		gulp.src('./build/tmp/**')
			.pipe(gulp.dest(BuildPath)),
		gulp.src('src/templates/manifest.hbs')
			.pipe(
				hb()
					.helpers(require('handlebars-cond'))
					.data('./package.json')
					.data(BuildData)
					.data(GeneralBuildConfig)
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

let PackageChrome = series(buildChrome, () => {
	return exec(webext('build --overwrite-dest', Chrome));
});

let PublishChrome = series(PackageChrome, (done) => {
	console.warn('Chrome Publishing is not yet supported.');
	done();
});

/*************************************************************************************************
 *        Firefox Building Tasks
 ************************************************************************************************/

function buildFirefox() { return buildFor(FireFox); }

let PackageFirefox = series(buildFirefox, () => {
	return exec(webext('build --overwrite-dest', FireFox));
});

/**
 * NOTE: Using the web-ext sign will automatically upload for submission to AMO
 */
let PublishFirefox = series(PackageFirefox, () => {
	let SecureDataFilepath = './insecure/Firefox/api-key.json';

	if(!fs.existsSync(SecureDataFilepath)) {
		console.error('Unable to sign Firefox extension, secret data not available.');
		return;
	}

	let SecureData = JSON.parse(fs.readFileSync(SecureDataFilepath));
	return exec(webext(`sign --api-key ${SecureData.jwt_issuer} --api-secret ${SecureData.jwt_secret}`, FireFox));
});

//noinspection JSUnusedLocalSymbols
let LintFirefox = series(buildFirefox, () => {
	return exec(webext('lint', FireFox));
});

/*************************************************************************************************
 *  Main Build Tasks
 ************************************************************************************************/

let buildAll = series(
	buildTmp,
	parallel(buildChrome, buildFirefox)
);

function watch() {
	// Set DevBuild to true for 'gulp watch'
	GeneralBuildConfig.DevBuild = true;

	// Remove the '!**/Dev*' string from the src map for 'gulp watch'
	let srcFiles = TaskGlobs.get('src');
	srcFiles.splice(srcFiles.indexOf('!**/Dev*'), 1);
	TaskGlobs.set('src', srcFiles);

	function building(done) {
		console.log('\nFiles Changed, building...');
		done();
	}

	function built(done) {
		fs.writeFileSync('./build/build.json', JSON.stringify({
			buildVersion: PackageData.version,
			buildTime:    Date.now()
								.toString(),
		}));
		done();
	}

	let WatchGlobs = Array.from([...TaskGlobs.values(), ...SpecialGlobs.values()])
		.flat();

	gulp.watch(WatchGlobs,
		watchOpts,
		series(building, buildAll, built));
}

module.exports = {

	default: buildAll,

	watch: watch,

	package: series(
		buildTmp,
		parallel(PackageFirefox, PackageChrome)
	),

	publish: series(
		buildTmp,
		parallel(PublishFirefox, PublishChrome)
	),
};

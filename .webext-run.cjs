/**
 * The web-ext run options for each browser that scripts/run-browser.mjs starts.  The script adds the start URL (an index of test/).
 */
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const IsWindows = process.platform == 'win32';

/** The development profile of a browser: in the project on Linux/macOS, in %LOCALAPPDATA% on Windows (not on the WSL share) */
const profile = (linuxName, browser) => IsWindows
	? path.join(process.env.LOCALAPPDATA, 'SnapLinksDev', browser)
	: path.join(__dirname, linuxName);

/** The first of the files that exists */
const firstFile = (...files) => files.find(f => f && fs.existsSync(f));

const Common = {
	keepProfileChanges: true,
	reload:             true,
	watchFile:          [path.join(__dirname, 'build', 'build.json')],
};

const Chromium = (browser, binary) => ({
	sourceDir: path.join(__dirname, 'build', 'chrome'),
	run:       {
		...Common,
		target:          ['chromium'],
		chromiumProfile: profile(`SnapLinksDev-${browser}`, browser),
		chromiumBinary:  binary,
	},
});

module.exports = {
	firefox: {
		sourceDir: path.join(__dirname, 'build', 'ff'),
		run:       {
			...Common,
			// Absolute: a bare name makes web-ext pass `-P SnapLinksDev`, which Firefox treats as a profile *name* from its profile manager
			firefoxProfile:         profile('SnapLinksDev', 'firefox'),
			profileCreateIfMissing: true,
			pref:                   {
				'extensions.background.idle.timeout': '5000',	// The event page (MV3) unloads after 5 s idle, not 30 s, so code that forgets it can be unloaded fails in testing
				...(IsWindows ? {} : { 'layout.css.devPixelsPerPx': '1.25' }),	// Scales the whole browser; WSLg windows are tiny on high-DPI screens
			},
			// FIREFOX overrides; then a copy in ~/.local/bin (found even when PATH lacks it, eg: `su -c`); then web-ext's alias, which
			// finds Developer Edition on Windows/macOS and `firefox-developer-edition` on PATH on Linux
			firefox: process.env.FIREFOX || firstFile(path.join(os.homedir(), '.local/bin/firefox-developer-edition')) || 'firefoxdeveloperedition',
		},
	},
	// On Windows and macOS web-ext (chrome-launcher) finds Chrome.  Not on Linux: under WSL it picks the Windows Chrome, which it cannot drive.
	chrome: Chromium('chrome', process.env.CHROME || (process.platform == 'linux'
		? firstFile('/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium')
		: undefined)),
	edge:   Chromium('edge', process.env.EDGE || (IsWindows
		? firstFile(...['ProgramFiles(x86)', 'ProgramFiles'].map(dir => process.env[dir] && path.join(process.env[dir], 'Microsoft/Edge/Application/msedge.exe')))
		: firstFile('/usr/bin/microsoft-edge-stable', '/usr/bin/microsoft-edge', '/opt/microsoft/msedge/msedge'))),
};

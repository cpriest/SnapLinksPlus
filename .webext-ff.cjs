const fs   = require('fs');
const os   = require('os');
const path = require('path');

module.exports = {
	sourceDir: path.join(__dirname, 'build', 'ff'),
	run: {
		// Absolute: a bare name makes web-ext pass `-P SnapLinksDev`, which Firefox treats as a profile *name* from its profile manager
		firefoxProfile:         path.join(__dirname, 'SnapLinksDev'),
		profileCreateIfMissing: true,
		keepProfileChanges:     true,
		reload:                 true,
		startUrl:               [`file://${path.join(__dirname, 'test', 'regressions.html')}`],
		watchFile: [path.join(__dirname, 'build', 'build.json')],
		// Scales the whole browser; WSLg windows are tiny on high-DPI screens
		pref: { 'layout.css.devPixelsPerPx': '1.25' },
		// FIREFOX overrides; then a copy in ~/.local/bin (found even when PATH lacks it, eg: `su -c`); then web-ext's alias, which
		// finds Developer Edition on Windows/macOS and `firefox-developer-edition` on PATH on Linux
		firefox:   process.env.FIREFOX || [path.join(os.homedir(), '.local/bin/firefox-developer-edition')].find(f => fs.existsSync(f)) || 'firefoxdeveloperedition',
	},
};

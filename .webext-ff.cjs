const path = require('path');

module.exports = {
	sourceDir: path.join(__dirname, 'build', 'ff'),
	run: {
		// Absolute: a bare name makes web-ext pass `-P SnapLinksDev`, which Firefox treats as a profile *name* from its profile manager
		firefoxProfile:         path.join(__dirname, 'SnapLinksDev'),
		profileCreateIfMissing: true,
		keepProfileChanges:     true,
		reload:                 true,
//		startUrl:               [`file://${__dirname}/test/test_links.html`, 'about:addons', 'about:devtools-toolbox?id=snaplinks%40snaplinks.mozdev.org&type=extension'],
		watchFile: [path.join(__dirname, 'build', 'build.json')],
		// The alias finds Developer Edition on Windows/macOS, and `firefox-developer-edition` on PATH on Linux; FIREFOX overrides it
		firefox:   process.env.FIREFOX || 'firefoxdeveloperedition',
	},
};

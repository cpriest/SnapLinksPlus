module.exports = {
	sourceDir: './build/ff/',
	run: {
		firefoxProfile:         `SnapLinksDev`,
		profileCreateIfMissing: true,
		keepProfileChanges:     true,
		reload:                 true,
//		startUrl:               [`file://${__dirname}/test/test_links.html`, 'about:addons', 'about:devtools-toolbox?id=snaplinks%40snaplinks.mozdev.org&type=extension'],
		watchFile: [`${__dirname}\\build\\build.json`],
		firefox:   'firefoxdeveloperedition'
	},
};

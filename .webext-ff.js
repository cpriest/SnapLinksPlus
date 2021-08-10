module.exports = {
	sourceDir: './build/ff/',
	run:       {
		firefoxProfile:         `${__dirname}/local/SnapLinksDev`,
		profileCreateIfMissing: true,
		keepProfileChanges:     true,
		reload:                 true,
		startUrl:               [`file://${__dirname}/test/test_links.html`],
		firefox:                'firefoxdeveloperedition'
	},
};

module.exports = {
	'env':           {
		'browser':       true,
		'webextensions': true,
		'es6':           true
	},
	'parserOptions': {
		'ecmaVersion':  2018,
		'sourceType':   'script',
		'ecmaFeatures': {
			'impliedStrict': true
		}
	},
	'extends':       ['jquery', './eslint/index.js'],
};

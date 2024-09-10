module.exports = {
	'env':           {
		'browser':       true,
		'webextensions': true,
		'es6':           true,
	},
	'parserOptions': {
		'ecmaVersion':  2020,
		'sourceType':   'script',
		'ecmaFeatures': {
		},
	},
	'rules': {
		'template-curly-spacing': 0,
	},
	'extends':       ['jquery', './eslint/index.js'],
};

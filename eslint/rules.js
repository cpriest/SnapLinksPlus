module.exports = {
	'rules': {
		'no-tabs':                     'off',
		'space-before-function-paren': [2, { 'anonymous': 'always', 'named': 'never' }],
		'space-in-parens':             'off',
		'quotes':                      'off',
		'curly':                       'off',
		'keyword-spacing':             'off',
		'no-unused-vars':              ['error', { 'vars': 'local', 'args': 'none' }],
		'array-bracket-spacing':       ['error', 'never'],
		'computed-property-spacing':   'off',
		'lines-around-comment':        'off',
		'brace-style':                 'off',
		'max-len':                     ['error', 180, 4, { 'ignoreUrls': true }],
		'eqeqeq':                      'off',
		'key-spacing': ['error', {
			'singleLine': {
				'mode': 'strict',
			},
			'multiLine': {
				'mode': 'minimum',
				'align': 'value'
			}
		}],
		"comma-dangle": ["error", {
			"arrays":    "always-multiline",
			"objects":   "always-multiline",
			"imports":   "always-multiline",
			"exports":   "always-multiline",
			"functions": "only-multiline"
		}],
		'no-nested-ternary':           'off',
		'no-mixed-spaces-and-tabs':    ['error', 'smart-tabs'],
		'operator-linebreak':          ['error', 'after', { 'overrides': { '?': 'before', ':': 'before' } }],
		'no-trailing-spaces':          ['warn', { 'skipBlankLines': true }],
	},
};

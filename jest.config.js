module.exports = {
	roots: ['./tests'],
	transform: {
		'^.+\\.ts$': 'ts-jest',
	},
	testRegex: '\\.test\\.ts$',
	moduleFileExtensions: ['ts', 'js'],
	globals: {
		'ts-jest': {
			diagnostics: false,
			tsconfig: './tests/tsconfig.json'
		}
	},
	collectCoverageFrom: [
		'src/utils/*.ts',
		'src/*.ts'
	]
};

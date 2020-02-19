const { series } = require('gulp');
const rollupTaskFactory = require('@hugsmidjan/gulp-rollup');

// ---------------------------------------------------------------------------

// Returns true for local module ids (treats node_modules/*  as external)
const isNonLocalModule = (id) => !/^(?:\0|\.|\/|tslib)/.test(id);

// ---------------------------------------------------------------------------

const [scriptsBundle, scriptsWatch] = rollupTaskFactory({
	name: 'scripts',
	src: 'src/',
	dist: './',
	format: 'cjs',
	// glob:
	minify: false,
	sourcemaps: false,
	inputOpts: { external: isNonLocalModule },
	outputOpts: { strict: false },
});

// ---------------------------------------------------------------------------

exports.dev = series(scriptsBundle, scriptsWatch);
exports.build = series(scriptsBundle);
exports.default = exports.build;

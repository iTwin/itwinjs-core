# Bentley npm Script Guidelines

This document is intended to provide suggestions for writing your own package's npm scripts for things such as building, running tests, and adding code coverage. The imodeljs-related repositories have moved away from gulp and gulp plugins to favor a more direct approach of running tasks. This allows us to depend directly on various npm packages instead of relying on gulp "middle-man" plugins that may not see the same update frequency as the npm packages themselves. For examples of npm scripts in use, please look at both the imodeljs-core repository (a multi-package setup) and the geometry-core repository (a single package).

npm scripts are used by adding properties to the "scripts" object in a package's package.json file. These properties correspond to names that can be passed to the `npm run` command to execute the properties' values as shell commands. For more information on creating and running scripts with npm, [this article](https://www.keithcirkel.co.uk/how-to-use-npm-as-a-build-tool/) may be helpful to read.

The bentleyjs-tools repository includes a number of preconfigured node.js scripts to ease the development process. This includes scripts for testing, linting, and basic code coverage numbers. More information about these scripts can be found in the root bentleyjs-tools README.

## Building

Suggested Package:

* [TypeScript](https://www.typescriptlang.org/)

With a properly configured tsconfig.json file, running the TypeScript compiler with `tsc` should be enough for backend libraries and simple backend agents/services. For more information about tsconfig properties, see the [TypeScript website](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html).  Frontend services or applications may require the use of Webpack or another more involved build solution.

## Cleaning Directories

Suggested Package:

* [rimraf](https://github.com/isaacs/rimraf)

Use rimraf as a cross-platform way to remove output folders (For example: rimraf ./lib). This package functions in a similar manner to the `rm -rf` command in Unix shells.

## Copying Files

Suggested Package:

* [cpx](https://www.npmjs.com/package/cpx)

cpx is a cross-platform copy utility for copying globs of files from a source to a destination directory. Useful for copying around files such as test files or assets.

## Testing

Suggested Package:

* [mocha](https://mochajs.org/)

Mocha is a flexible javascript test runner that can be used to run TypeScript test code in two ways: by either running the compiled JavaScript output of the TypeScript tests, or by running the TypeScript tests/source code directly using the [ts-node](https://github.com/TypeStrong/ts-node). Running Mocha with ts-node allows us to generate accurate code coverage numbers for the TypeScript source files.

## Code Coverage

Suggested Package:

* [nyc](https://github.com/istanbuljs/nyc) (this is the command line utility for [Istanbul](https://istanbul.js.org/))

Istanbul can be [used together with mocha](http://rundef.com/typescript-code-coverage-istanbul-nyc) (in a ts-node configuration) to provide code coverage numbers and reports based on the package's test suite. This can be accomplished by running a ts-node test command directly with nyc (ex: `nyc run npm test:tsnode`). Several types of reports are available, such as a summary of coverage in the console window or an html output that shows specifically which statements have been covered.

## Linting

Suggested Package:

* [tslint](https://palantir.github.io/tslint/)

TSLint can be run separate from VS Code by using the package's CLI. This can be useful for verifying code before committing or for testing linting rules as part of a continuous integration process.

## Other useful packages

[ts-node](https://github.com/TypeStrong/ts-node) A typescript execution environment for code. Can be used to run Mocha tests and useful for generating code coverage percentages and reports.

[tsconfig-paths](https://www.npmjs.com/package/tsconfig-paths) - This may be necessary in multi-package repositories when dependencies are located using a folder's tsconfig "baseUrl" and "paths" attributes. This package is most often used with Mocha and ts-node to run tests directly from the TypeScript source files.
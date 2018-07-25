# Floss

Unit-testing for those hard to reach places.

[![Build Status](https://travis-ci.org/pixijs/floss.svg?branch=master)](https://travis-ci.org/pixijs/floss) [![npm version](https://badge.fury.io/js/floss.svg)](https://badge.fury.io/js/floss)

Uses Electron to provide a Mocha unit-testing environment which can be run headlessly or to debugged with DevTools. This was largely inspired by the [electron-mocha](https://github.com/jprichardson/electron-mocha) and [mocha-electron](https://github.com/tscanlin/mochatron) projects but didn't quite have the debugging features needed to develop tests.

## Installation

Install globally:

```bash
npm install -g floss electron
```

Install locally within a project:

```bash
npm install floss electron --save-dev
```

## Gulp Usage

```js
const floss = require('floss');
gulp.task('test', function(done) {
    floss('test/index.js', done);
});
```

### Debug Mode

Open tests in an Electron window where test can can be debugged with `debugger` and dev tools.

```js
floss({
    path: 'test/index.js',
    debug: true
}, done);
```

### Mocha Reporter

The `reporter` and `reporterOptions` are pass-through options for Mocha to specify a different reporter when running Floss in non-debug mode.

```js
floss({
    path: 'test/index.js',
    reporter: 'xunit',
    reporterOptions: {
    	filename: 'report.xml'
    }
}, done);
```

### Custom Options

Additional properties can be passed to the test code by adding more values to the run options.

```js
floss({
    path: 'test/index.js',
    customUrl: 'http://localhost:8080' // <- custom
}, done);
```

The test code and use the global `options` property to have access to the run options.

```js
console.log(options.customUrl); // logs: http://localhost:8080
```

## Command Line Usage

### Arguments

* **--path** or **-p** (String) Path to the file to test
* **--debug** or **-d**  (Boolean) Enable to run in headful mode, default `false`.
* **--quiet** or **-q** (Boolean) Prevent console[log/info/error/warn/dir] messages from appearing in `stdout`.
* **--electron** or **-e**  (String) Path to the electron to use.
* **--reporter** or **-r**  (String) Mocha reporter type, default `spec`.
* **--reporterOptions** or **-o**  (String) Mocha reporter options.
* **--coveragePattern** or **-c**  (String) Glob pattern of file source to messure for coverage.
* **--coverageHtmlReporter** or **-h**  (Boolean) Generatel HTML report for coverage, default `false`.
* **--coverageSourceMaps** or **-s**  (Boolean) Use sourcemaps to determine coverage, default `false`.

### Usage

Command Line usage when installed globally:

```bash
floss --path test/index.js
```

Or installed locally:

```bash
node node_modules/.bin/floss --path test/index.js
```

Alernatively, within the **package.json**'s' scripts:

```json
{
    "scripts": {
        "test": "floss --path test/index.js"
    }
}
```

### Debug Mode

Open tests in an Electron window where test can can be debugged with `debugger` and dev tools.

```bash
floss --path test/index.js --debug
```

### Istanbul Code Coverage

Floss comes with istanbul integration. This will generate a json report.

```bash
floss --path test/index.js --coveragePattern lib/**/*/*.js
```

To remap the json report using sourcemaps

```bash
floss --path test/index.js --coveragePattern lib/**/*/*.js --coverageSourceMaps
```

To generate an additional html report

```bash
floss --path test/index.js \
    --coveragePattern lib/**/*/*.js \
    --coverageHtmlReporter
```

To generate an additional html report with source maps

```bash
floss --path test/index.js \
    --coveragePattern lib/**/*/*.js \
    --coverageSourceMaps \
    --coverageHtmlReporter
```

For lists of globs put the coverage files in quotes comma or space separated

```bash
floss --path test/index.js \
    --coveragePattern "lib/**/*/*.js, node_modules/thing/lib/thing.js"
```

### Mocha Reporter

Can use the same reporter options as the API mentioned above. The `reporterOptions` are expressed as a querystring, for instance `varname=foo&another=bar`.

```bash
floss --path test/index.js \
    --reporter=xunit \
    --reporterOptions output=report.xml
```

## Custom Electron Version

Some application may require a specific version of Electron. Floss uses Electron 1.0.0+, but you can specific the path to your own version. The custom version can be used either through the commandline argument `--electron`, by setting the Node environmental variable `ELECTRON_PATH` or by setting the run option `electron`.

```js
gulp.task('test', function(done) {
    floss({
        path: 'test/index.js',
        electron: require('electron')
    }, done);
});
```
```bash
floss --path test/index.js \
	--electron /usr/local/bin/electron
```

```bash
ELECTRON_PATH=/usr/local/bin/electron floss --path test/index.js
```

## Travis Integration

Floss can be used with [Travis CI](https://travis-ci.org/) to run Electron headlessly by utilizing Xvfb. Here's a sample of how to setup this project.

### package.json

Note that scripts `test` must be setup in your **package.json**;

```json
{
    "scripts": {
        "test": "gulp test"
    }
}
```

### .travis.yml

```yml
language: node_js
node_js:
    - "4"

install:
    - npm install xvfb-maybe
    - npm install

before_script:
  - export DISPLAY=':99.0'
  - Xvfb :99 -screen 0 1024x768x24 -extension RANDR &

script:
    - xvfb-maybe npm test
```

const glob = require('glob');
const path = require('path');
const fs = require('fs');
const { Reporter, Instrumenter, Collector, hook } = require('istanbul');

/**
 * Create the coverage using istanbul
 * Thanks to https://github.com/tropy/tropy/blob/master/test/support/coverage.js
 * @class Coverage
 */
class Coverage {

    /**
     * @constructor
     * @param {String} root The root directory where to add coverage
     * @param {String} pattern The glob pattern for files to instrument.
     * @param {Boolean} [sourceMaps=false] Use the sourcemaps
     * @param {Boolean} [htmlReporter=false] Use the HTML reporter.
     * @param {Boolean} [debug=false] `true` to run in headful mode.
     */
    constructor(root, pattern, sourceMaps, htmlReporter, debug) {
        this.root = root;
        this.sourceMaps = !!sourceMaps;
        this.pattern = pattern;
        this.htmlReporter = !!htmlReporter;
        this.debug = !!debug;
        this.instrumenter = new Instrumenter();
        this.transformer = this.instrumenter.instrumentSync.bind(this.instrumenter);
        this.cov = global.__coverage__ = {};
        this.matched = this.match();
        hook.hookRequire(this.matched, this.transformer, {});
    }

    /**
     * Start sanitizing the logs of ANSI colors to make more readible
     * @method cleanLogs
     */
    cleanLogs() {
        const stripAnsi = require('strip-ansi');
        console._originalLog = console.log;
        console.log = function () {
            for (let i = 0; i < arguments.length; i++) {
                arguments[i] = stripAnsi(arguments[i]);
            }
            this._originalLog.apply(this, arguments);
        }
    }

    /**
     * Stop stop cleaning logs
     * @method stopCleanLogs
     */
    stopCleanLogs() {
        console.log = console._originalLog;
        delete console._originalLog;
    }

    /**
     * Find the glob matches searching for files to cover
     * @method match
     * @return {Object} The list of matched files.
     */
    match() {
        const map = {};
        const fn = function (file) {
            return map[file];
        };
        if (typeof this.pattern === 'string') {
            fn.files = glob.sync(this.pattern, {
                root: this.root,
                realpath: true
            });
        }
        else if (Array.isArray(this.pattern)) {
            fn.files = [];
            this.pattern.forEach((pattern) => {
                const files = glob.sync(pattern, {
                    root: this.root,
                    realpath: true
                });
                fn.files = fn.files.concat(files);
            });
        }
        for (const file of fn.files) {
            map[file] = true
        }
        return fn;
    }

    /**
     * Generate the report when completed
     * @method report
     * @param {Function} done Callback when completed.
     */
    report(done) {
        if (this.debug) {
            this.cleanLogs();
        }
        for (const file of this.matched.files) {
            if (!this.cov[file]) {
                // Files that are not touched by code ran by the test runner is
                // manually instrumented, to illustrate the missing coverage.
                this.transformer(fs.readFileSync(file, 'utf-8'), file)

                // When instrumenting the code, istanbul will give each
                // FunctionDeclaration a value of 1 in coverState.s,
                // presumably to compensate for function hoisting.
                // We need to reset this, as the function was not hoisted,
                // as it was never loaded.
                for (let key of Object.keys(this.instrumenter.coverState.s)) {
                    this.instrumenter.coverState.s[key] = 0
                }

                this.cov[file] = this.instrumenter.coverState
            }
        }

        const collector = new Collector()
        collector.add(this.cov)

        const reporter = new Reporter();

        //defaults to basic summary and json reports
        reporter.addAll(['text-summary', 'json']);

        //if we're generating html and not going throiugh source maps
        if (this.htmlReporter && !this.sourceMaps) {
            reporter.add('html');
        }

        reporter.write(collector, true, () => {
            if (this.sourceMaps) {
                //use remap-istanbul to generate the sourcemapped version of the reports
                var remapIstanbul = require('remap-istanbul');
                const coverageJson = path.join(this.root, 'coverage/coverage-final.json');
                const remapReporters = { 'json': path.join(this.root, 'coverage', 'coverage-final.json') };
                //add the html reporter if necessary
                if (this.htmlReporter) {
                    remapReporters['html'] = path.join(this.root, 'coverage');
                }
                remapIstanbul(coverageJson, remapReporters).then(() => {
                    if (this.debug) {
                        this.stopCleanLogs();
                    }
                    done();
                });
            }
            else {
                if (this.debug) {
                    this.stopCleanLogs();
                }
                done();
            }
        });
    }
}

module.exports = Coverage;

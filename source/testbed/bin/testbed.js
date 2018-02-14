#! /usr/bin/env node
const program = require("commander");
const floss = require("../floss");

program
  .version("0.1.0")
  .description("imodeljs-core-testbed")
  .option('-d, --debug', 'Launch electron in debug mode')
  .option('--no-dev-tools', 'Do not automatically open Chrome Developer Tools in debug mode')
  .option('-g, --grep <pattern>', 'only run tests matching <pattern>')
  .option('-f, --fgrep <string>', 'only run tests containing <string>')
  .option('-i, --invert', 'inverts --grep and --fgrep matches')
  .option('-t, --timeout <ms>', 'set test-case timeout in milliseconds [2000]')
  .parse(process.argv);

floss(
  {
    path: "lib/testbed/frontend/index.js",
    debug: program.debug,
    timeout: program.timeout || 999999,
    noDevTools: program.noDevTools,
    grep: program.grep,
    fgrep: program.fgrep,
    invert: program.invert,
    checkLeaks: true
  },
  function (returnCode) {
    process.exit(returnCode ? 1 : 0);
  }
);

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

'use strict'

const glob = require("glob")
const { resolve, join } = require("path")
const fs = require("fs")
const { hookRequire } = require("istanbul-lib-hook")
const { createInstrumenter } = require("istanbul-lib-instrument")

function match() {
  const map = {}
  const fn = function (file) { return map[file] }

  const pattern = '../../core/@(frontend|backend)/lib/**/*.js'

  const opts = {
    root: __dirname,
    realpath: true,
    ignore: [
      "../../core/@(frontend|backend)/lib/module/**",
      "../../core/@(frontend|backend)/lib/*test/**"
    ]
  };

  fn.files = glob.sync(pattern, opts);
  for (let file of fn.files) {
    map[file] = transformer(fs.readFileSync(file, 'utf-8'), file)
    cov[file] = instrumenter.lastFileCoverage()
  }

  return fn
}

function report() {
  //Add map files to transform .js into .ts in coverage report
  for (let file in cov)
    if (fs.existsSync(file + '.map'))
      cov[file].inputSourceMap = JSON.parse(fs.readFileSync(file + '.map', 'utf-8'));

  fs.writeFileSync(join(tmpd, `${process.type}.json`), JSON.stringify(cov), 'utf-8')
}

const customOpts = {
  includeAllSources: true
};

const instrumenter = createInstrumenter(customOpts)
const transformer = instrumenter.instrumentSync.bind(instrumenter)
const cov = global.__coverage__ = {}

const tmpd = resolve(__dirname, '.nyc_output')
if (!fs.existsSync(tmpd)) {
  fs.mkdirSync(tmpd)
}

const matched = match()

hookRequire(matched, transformer, {})

if (process.type === 'browser') {
  process.on('exit', report)
} else {
  window.addEventListener('unload', report)
}

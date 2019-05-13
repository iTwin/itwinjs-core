/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
// NB: This file is not a CommonJs module - it needs to run in the browser. Do not import or export modules here!

type CertaConfig = import("../CertaConfig").CertaConfig;
declare var _CERTA_CONFIG: CertaConfig;
declare var _CertaConsole: undefined | ((name: string, args: any[]) => void);

// Redirect all console output back to the main (backend) process, if necessary
if (typeof _CertaConsole !== "undefined") {
  function forwardConsole(name: keyof typeof console) {
    const original = console[name];
    console[name] = (...args: any[]) => {
      _CertaConsole!(name, args);
      // Also preserve the original behavior. This way, test progress is reported in both the backend _and_ frontend processes.
      // This helps keep the output readable when debugging the frontend.
      original.apply(console, args);
    };
  }
  forwardConsole("log");
  forwardConsole("error");
  forwardConsole("dir");
}

((config: CertaConfig) => {
  const mochaOpts = config.mochaOptions;

  // This is essentially equivalent to `mocha.setup("bdd")`, except it works in both node and browser environments.
  mocha.ui("bdd");
  mocha.suite.emit("pre-require", typeof (window) === "undefined" ? global : window, null, mocha);

  mocha.reporter(mochaOpts.reporter, mochaOpts.reporterOptions);
  mocha.useColors(true);
  mocha.timeout(mochaOpts.timeout);
  if (mochaOpts.fgrep)
    mocha.fgrep(mochaOpts.fgrep);
  if (mochaOpts.grep)
    mocha.grep(mochaOpts.grep);
  if (mochaOpts.invert)
    mocha.invert();
  if (mochaOpts.forbidOnly)
    mocha.forbidOnly();

  // Disable timeouts when debugging.
  if (config.debug)
    mocha.enableTimeouts(false);
})(_CERTA_CONFIG);

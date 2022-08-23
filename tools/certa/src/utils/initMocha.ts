/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// NB: This file is not a CommonJs module - it needs to run in the browser. Do not import or export modules here!

type CertaConfig = import("../CertaConfig").CertaConfig;
declare const _CERTA_CONFIG: CertaConfig; // eslint-disable-line @typescript-eslint/naming-convention
declare const _CERTA_MOCHA_HOOKS: any; // eslint-disable-line @typescript-eslint/naming-convention

((config: CertaConfig) => {
  const mochaOpts = config.mochaOptions;

  // This is essentially equivalent to `mocha.setup("bdd")`, except it works in both node and browser environments.
  mocha.ui("bdd");
  mocha.suite.emit("pre-require", typeof (window) === "undefined" ? global : window, null, mocha);

  mocha.reporter(mochaOpts.reporter, mochaOpts.reporterOptions);
  // TODO: Come back and fix useColors to color
  (mocha as any).color(true);
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
    mocha.timeout(0);

  if (_CERTA_MOCHA_HOOKS) {
    const { mochaOptions, mochaGlobalSetup, mochaGlobalTeardown } = _CERTA_MOCHA_HOOKS;
    if (mochaOptions)
      mochaOptions();
    if (mochaGlobalSetup)
      mocha.globalSetup(mochaGlobalSetup);
    if (mochaGlobalTeardown)
      mocha.globalTeardown(mochaGlobalTeardown);
  }

})(_CERTA_CONFIG);

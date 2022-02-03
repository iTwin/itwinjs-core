/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// NB: This file is not a CommonJs module - it needs to run in the browser. Do not import or export modules here!

import type { CertaConfig } from "../CertaConfig";
declare let _CERTA_CONFIG: CertaConfig; // eslint-disable-line @typescript-eslint/naming-convention

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
})(_CERTA_CONFIG);

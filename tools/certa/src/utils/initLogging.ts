/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// NB: This file is not a CommonJs module - it needs to run in the browser. Do not import or export modules here!

declare let _CertaConsole: undefined | ((name: string, args: any[]) => void); // eslint-disable-line @typescript-eslint/naming-convention

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

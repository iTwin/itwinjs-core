/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
// NB: This file is not a CommonJs module - it needs to run in the browser. Do not import or export modules here!

// NB: This requires source-map-support/browser-source-map-support.js to be loaded first!
declare const sourceMapSupport: any;
sourceMapSupport.install();

// The source-map-support package does not correctly format stack traces from the browser.
// It gets pretty close though, so we'll just monkey-patch here to fix them.
const originalPrepareStackTrace = Error.prepareStackTrace;
Error.prepareStackTrace = function (...args) {
  const res = originalPrepareStackTrace!.call(this, ...args);
  return res.replace(/\(.*file:(\/|\\)/g, "(").replace(/at .*file:(\/|\\)/g, "at ");
};

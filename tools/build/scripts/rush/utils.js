/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
function logBuildWarning(msg) {
  if (process.env.TF_BUILD)
    console.log("##vso[task.logissue type=warning;]%s", msg);
  else
    console.error("WARNING: %s", msg);
}

function logBuildError(msg) {
  if (process.env.TF_BUILD)
    console.log("##vso[task.logissue type=error;]%s", msg);
  else
    console.error("ERROR: %s", msg);
}

function failBuild() {
  if (process.env.TF_BUILD) {
    console.log("##vso[task.complete result=Failed;]DONE")
    process.exit(0);
  } else {
    process.exit(1);
  }
}

function throwAfterTimeout(timeout, message) {
  return new Promise((_resolve, reject) => {
    setTimeout(() => reject(message), timeout);
  });
}

module.exports = {
  logBuildWarning,
  logBuildError,
  failBuild,
  throwAfterTimeout
}
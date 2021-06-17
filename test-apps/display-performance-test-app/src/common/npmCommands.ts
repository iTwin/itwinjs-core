/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/naming-convention */

import * as child_process from "child_process";

const execSync = child_process.execSync;
let args = "";
let browser = "";
let isWindows = true;
for (let i = 2; i < process.argv.length; i++) {
  const curArg = process.argv[i];
  if (curArg === "nonwin") {
    isWindows = false;
    break;
  }
  args += `${curArg} `;
  if (curArg === "chrome" || curArg === "edge" || curArg === "firefox" || curArg === "safari")
    browser = curArg;
}
execSync(`npm run start:web ${args}`, { stdio: [0, 1, 2] });

switch (browser) {
  case "chrome":
    if (!isWindows) { // Ie, if running on Mac
      execSync("killall \"Google Chrome\"");
    }
    break;
  case "edge":
    execSync("taskkill /f /im msedge.exe /t >nul");
    break;
  case "safari":
    execSync("killall Safari");
    break;
  case "firefox":
    if (!isWindows) { // Ie, if running on Mac
      execSync("killall firefox");
    } else {
      execSync("taskkill /f /im firefox.exe /t >nul");
    }
    break;
}

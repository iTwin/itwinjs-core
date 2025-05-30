/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as path from "path";
import { Guid, OpenMode } from "@itwin/core-bentley";
import { IModelHost, IModelNative } from "@itwin/core-backend";
import { BriefcaseIdValue } from "@itwin/core-common";

let prefix = "";

function indent() {
  prefix = `${prefix}  `;
}

function outdent() {
  prefix = prefix.substring(2);
}

function log(msg: string) {
  /* eslint-disable-next-line no-console */
  console.log(`${prefix}${msg}`);
}

/**
 * This utility will change an existing iModel file to be a standalone iModel. It does so by
 * clearing the iTwinId, and resetting the briefcaseId to 0.
 *
 * This should only be done for testing, with the iTwin owner's permission.
 *
 * To run:
```
  cd test-apps\display-test-app
  npm run build:backend
  node lib\backend\SetToStandalone.js [iModel-filename]
```
   or, to change all .bim files in a directory and all its subdirectories. recursively:
```
  node lib\backend\SetToStandalone.js [directory-name]
```
*/
function setToStandalone(iModelName: string) {
  log(`Setting ${iModelName} to standalone...`);
  indent();

  try {
    const nativeDb = new IModelNative.platform.DgnDb();
    nativeDb.openIModel(iModelName, OpenMode.ReadWrite);
    nativeDb.enableWalMode();
    nativeDb.setITwinId(Guid.empty); // empty iTwinId means "standalone"
    nativeDb.saveChanges(); // save change to iTwinId
    nativeDb.deleteAllTxns(); // necessary before resetting briefcaseId
    nativeDb.resetBriefcaseId(BriefcaseIdValue.Unassigned); // standalone iModels should always have BriefcaseId unassigned
    nativeDb.saveChanges(); // save change to briefcaseId
    nativeDb.closeFile();
  } catch (err: any) {
    log(err.message);
  }

  outdent();
}

async function processDirectory(dir: string) {
  log(`Converting iModels in directory ${dir}`);
  indent();

  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    let isDirectory;
    try {
      isDirectory = fs.statSync(fullPath).isDirectory();
    } catch (err: any) {
      log(err);
      continue;
    }

    if (isDirectory) {
      await processDirectory(fullPath);
    } else {
      if (file.endsWith(".bim") || file.endsWith(".ibim"))
        setToStandalone(fullPath);
    }
  }

  outdent();
}

async function run() {
  if (process.argv.length !== 3) {
    log("Expected 1 argument - the path to an iModel or directory.");
    return;
  }

  await IModelHost.startup({ profileName: "display-test-app" });

  const rootPath = process.argv[2];
  if (fs.statSync(rootPath).isDirectory())
    await processDirectory(rootPath);
  else
    setToStandalone(rootPath);

  await IModelHost.shutdown();

  log("Finished.");
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
run();

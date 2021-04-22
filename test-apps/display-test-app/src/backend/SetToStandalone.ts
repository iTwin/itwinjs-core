/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DbResult, Guid, OpenMode } from "@bentley/bentleyjs-core";
import { BriefcaseManager, IModelHost } from "@bentley/imodeljs-backend";
import { BriefcaseIdValue, IModelError } from "@bentley/imodeljs-common";
import * as fs from "fs";
import * as path from "path";

let prefix = "";

function indent() {
  prefix = `${prefix}  `;
}

function outdent() {
  prefix = prefix.substr(2);
}

function log(msg: string) {
  /* eslint-disable-next-line no-console */
  console.log(`${prefix}${msg}`);
}

/**
 * This utility will change an existing iModel file to be a standalone iModel. It does so by
 * clearing the ProjectGuid, and resetting the briefcaseId to 0.
 *
 * This should only be done for testing, with the project owner's permission.
 *
 * To run:
```
  cd imodeljs\test-apps\display-test-app
  npm run build:backend
  node lib\backend\SetToStandalone.js [iModel-filename]
```
*/
function setToStandalone(iModelName: string) {
  log(`Setting ${iModelName} to standalone...`);
  indent();

  try {
    const nativeDb = new IModelHost.platform.DgnDb();
    const status = nativeDb.openIModel(iModelName, OpenMode.ReadWrite);
    if (DbResult.BE_SQLITE_OK !== status)
      throw new IModelError(status, `Could not open iModel [${iModelName}]`);

    nativeDb.saveProjectGuid(Guid.empty);

    if (!BriefcaseManager.isStandaloneBriefcaseId(nativeDb.getBriefcaseId())) {
      if (nativeDb.hasPendingTxns()) {
        log("Local Txns found - deleting them");
        nativeDb.deleteAllTxns();
        nativeDb.saveChanges();
      }

      nativeDb.resetBriefcaseId(BriefcaseIdValue.Unassigned);
      nativeDb.saveChanges();
      nativeDb.closeIModel();
    }
  } catch (err) {
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
    } catch (err) {
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

  await IModelHost.startup();

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

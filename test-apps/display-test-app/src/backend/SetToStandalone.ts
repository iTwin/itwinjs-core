/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DbResult, Guid, OpenMode } from "@bentley/bentleyjs-core";
import { IModelHost } from "@bentley/imodeljs-backend";
import { BriefcaseIdValue, IModelError } from "@bentley/imodeljs-common";

/* eslint-disable no-console */

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
async function setToStandalone() {
  if (process.argv.length < 3)
    throw new Error("usage: SetToStandalone.js [iModel-filename]");

  const iModelName = process.argv[2];
  console.log(`setting [${iModelName}] as a standalone iModel`);

  const nativeDb = new IModelHost.platform.DgnDb();
  const status = nativeDb.openIModel(iModelName, OpenMode.ReadWrite);
  if (DbResult.BE_SQLITE_OK !== status)
    throw new IModelError(status, `Could not open iModel [${iModelName}]`);

  nativeDb.saveProjectGuid(Guid.empty);
  if (nativeDb.hasPendingTxns()) {
    console.log("Local Txns found - deleting them");
    nativeDb.deleteAllTxns();
  }

  nativeDb.resetBriefcaseId(BriefcaseIdValue.Standalone);
  nativeDb.saveChanges();
  nativeDb.closeIModel();

  console.log(`[${iModelName}] successfully set as standalone iModel`);
}

async function run() {
  try {
    await IModelHost.startup();
    await setToStandalone();
    await IModelHost.shutdown();
  } catch (err) {
    console.log(err.message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
run();

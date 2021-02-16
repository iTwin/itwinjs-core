/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable no-console */

import { DbResult, Guid, OpenMode } from "@bentley/bentleyjs-core";
import { BriefcaseIdValue, IModelHost } from "@bentley/imodeljs-backend";
import { IModelError } from "@bentley/imodeljs-common";

(async () => { // eslint-disable-line @typescript-eslint/no-floating-promises
  await IModelHost.startup();

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
  await IModelHost.shutdown();
}
)();

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelStatus, OpenMode } from "@bentley/bentleyjs-core";
import { IModelError } from "@bentley/imodeljs-common";
import { BriefcaseConnection, IModelConnection, SnapshotConnection } from "@bentley/imodeljs-frontend";

export async function openIModel(fileName: string, writable: boolean,): Promise<IModelConnection> {
  try {
    return await BriefcaseConnection.openFile({ fileName, readonly: !writable, key: fileName })
  } catch (err) {
    if (writable && err instanceof IModelError && err.errorNumber === IModelStatus.ReadOnly)
      return SnapshotConnection.openFile(fileName);
    else
      throw err;
  }
}

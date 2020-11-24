/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelStatus, OpenMode } from "@bentley/bentleyjs-core";
import { IModelError } from "@bentley/imodeljs-common";
import { IModelConnection, StandaloneConnection } from "@bentley/imodeljs-frontend";

export async function openStandaloneIModel(filename: string, writable: boolean): Promise<IModelConnection> {
  try {
    return StandaloneConnection.openFile(filename, writable ? OpenMode.ReadWrite : OpenMode.Readonly);
  } catch (err) {
    if (writable && err instanceof IModelError && err.errorNumber === IModelStatus.ReadOnly)
      return StandaloneConnection.openFile(filename, OpenMode.Readonly);
    else
      throw err;
  }
}

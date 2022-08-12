/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelError, IModelStatus } from "@itwin/core-common";
import { IModelDb } from "./IModelDb";

/**
 * Helper to get schema json from an iModel.
 * @param iModel An iModel to get schemas from
 * @returns A function that gets a schema from the input iModel by schema name or undefined if the schema is not found.
 * @throws [IModelError]($core-common) if the schema is found but fails to load
 * @alpha
 */
export const getSchemaJsonFromIModel = (iModel: IModelDb) => {
  return (schemaName: string) => {
    const val = iModel.nativeDb.getSchema(schemaName);
    if (undefined !== val.error && val.error.status !== IModelStatus.NotFound) {
      throw new IModelError(val.error.status, `Failed to read schema ${schemaName} from iModel because ${val.error.message}`);
    }
    return val.result;
  };
};

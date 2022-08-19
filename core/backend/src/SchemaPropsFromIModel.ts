/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelDb } from "./IModelDb";

/**
 * Helper that returns a function that gets the schema from an iModel.
 * @param iModel An iModel to get schemas from
 * @returns A function that gets a schema from the input iModel by schema name or undefined if the schema is not found.
 * @throws [Error] if the schema is found but fails to load
 * @alpha
 */
export const makeSchemaPropsGetterFromIModel = (iModel: IModelDb) => {
  return (schemaName: string) => { return iModel.nativeDb.getSchemaProps (schemaName); };
};

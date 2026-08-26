/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECDb
 */

import type { IModelJsNative } from "@bentley/imodeljs-native";

/** Native ECDb CSV methods not yet present in the pinned @bentley/imodeljs-native declarations.
 * @internal
 */
export interface NativeECDbCSVImporter {
  importCSVData(className: string, rows: Uint8Array, mapping: ReadonlyArray<{ columnIndex: number, propertyName: string }>, options?: { nullValue?: string }): number;
  importCSVFile(className: string, csvFilePath: string, mapping: ReadonlyArray<{ columnIndex: number, propertyName: string }>, options?: { hasHeader?: boolean, nullValue?: string }): number;
}

/** @internal */
export function getNativeECDbCSVImporter(nativeDb: IModelJsNative.ECDb): NativeECDbCSVImporter {
  const candidate = nativeDb as Partial<NativeECDbCSVImporter>;
  for (const methodName of ["importCSVData", "importCSVFile"] as const) {
    if ("function" !== typeof candidate[methodName])
      throw new Error(`The loaded @bentley/imodeljs-native does not support ECDb.${methodName}.`);
  }

  return candidate as NativeECDbCSVImporter;
}

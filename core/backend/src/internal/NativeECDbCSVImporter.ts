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

const csvImportMethods = ["importCSVData", "importCSVFile"] as const;

function findMissingCSVImportMethod(nativeDb: IModelJsNative.ECDb): typeof csvImportMethods[number] | undefined {
  const candidate = nativeDb as Partial<NativeECDbCSVImporter>;
  return csvImportMethods.find((methodName) => "function" !== typeof candidate[methodName]);
}

function assertNativeECDbCSVImport(nativeDb: IModelJsNative.ECDb): asserts nativeDb is IModelJsNative.ECDb & NativeECDbCSVImporter {
  const missingMethod = findMissingCSVImportMethod(nativeDb);
  if (undefined !== missingMethod)
    throw new Error(`The loaded @bentley/imodeljs-native does not support ECDb.${missingMethod}.`);
}

/** @internal */
export function supportsNativeECDbCSVImport(nativeDb: IModelJsNative.ECDb): nativeDb is IModelJsNative.ECDb & NativeECDbCSVImporter {
  return undefined === findMissingCSVImportMethod(nativeDb);
}

/** @internal */
export function getNativeECDbCSVImporter(nativeDb: IModelJsNative.ECDb): NativeECDbCSVImporter {
  assertNativeECDbCSVImport(nativeDb);
  return nativeDb;
}

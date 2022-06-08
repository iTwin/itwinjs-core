/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECSchemaOps
 */

import { IModelHost } from "./IModelHost";

/**
 * Generate SHA1 Hash of Schema XML
 * @param schemaXmlPath: Path where schema XML file is located
 * @param referencePaths: Schema reference paths
 * @param isExactMatch: Schema references are located by exact scheme version comparisons
 * @public
 */
export function generateSchemaSha1Hash(schemaXmlPath: string, referencePaths: string[], isExactMatch: boolean = false): string {
  try {
    if (isExactMatch)
      return IModelHost.platform.computeSchemaChecksumWithExactRefMatch(schemaXmlPath, referencePaths);
    else
      return IModelHost.platform.computeSchemaChecksum(schemaXmlPath, referencePaths);
  } catch (err) {
    throw Error(`Error while generating SHA1 Hash:  ${err}`);
  }
}

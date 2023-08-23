/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Enumeration } from "@itwin/ecschema-metadata";
import { EnumerationChanges } from "../Validation/SchemaChanges";

export default async function mergeEnumeration(_target: Enumeration, _source: Enumeration, changes: EnumerationChanges) {
  // TBD
  for(const _enumeratorChange of changes.enumeratorChanges.values()) {

  }
}

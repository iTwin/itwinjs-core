/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Phenomenon } from "@itwin/ecschema-metadata";
import { SchemaItemChanges } from "../Validation/SchemaChanges";
import { MutablePhenomenon } from "../Editing/Mutable/MutablePhenomenon";

/**
 * @internal
 */
export default async function mergePhenomenon(target: Phenomenon, source: Phenomenon, _changes?: SchemaItemChanges) {
  const mutablePhenomenon = target as MutablePhenomenon;

  if(mutablePhenomenon.definition === ""){
    await mutablePhenomenon.setDefinition(source.definition);
  }else{
    throw Error(`Failed to merge schemas, definition attribute conflict: ${source.definition} -> ${target.definition}`);
  }
}

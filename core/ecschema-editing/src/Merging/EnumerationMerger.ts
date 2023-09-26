/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Enumeration, SchemaItemKey} from "@itwin/ecschema-metadata";
import { ChangeType, EnumerationChanges } from "../Validation/SchemaChanges";
import { SchemaItemMerger } from "./SchemaItemMerger";

/**
 * @internal
 */
export default class EnumerationMerger extends SchemaItemMerger<Enumeration> {
  protected override async merge(itemKey: SchemaItemKey, source: Enumeration, changes: EnumerationChanges) {
    for (const enumeratorChange of changes.enumeratorChanges.values()) {
      // Handle each case:
      // If missing, add source enumerator to target
      if (enumeratorChange.enumeratorMissing?.changeType === ChangeType.Missing) {

        const enumerator = source.getEnumeratorByName(enumeratorChange.ecTypeName);
        if (enumerator === undefined) {
          throw Error(`Enumerator '${enumeratorChange.ecTypeName}' not found in class ${source.fullName}`);
        }

        // Enumerators are plain javascript objects with out any references to other
        // instances or a schema. That allows to simply copy them over.
        await this.context.editor.enumerations.addEnumerator(itemKey, enumerator);
      }
    }
  }
}

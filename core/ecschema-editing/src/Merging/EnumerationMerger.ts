/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AnyEnumerator, Enumeration, SchemaItemKey} from "@itwin/ecschema-metadata";
import { ChangeType, EnumerationChanges } from "../Validation/SchemaChanges";
import { SchemaItemMerger } from "./SchemaItemMerger";

type EnumeratorDeltaArgs = [AnyEnumerator, keyof AnyEnumerator, string | undefined];

/**
 * @internal
 */
export default class EnumerationMerger extends SchemaItemMerger<Enumeration> {

  /** Shorthand property to the enumerations editor. */
  private get _editor() {
    return this.context.editor.enumerations;
  }

  protected override async merge(itemKey: SchemaItemKey, source: Enumeration, changes: EnumerationChanges) {
    for (const enumeratorChange of changes.enumeratorChanges.values()) {
      // In case the enumerator entry does not exist in the target enumeration the
      // enumeratorMissing property is set and
      if (enumeratorChange.enumeratorMissing?.changeType === ChangeType.Missing) {

        const enumerator = source.getEnumeratorByName(enumeratorChange.ecTypeName);
        if (enumerator === undefined) {
          throw Error(`Enumerator '${enumeratorChange.ecTypeName}' not found in class ${source.fullName}`);
        }

        // Enumerators are plain javascript objects with out any references to other
        // instances or a schema. That allows to simply copy them over.
        await this._editor.addEnumerator(itemKey, enumerator);

        // Since every missing enumerator has delta changes for ech property, the loop
        // must call continue here to avoid having all properties checked and set again.
        continue;
      }

      // For changes where the enumerators differ, the enumeratorDeltas property is
      // filled. This allows to change individual enumerator entries. This is only
      // allowed for labels and descriptions, all other deltas would throw an error.
      for(const enumeratorDelta of enumeratorChange.enumeratorDeltas) {
        await this.mergeEnumeratorChanges(itemKey, enumeratorDelta.diagnostic.messageArgs! as EnumeratorDeltaArgs);
      }
    }
  }

  private async mergeEnumeratorChanges(itemKey: SchemaItemKey, [enumerator, propertyName, value]: EnumeratorDeltaArgs) {
    // In case an enumerator has the same name but different value, the enumerator
    // cannot be merged to keep integrity for the existing schema users.
    if(propertyName === "value") {
      throw new Error(`Failed to merge enumerator attribute, Enumerator "${enumerator.name}" has different values.`);
    }

    // For the other two properties they shall only be merged if the source value is
    // set. In case they'd be undefined, the current enumerators value shall be kept.
    if(propertyName === "label" && value !== undefined) {
      await this._editor.setEnumeratorLabel(itemKey, enumerator.name, value);
    }
    if(propertyName === "description" && value !== undefined) {
      await this._editor.setEnumeratorDescription(itemKey, enumerator.name, value);
    }
  }
}

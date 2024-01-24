/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Mixin, SchemaItemKey, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaItemEditResults } from "../Editing/Editor";
import { ClassMerger } from "./ClassMerger";

/**
 * @internal
 */
export default class MixinMerger extends ClassMerger<Mixin> {

  protected override async create(schemaKey: SchemaKey, ecClass: Mixin): Promise<SchemaItemEditResults> {
    if (ecClass.appliesTo === undefined) {
      return { errorMessage: `The Mixin ${ecClass.fullName} is missing the required 'appliesTo' attribute.` };
    }

    const appliesTo = new SchemaItemKey(ecClass.appliesTo.name, this.context.sourceSchema.schemaKey.matches(ecClass.appliesTo.schemaKey)
      ? this.context.targetSchema.schemaKey
      : ecClass.appliesTo.schemaKey);
    return this.context.editor.mixins.create(schemaKey, ecClass.name, appliesTo);
  }

  protected override async mergeAttributes(ecClass: Mixin, attributeName: string, attributeNewValue: any, attributeOldValue: any): Promise<SchemaItemEditResults | boolean> {
    const results = await super.mergeAttributes(ecClass, attributeName, attributeNewValue, attributeOldValue);
    if (results === true || this.isSchemaItemEditResults(results) && results.errorMessage !== undefined) {
      return results;
    }

    switch(attributeName) {
      case "appliesTo":
        if (attributeOldValue !== undefined) {
          return { errorMessage: `Changing the mixin '${ecClass.name}' appliesTo is not supported.` };
        }
        return true;
    }
    return false;
  }
}

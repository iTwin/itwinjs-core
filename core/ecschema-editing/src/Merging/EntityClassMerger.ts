/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { EntityClass, Mixin, SchemaItemKey, SchemaKey } from "@itwin/ecschema-metadata";
import { ClassMerger } from "./ClassMerger";
import { SchemaItemEditResults } from "../Editing/Editor";

/**
 * @internal
 */
export default class EntityClassMerger extends ClassMerger<EntityClass> {
  protected override async create(schemaKey: SchemaKey, ecClass: EntityClass): Promise<SchemaItemEditResults> {
    return this.context.editor.entities.create(schemaKey, ecClass.name, ecClass.modifier);
  }

  protected override async addMixin(itemKey: SchemaItemKey, mixin: Mixin): Promise<SchemaItemEditResults> {
    const mixinKey = new SchemaItemKey(mixin.name, mixin.schema.schemaKey.matches(this.context.sourceSchema.schemaKey)
      ? this.context.targetSchema.schemaKey
      : mixin.schema.schemaKey);

    // addMixin should return results instead of throwing exception
    await this.context.editor.entities.addMixin(itemKey, mixinKey);
    return {};
  }
}

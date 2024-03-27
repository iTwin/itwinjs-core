/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { EntityClass, Mixin, SchemaItemKey, SchemaKey } from "@itwin/ecschema-metadata";
import { ClassMerger } from "./ClassMerger";
import { SchemaItemEditResults } from "../Editing/Editor";
import { ChangeType, ClassChanges } from "../Validation/SchemaChanges";

/**
 * @internal
 */
export default class EntityClassMerger extends ClassMerger<EntityClass> {
  protected override async create(schemaKey: SchemaKey, ecClass: EntityClass): Promise<SchemaItemEditResults> {
    return this.context.editor.entities.create(schemaKey, ecClass.name, ecClass.modifier);
  }

  protected override async merge(itemKey: SchemaItemKey, changes: ClassChanges): Promise<SchemaItemEditResults> {
    if (changes.entityMixinChanges.size > 0) {
      if (changes.schemaItemMissing?.changeType !== ChangeType.Missing) {
        return { errorMessage: `Changing the entity class '${itemKey.name}' mixins is not supported.`};
      }

      for (const change of changes.entityMixinChanges.values()) {
        for (const entityMixinChange of change.entityMixinChange) {
          const mixins = entityMixinChange.diagnostic.messageArgs! as unknown as [Mixin];
          for (const mixin of mixins) {
            const mixinKey = new SchemaItemKey(mixin.name, mixin.schema.schemaKey.matches(this.context.sourceSchema.schemaKey)
              ? this.context.targetSchema.schemaKey
              : mixin.schema.schemaKey);
            const result = await this.context.editor.entities.addMixin(itemKey, mixinKey);
            if (result.errorMessage !== undefined) {
              return result;
            }
          }
        }
      }
    }
    return { itemKey };
  }
}

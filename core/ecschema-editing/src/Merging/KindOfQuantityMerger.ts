/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Format, InvertedUnit, KindOfQuantity, OverrideFormat, SchemaItem, SchemaItemKey, Unit } from "@itwin/ecschema-metadata";
import { PropertyValueResolver, SchemaItemMerger } from "./SchemaItemMerger";
import { KindOfQuantityChanges } from "../Validation/SchemaChanges";

/**
 * @internal
 */
export default class KindOfQuantityMerger extends SchemaItemMerger<KindOfQuantity> {

  protected override async merge(itemKey: SchemaItemKey, source: KindOfQuantity, changes: KindOfQuantityChanges) {
    for (const presentationUnitChange of changes.presentationUnitChanges.values()) {
      for (const change of presentationUnitChange.presentationUnitChange) {
        const format = change.diagnostic.messageArgs![0];
        const isDefault = source.defaultPresentationFormat === format;

        if (OverrideFormat.isOverrideFormat(format)) {
          const parentFormat = await this.lookup<Format>(format.parent);
          if (parentFormat === undefined) {
            throw new Error(`Unable to locate the format class ${format.parent.name} in the merged schema.`);
          }

          const unitAndLabels: Array<[Unit | InvertedUnit, string | undefined]> | undefined = [];
          if (format.units !== undefined) {
            for (const [unit, label] of format.units) {
              const targetUnit = await this.lookup<Unit | InvertedUnit>(unit);
              if (targetUnit === undefined) {
                throw new Error(`Unable to locate the unit class ${unit.name} in the merged schema.`);
              }
              unitAndLabels.push([targetUnit, label]);
            }
          }
          const overrideFormat = await this.context.editor.kindOfQuantities.createFormatOverride(itemKey, parentFormat.key, format.precision, unitAndLabels);
          await this.context.editor.kindOfQuantities.addPresentationOverrideFormat(itemKey, overrideFormat, isDefault);
        } else {
          const targetFormat = await this.lookup<Format>(format);
          if (targetFormat === undefined) {
            throw new Error(`Unable to locate the format class ${format.name} in the merged schema.`);
          }
          await this.context.editor.kindOfQuantities.addPresentationFormat(itemKey, targetFormat.key, isDefault);
        }
      }
    }
  }

  /**
   *
   * Creates the property value resolver for [[KindOfQuantity]] items.
   */
  protected override async createPropertyValueResolver(): Promise<PropertyValueResolver<KindOfQuantity>> {
    return {
      persistenceUnit: (newValue, targetItemKey, oldValue) => {
        if (oldValue !== undefined && oldValue !== newValue) {
          throw new Error(`Changing the kind of quantity '${targetItemKey.name}' persistenceUnit is not supported.`);
        }
        const [schemaName, itemName] = SchemaItem.parseFullName(newValue);
        if (this.context.targetSchema.getReferenceSync(schemaName) === undefined) {
          return `${targetItemKey.schemaName}.${itemName}`;
        }
        return newValue;
      },
    };
  }
}

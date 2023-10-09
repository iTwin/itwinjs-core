// /*---------------------------------------------------------------------------------------------
// * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
// * See LICENSE.md in the project root for license terms and full copyright notice.
// *--------------------------------------------------------------------------------------------*/
import { Constant, SchemaItem } from "@itwin/ecschema-metadata";
import { PropertyValueResolver, SchemaItemMerger } from "./SchemaItemMerger";

/**
 * @internal
 */
export default class ConstantsMerger extends SchemaItemMerger<Constant> {
  /**
   * Creates the property value resolver for [[Constant]] items.
   */
  protected override async createPropertyValueResolver(): Promise<PropertyValueResolver<Constant>> {
    return {
      phenomenon: (phenomenonFullName, targetItemKey) => {
        // There are two options, either the phenomenon was referenced from another
        // schema or it is defined in the same schema as the constant to be merged.
        // In the latter case, the changes would report a different property value that
        // refers to the source schema. So that needs to be changed here.
        const [schemaName, phenomenonName] = SchemaItem.parseFullName(phenomenonFullName);
        if(this.context.targetSchema.getReferenceSync(schemaName) === undefined) {
          return `${targetItemKey.schemaName}.${phenomenonName}`;
        }
        return phenomenonFullName;
      },
      numerator: (value, targetItemKey) => {
        const item = this.context.targetSchema.lookupItemSync<Constant>(targetItemKey);
        if(item !== undefined && item.hasNumerator && item.numerator !== value) {
          throw new Error(`Failed to merged, constant numerator conflict: ${value} -> ${item.numerator}`);
        }
        return value;
      },
      denominator: (value, targetItemKey) => {
        const item = this.context.targetSchema.lookupItemSync<Constant>(targetItemKey);
        if(item !== undefined && item.hasDenominator && item.denominator !== value) {
          throw new Error(`Failed to merged, constant denominator conflict: ${value} -> ${item.denominator}`);
        }
        return value;
      },
    };
  }
}


/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { KindOfQuantity, Property, PropertyCategory, PropertyProps, propertyTypeToString, SchemaItemKey } from "@itwin/ecschema-metadata";
import { SchemaMergeContext } from "./SchemaMerger";
import { PropertyEditResults } from "../Editing/Editor";
import { MutableProperty } from "../Editing/Mutable/MutableProperty";

/**
 * @internal
 */
export class AnyPropertyMerger<TProperty extends Property> {
  protected readonly context: SchemaMergeContext;

  constructor(context: SchemaMergeContext) {
    this.context = context;
  }

  public async createFromProps(_classKey: SchemaItemKey, property: TProperty): Promise<PropertyEditResults> {
    return { errorMessage: `Property Type ${propertyTypeToString(property.propertyType)} is not implemented.` };
  }

  protected isPropertyEditResults(obj: any): obj is PropertyEditResults {
    return typeof obj === "object" && "errorMessage" in obj;
  }

  protected async getPropertyProps(property: TProperty): Promise<PropertyEditResults | PropertyProps> {
    let props = {} as  PropertyProps;

    if (property.category !== undefined) {
      const sourceCategory = await property.category;
      const itemKey = new SchemaItemKey(sourceCategory.name, this.context.sourceSchema.schemaKey.matches(sourceCategory.schema.schemaKey)
        ? this.context.targetSchema.schemaKey
        : sourceCategory.schema.schemaKey,
      );
      const targetCategory = await this.context.targetSchema.lookupItem<PropertyCategory>(itemKey);
      if (targetCategory === undefined) {
        return { errorMessage: `Unable to locate the property category class ${sourceCategory.name} in the merged schema.` };
      }
      props = {...props, category: targetCategory.fullName};
    }

    if (property.kindOfQuantity !== undefined) {
      const sourceKoq = await property.kindOfQuantity;
      const itemKey = new SchemaItemKey(sourceKoq.name, this.context.sourceSchema.schemaKey.matches(sourceKoq.schema.schemaKey)
        ? this.context.targetSchema.schemaKey
        : sourceKoq.schema.schemaKey,
      );
      const targetKoq = await this.context.targetSchema.lookupItem<KindOfQuantity>(itemKey);
      if (targetKoq === undefined) {
        return { errorMessage: `Unable to locate the property kind of quantity ${sourceKoq.name} in the merged schema.` };
      }
      props = {...props, kindOfQuantity: targetKoq.fullName};
    }
    return props;
  }

  public async mergeAttributes(property: TProperty, attributeName: string, attributeNewValue: any, _attributeOldValue: any): Promise<PropertyEditResults | boolean> {
    const mutableProperty = property as unknown as MutableProperty;
    switch(attributeName) {
      case "description":
        mutableProperty.setDescription(attributeNewValue);
        return true;
      case "label":
        mutableProperty.setLabel(attributeNewValue);
        return true;
      case "isReadOnly":
        mutableProperty.setIsReadOnly(attributeNewValue);
        return true;
      case "priority":
        mutableProperty.setPriority(attributeNewValue);
        return true;
      case "type":
      case "primitiveType":
        return { errorMessage: `Changing the property '${property.name}' ${attributeName} is not supported.` };
    }
    return false;
  }
}

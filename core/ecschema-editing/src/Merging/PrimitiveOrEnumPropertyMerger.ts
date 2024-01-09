/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Enumeration, EnumerationProperty, EnumerationPropertyProps, PrimitiveOrEnumPropertyBase, PrimitiveProperty, PrimitivePropertyProps, SchemaItemKey } from "@itwin/ecschema-metadata";
import { AnyPropertyMerger } from "./AnyPropertyMerger";
import { PropertyEditResults } from "../Editing/Editor";
import { MutablePrimitiveOrEnumPropertyBase } from "../Editing/Mutable/MutablePrimitiveOrEnumProperty";

/**
 * @internal
 */
abstract class PrimitiveOrEnumPropertyMerger<TPrimitiveOrEnumPropertyBase extends PrimitiveOrEnumPropertyBase> extends AnyPropertyMerger<TPrimitiveOrEnumPropertyBase> {
  public override async mergeAttributes(property: TPrimitiveOrEnumPropertyBase, attributeName: string, attributeNewValue: any, attributeOldValue: any): Promise<PropertyEditResults | boolean> {
    const results = await super.mergeAttributes(property, attributeName, attributeNewValue, attributeOldValue);
    if (results === true || this.isPropertyEditResults(results) && results.errorMessage !== undefined) {
      return results;
    }

    const mutableProperty = property as unknown as MutablePrimitiveOrEnumPropertyBase;
    switch (attributeName) {
      case "extendedTypeName": {
        mutableProperty.setExtendedTypeName(attributeNewValue);
        return true;
      }
      case "minLength": {
        mutableProperty.setMinLength(attributeNewValue);
        return true;
      }
      case "maxLength": {
        mutableProperty.setMaxLength(attributeNewValue);
        return true;
      }
      case "minValue": {
        mutableProperty.setMinValue(attributeNewValue);
        return true;
      }
      case "maxValue": {
        mutableProperty.setMaxValue(attributeNewValue);
        return true;
      }
    }
    return false;
  }
}

/**
 * @internal
 */
export class PrimitivePropertyMerger extends PrimitiveOrEnumPropertyMerger<PrimitiveProperty> {
  public override async createFromProps(classKey: SchemaItemKey, property: PrimitiveProperty): Promise<PropertyEditResults> {
    const results = await super.getPropertyProps(property);
    if (this.isPropertyEditResults(results) && results.errorMessage !== undefined) {
      return results;
    }

    const props: PrimitivePropertyProps = {
      ...property.toJSON(),
      ...results,
    };
    return this.context.editor.entities.createPrimitivePropertyFromProps(classKey, property.name, property.primitiveType, props);
  }
}

/**
 * @internal
 */
export class EnumerationPropertyMerger extends PrimitiveOrEnumPropertyMerger<EnumerationProperty> {
  public override async mergeAttributes(property: EnumerationProperty, attributeName: string, attributeNewValue: any, attributeOldValue: any): Promise<PropertyEditResults | boolean> {
    const results = await super.mergeAttributes(property, attributeName, attributeNewValue, attributeOldValue);
    if (results === true || this.isPropertyEditResults(results) && results.errorMessage !== undefined) {
      return results;
    }

    switch (attributeName) {
      case "enumeration": {
        if (attributeOldValue !== undefined) {
          return { errorMessage: `Changing the property '${property.name}' enumeration is not supported.` };
        }
        return true;
      }
    }
    return false;
  }

  public override async createFromProps(classKey: SchemaItemKey, property: EnumerationProperty): Promise<PropertyEditResults> {
    const results = await super.getPropertyProps(property);
    if (this.isPropertyEditResults(results) && results.errorMessage !== undefined) {
      return results;
    }

    if (property.enumeration === undefined) {
      return { errorMessage: `Property ${property.fullName} is missing the required 'enumeration' attribute.` };
    }

    const enumeration = await property.enumeration;
    const itemKey = new SchemaItemKey(enumeration.name, this.context.sourceSchema.schemaKey.matches(enumeration.schema.schemaKey)
      ? this.context.targetSchema.schemaKey
      : enumeration.schema.schemaKey,
    );
    const type = await this.context.targetSchema.lookupItem<Enumeration>(itemKey);
    if (type === undefined) {
      return { errorMessage: `Unable to locate the enumeration class ${enumeration.name} in the merged schema.` };
    }

    const props: EnumerationPropertyProps = {
      ...property.toJSON(),
      ...results,
      typeName: type.fullName,
    };
    return this.context.editor.entities.createEnumerationPropertyFromProps(classKey, property.name, type, props);
  }
}

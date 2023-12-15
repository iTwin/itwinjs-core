/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ArrayProperty, Enumeration, EnumerationArrayProperty, PrimitiveArrayProperty, SchemaItemKey, StructArrayProperty, StructArrayPropertyProps, StructClass } from "@itwin/ecschema-metadata";
import { PrimitiveArrayPropertyProps } from "@itwin/ecschema-metadata/src/Deserialization/JsonProps";
import { AnyPropertyMerger } from "./AnyPropertyMerger";
import { PropertyEditResults } from "../Editing/Editor";
import { MutableArrayProperty } from "../Editing/Mutable/MutableArrayProperty";

/**
 * @internal
 */
class ArrayPropertyMerger<TArrayProperty extends ArrayProperty>  extends AnyPropertyMerger <TArrayProperty> {
  public override async mergeAttributes(property: TArrayProperty, attributeName: string, attributeNewValue: any, attributeOldValue: any): Promise<PropertyEditResults | boolean> {
    const results = await super.mergeAttributes(property, attributeName, attributeNewValue, attributeOldValue);
    if (results === true || this.isPropertyEditResults(results) && results.errorMessage !== undefined) {
      return results;
    }

    const mutableProperty = property as unknown as MutableArrayProperty;
    switch (attributeName) {
      case "minOccurs":
        mutableProperty.setMinOccurs(attributeNewValue);
        return true;

      case "maxOccurs":
        mutableProperty.setMaxOccurs(attributeNewValue);
        return true;

    }
    return false;
  }
}

/**
 * @internal
 */
export class StructArrayPropertyMerger extends ArrayPropertyMerger <StructArrayProperty> {
  public override async mergeAttributes(property: StructArrayProperty, attributeName: string, attributeNewValue: any, attributeOldValue: any): Promise<PropertyEditResults | boolean> {
    const results = await super.mergeAttributes(property, attributeName, attributeNewValue, attributeOldValue);
    if (results === true || this.isPropertyEditResults(results) && results.errorMessage !== undefined) {
      return results;
    }

    switch (attributeName) {
      case "structClass": {
        if (attributeOldValue !== undefined) {
          return { errorMessage: `Changing the property '${property.name}' structClass is not supported.` };
        }
        return true;
      }
    }
    return false;
  }

  public override async createFromProps(classKey: SchemaItemKey, property: StructArrayProperty): Promise<PropertyEditResults> {
    const results = await super.getPropertyProps(property);
    if (this.isPropertyEditResults(results) && results.errorMessage !== undefined) {
      return results;
    }

    const itemKey = new SchemaItemKey(property.structClass.name, this.context.sourceSchema.schemaKey.matches(property.structClass.schema.schemaKey)
      ? this.context.targetSchema.schemaKey
      : property.structClass.schema.schemaKey,
    );
    const type = await this.context.targetSchema.lookupItem<StructClass>(itemKey);
    if (type === undefined) {
      return { errorMessage: `Unable to locate the struct class ${property.structClass.name} in the merged schema.` };
    }

    const props: StructArrayPropertyProps = {
      ...property.toJSON(),
      ...results,
      typeName: type.fullName,
    };
    return this.context.editor.entities.createStructArrayPropertyFromProps(classKey, property.name, type, props);
  }
}

/**
 * @internal
 */
export class EnumerationArrayPropertyMerger extends ArrayPropertyMerger <EnumerationArrayProperty> {
  public override async mergeAttributes(property: EnumerationArrayProperty, attributeName: string, attributeNewValue: any, attributeOldValue: any): Promise<PropertyEditResults | boolean> {
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

  public override async createFromProps(classKey: SchemaItemKey, property: EnumerationArrayProperty): Promise<PropertyEditResults> {
    const results = await super.getPropertyProps(property);
    if (this.isPropertyEditResults(results) && results.errorMessage !== undefined) {
      return results;
    }

    if (property.enumeration === undefined) {
      return { errorMessage: `Property '${property.fullName}' is missing the required 'enumeration' attribute.` };
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

    const props: PrimitiveArrayPropertyProps = {
      ...property.toJSON(),
      ...results,
    };
    return this.context.editor.entities.createEnumerationArrayPropertyFromProps(classKey, property.name, type, props);
  }
}

/**
 * @internal
 */
export class PrimitiveArraPropertyMerger extends ArrayPropertyMerger <PrimitiveArrayProperty> {
  public override async mergeAttributes(property: PrimitiveArrayProperty, attributeName: string, attributeNewValue: any, attributeOldValue: any): Promise<PropertyEditResults | boolean> {
    const results = await super.mergeAttributes(property, attributeName, attributeNewValue, attributeOldValue);
    if (results === true || this.isPropertyEditResults(results) && results.errorMessage !== undefined) {
      return results;
    }

    switch (attributeName) {
      case "primitiveType": {
        return { errorMessage: `Changing the property '${property.name}' typeName is not supported.`};
      }
    }
    return false;
  }

  public override async createFromProps(classKey: SchemaItemKey, property: PrimitiveArrayProperty): Promise<PropertyEditResults> {
    const results = await super.getPropertyProps(property);
    if (this.isPropertyEditResults(results) && results.errorMessage !== undefined) {
      return results;
    }

    const props: PrimitiveArrayPropertyProps = {
      ...property.toJSON(),
      ...results,
    };
    return this.context.editor.entities.createPrimitiveArrayPropertyFromProps(classKey, property.name, property.primitiveType, props);
  }
}

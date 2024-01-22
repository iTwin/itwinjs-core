/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SchemaItemKey, StructClass, StructProperty, StructPropertyProps } from "@itwin/ecschema-metadata";
import { AnyPropertyMerger } from "./AnyPropertyMerger";
import { PropertyEditResults } from "../Editing/Editor";

/**
 * @internal
 */
export class StructPropertyMerger extends AnyPropertyMerger<StructProperty> {
  public override async mergeAttributes(property: StructProperty, attributeName: string, attributeNewValue: any, attributeOldValue: any): Promise<PropertyEditResults | boolean> {
    const results = await super.mergeAttributes(property, attributeName, attributeNewValue, attributeOldValue);
    if (results === true || this.isPropertyEditResults(results) && results.errorMessage !== undefined) {
      return results;
    }

    switch (attributeName) {
      case "structClass": {
        return { errorMessage: `Changing the property '${property.name}' structClass is not supported.` };
      }
    }
    return false;
  }

  public override async createFromProps(classKey: SchemaItemKey, property: StructProperty): Promise<PropertyEditResults> {
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

    const props: StructPropertyProps = {
      ...property.toJSON(),
      ...results,
      typeName: type.fullName,
    };
    return this.context.editor.entities.createStructPropertyFromProps(classKey, property.name, type, props);
  }
}

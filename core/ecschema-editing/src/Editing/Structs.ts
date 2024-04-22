/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { DelayedPromiseWithProps, ECClass, SchemaItemKey, SchemaItemType, SchemaKey, StructClass, StructClassProps } from "@itwin/ecschema-metadata";
import { SchemaContextEditor, SchemaItemEditResults } from "./Editor";
import { ECClasses } from "./ECClasses";
import { MutableClass, MutableStructClass } from "./Mutable/MutableClass";

/**
 * @alpha A class extending ECClasses allowing you to create schema items of type StructClass.
 */
export class Structs extends ECClasses {
  public constructor(_schemaEditor: SchemaContextEditor) {
    super(_schemaEditor);
  }

  public async create(schemaKey: SchemaKey, name: string, displayLabel?: string, baseClass?: SchemaItemKey): Promise<SchemaItemEditResults> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      return { errorMessage: `Schema Key ${schemaKey.toString(true)} not found in context` };

    const newClass = (await schema.createStructClass(name)) as MutableStructClass;
    if (newClass === undefined)
      return { errorMessage: `Failed to create class ${name} in schema ${schemaKey.toString(true)}.` };

    if (baseClass !== undefined) {
      const baseClassItem = await schema.lookupItem<StructClass>(baseClass);
      if (baseClassItem === undefined)
        return { errorMessage: `Unable to locate base class ${baseClass.fullName} in schema ${schema.fullName}.` };

      if (baseClassItem.schemaItemType !== SchemaItemType.StructClass)
        return { errorMessage: `${baseClassItem.fullName} is not of type Struct Class.` };

      newClass.baseClass = new DelayedPromiseWithProps<SchemaItemKey, ECClass>(baseClass, async () => baseClassItem);
    }

    if (displayLabel)
      newClass.setDisplayLabel(displayLabel);

    return { itemKey: newClass.key };
  }

  /**
   *  Creates a StructClass through a StructClassProps.
   * @param schemaKey a SchemaKey of the Schema that will house the new object.
   * @param structProps a json object that will be used to populate the new StructClass. Needs a name value passed in.
   */
  public async createFromProps(schemaKey: SchemaKey, structProps: StructClassProps): Promise<SchemaItemEditResults> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      return { errorMessage: `Schema Key ${schemaKey.toString(true)} not found in context` };

    if (structProps.name === undefined)
      return { errorMessage: `No name was supplied within props.` };

    const newClass = (await schema.createStructClass(structProps.name)) as MutableClass;
    if (newClass === undefined)
      return { errorMessage: `Failed to create class ${structProps.name} in schema ${schemaKey.toString(true)}.` };

    await newClass.fromJSON(structProps);
    return { itemKey: newClass.key };
  }

  /**
   * Sets the base class of a Struct.
   * @param structKey The SchemaItemKey of the Struct.
   * @param baseClassKey The SchemaItemKey of the base class. Specifying 'undefined' removes the base class.
   */
  public async setBaseClass(structKey: SchemaItemKey, baseClassKey?: SchemaItemKey): Promise<SchemaItemEditResults> {
    const structClass = await this._schemaEditor.schemaContext.getSchemaItem<MutableStructClass>(structKey);
    if (structClass === undefined)
      return { itemKey: structKey, errorMessage: `Struct Class ${structKey.fullName} not found in schema context.` };

    if (baseClassKey === undefined) {
      structClass.baseClass = undefined;
      return { itemKey: structKey };
    }

    const baseClassSchema = baseClassKey.schemaKey.matches(structKey.schemaKey)
      ? structClass.schema
      : await this._schemaEditor.getSchema(baseClassKey.schemaKey);

    if (baseClassSchema === undefined) {
      return { itemKey: structKey, errorMessage: `Schema Key ${baseClassKey.schemaKey.toString(true)} not found in context` };
    }

    const baseClass = await baseClassSchema.lookupItem<StructClass>(baseClassKey);
    if (baseClass === undefined)
      return { itemKey: structKey, errorMessage: `Unable to locate base class ${baseClassKey.fullName} in schema ${baseClassSchema.fullName}.` };

    if (baseClass.schemaItemType !== SchemaItemType.StructClass)
      return { itemKey: structKey, errorMessage: `${baseClass.fullName} is not of type Struct Class.` };

    if (structClass.baseClass !== undefined && !await baseClass.is(await structClass.baseClass))
      return { itemKey: structKey, errorMessage: `Baseclass ${baseClass.fullName} must derive from ${structClass.baseClass.fullName}.`};

    structClass.baseClass = new DelayedPromiseWithProps<SchemaItemKey, StructClass>(baseClassKey, async () => baseClass);
    return { itemKey: structKey };
  }
}

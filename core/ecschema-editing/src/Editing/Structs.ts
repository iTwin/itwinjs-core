/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { DelayedPromiseWithProps, ECClass, ECObjectsError, ECObjectsStatus, SchemaItemKey, SchemaItemType, SchemaKey, StructClass, StructClassProps } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "./Editor";
import { ECClasses } from "./ECClasses";
import { MutableStructClass } from "./Mutable/MutableClass";
import { ECEditingError, ECEditingStatus } from "./Exception";

/**
 * @alpha A class extending ECClasses allowing you to create schema items of type StructClass.
 */
export class Structs extends ECClasses {
  public constructor(schemaEditor: SchemaContextEditor) {
    super(SchemaItemType.StructClass, schemaEditor);
  }

  public async create(schemaKey: SchemaKey, name: string, displayLabel?: string, baseClass?: SchemaItemKey): Promise<SchemaItemKey> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${schemaKey.toString(true)} not found in context`);

    let newClass: MutableStructClass;
    try {
      newClass = (await schema.createStructClass(name)) as MutableStructClass;
    } catch (e) {
      if (e instanceof ECObjectsError && e.errorNumber === ECObjectsStatus.DuplicateItem) {
        throw new ECEditingError(ECEditingStatus.SchemaItemNameAlreadyExists, `Class ${name} already exists in the schema ${schema.fullName}.`);
      } else {
        throw new ECEditingError(ECEditingStatus.Unknown, `Failed to create class ${name} in schema ${schema.fullName}.`);
      }
    }

    if (baseClass !== undefined) {
      const baseClassItem = await schema.lookupItem<StructClass>(baseClass);
      if (baseClassItem === undefined)
        throw new ECEditingError(ECEditingStatus.SchemaItemNotFound, `Unable to locate base class ${baseClass.fullName} in schema ${schema.fullName}.`);

      if (baseClassItem.schemaItemType !== SchemaItemType.StructClass)
        throw new ECEditingError(ECEditingStatus.InvalidSchemaItemType, `${baseClassItem.fullName} is not of type Struct Class.`);

      newClass.baseClass = new DelayedPromiseWithProps<SchemaItemKey, ECClass>(baseClass, async () => baseClassItem);
    }

    if (displayLabel)
      newClass.setDisplayLabel(displayLabel);

    return newClass.key;
  }

  /**
   *  Creates a StructClass through a StructClassProps.
   * @param schemaKey a SchemaKey of the Schema that will house the new object.
   * @param structProps a json object that will be used to populate the new StructClass. Needs a name value passed in.
   */
  public async createFromProps(schemaKey: SchemaKey, structProps: StructClassProps): Promise<SchemaItemKey> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${schemaKey.toString(true)} not found in context`);

    if (structProps.name === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNameNotSpecified, `No name was supplied within props.`);

    let newClass: MutableStructClass;
    try {
      newClass = (await schema.createStructClass(structProps.name)) as MutableStructClass;
    } catch (e) {
      if (e instanceof ECObjectsError && e.errorNumber === ECObjectsStatus.DuplicateItem) {
        throw new ECEditingError(ECEditingStatus.SchemaItemNameAlreadyExists, `Class ${structProps.name} already exists in the schema ${schema.fullName}.`);
      } else {
        throw new ECEditingError(ECEditingStatus.Unknown, `Failed to create class ${structProps.name} in schema ${schema.fullName}.`);
      }
    }

    await newClass.fromJSON(structProps);
    return newClass.key;
  }
}

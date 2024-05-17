/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import {
  CustomAttributeClassProps, CustomAttributeContainerType, DelayedPromiseWithProps, ECClass,
  ECObjectsError,
  ECObjectsStatus,
  SchemaItemKey, SchemaItemType, SchemaKey,
} from "@itwin/ecschema-metadata";
import { SchemaContextEditor, SchemaItemEditResults } from "./Editor";
import { ECClasses } from "./ECClasses";
import { MutableCAClass } from "./Mutable/MutableCAClass";
import { ECEditingError, ECEditingStatus } from "./Exception";

/**
 * @alpha
 * A class extending ECClasses allowing you to create schema items of type CustomAttributeClass.
 */
export class CustomAttributes extends ECClasses {
  public constructor(schemaEditor: SchemaContextEditor) {
    super(SchemaItemType.CustomAttributeClass, schemaEditor);
  }

  public async create(schemaKey: SchemaKey, name: string, containerType: CustomAttributeContainerType, displayLabel?: string, baseClass?: SchemaItemKey): Promise<SchemaItemEditResults> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${schemaKey.toString(true)} not found in context.`);

    let newClass: MutableCAClass;
    try {
      newClass = (await schema.createCustomAttributeClass(name)) as MutableCAClass;
    } catch (e) {
      if (e instanceof ECObjectsError && e.errorNumber === ECObjectsStatus.DuplicateItem) {
        throw new ECEditingError(ECEditingStatus.SchemaItemNameAlreadyExists, `Class ${name} already exists in the schema ${schema.fullName}.`);
      } else {
        throw new ECEditingError(ECEditingStatus.Unknown, `Failed to create class ${name} in schema ${schema.fullName}.`);
      }
    }

    if (baseClass !== undefined) {
      const baseClassItem = await schema.lookupItem<ECClass>(baseClass);
      if (baseClassItem === undefined)
        throw new ECEditingError(ECEditingStatus.SchemaItemNotFound, `Unable to locate base class ${baseClass.fullName} in schema ${schema.fullName}.`);

      if (baseClassItem.schemaItemType !== SchemaItemType.CustomAttributeClass)
        throw new ECEditingError(ECEditingStatus.InvalidSchemaItemType, `${baseClassItem.fullName} is not of type CustomAttribute Class.`);

      newClass.baseClass = new DelayedPromiseWithProps<SchemaItemKey, ECClass>(baseClass, async () => baseClassItem);
    }

    if (displayLabel)
      newClass.setDisplayLabel(displayLabel);

    newClass.setContainerType(containerType);

    return { itemKey: newClass.key };
  }

  /**
   * Creates a CustomAttributeClass through a CustomAttributeClassProps.
   * @param schemaKey a SchemaKey of the Schema that will house the new object.
   * @param caProps a json object that will be used to populate the new CustomAttributeClass. Needs a name value passed in.
   */
  public async createFromProps(schemaKey: SchemaKey, caProps: CustomAttributeClassProps): Promise<SchemaItemEditResults> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${schemaKey.toString(true)} not found in context`);

    if (caProps.name === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNameNotSpecified, `No name was supplied within props.`);

    let newClass: MutableCAClass;
    try {
      newClass = (await schema.createCustomAttributeClass(caProps.name)) as MutableCAClass;
    } catch (e) {
      if (e instanceof ECObjectsError && e.errorNumber === ECObjectsStatus.DuplicateItem) {
        throw new ECEditingError(ECEditingStatus.SchemaItemNameAlreadyExists, `Class ${caProps.name} already exists in the schema ${schema.fullName}.`);
      } else {
        throw new ECEditingError(ECEditingStatus.Unknown, `Failed to create class ${caProps.name} in schema ${schema.fullName}.`);
      }
    }

    await newClass.fromJSON(caProps);

    return { itemKey: newClass.key };
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { AnyEnumerator, Enumeration, EnumerationProps, PrimitiveType, primitiveTypeToString, SchemaItemKey, SchemaItemType, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "./Editor";
import { MutableEnumeration } from "./Mutable/MutableEnumeration";
import { ECEditingStatus, enumerationIdentifier, SchemaEditingError, schemaItemIdentifier, schemaItemIdentifierFromName } from "./Exception";
import { SchemaItems } from "./SchemaItems";

type MutableEnumerator = {
  -readonly [P in keyof AnyEnumerator]: AnyEnumerator[P]
};

/**
 * @alpha
 * A class allowing you to create schema items of type Enumeration.
 */
export class Enumerations extends SchemaItems {
  public constructor(schemaEditor: SchemaContextEditor) {
    super(SchemaItemType.Enumeration, schemaEditor);
  }

  public async create(schemaKey: SchemaKey, name: string, type: PrimitiveType.Integer | PrimitiveType.String, displayLabel?: string, isStrict?: boolean, enumerators?: AnyEnumerator[]): Promise<SchemaItemKey> {
    let newEnum: MutableEnumeration;

    try {
      const schema = await this.getSchema(schemaKey);
      const boundCreate = schema.createEnumeration.bind(schema);
      newEnum = (await this.createSchemaItem<Enumeration>(schemaKey, this.schemaItemType, boundCreate, name, type)) as MutableEnumeration;

      if (undefined !== isStrict)
        newEnum.setIsStrict(isStrict);

      if (undefined !== enumerators)
        for (const enumerator of enumerators)
          await this.addEnumerator(newEnum.key, enumerator);

      if (displayLabel)
        newEnum.setDisplayLabel(displayLabel);
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFailed, schemaItemIdentifierFromName(schemaKey, this.schemaItemType, name), e);
    }

    return newEnum.key;
  }

  /**
   * Creates an Enumeration through an EnumeratorProps.
   * @param schemaKey a SchemaKey of the Schema that will house the new object.
   * @param relationshipProps a json object that will be used to populate the new RelationshipClass. Needs a name value passed in.
   */
  public async createFromProps(schemaKey: SchemaKey, enumProps: EnumerationProps): Promise<SchemaItemKey> {
    let newEnum: MutableEnumeration;

    try {
      const schema = await this.getSchema(schemaKey);
      const boundCreate = schema.createEnumeration.bind(schema);
      newEnum = (await this.createSchemaItemFromProps<Enumeration>(schemaKey, this.schemaItemType, boundCreate, enumProps)) as MutableEnumeration;

    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFromPropsFailed, schemaItemIdentifierFromName(schemaKey, this.schemaItemType, enumProps.name!), e);
    }

    return newEnum.key;
  }

  public async addEnumerator(enumerationKey: SchemaItemKey, enumerator: AnyEnumerator): Promise<void> {
    try {
      const enumeration = await this.getSchemaItem<Enumeration>(enumerationKey, SchemaItemType.Enumeration);

      if (enumeration.isInt && typeof (enumerator.value) !== "number")
        throw new SchemaEditingError(ECEditingStatus.InvalidEnumeratorType, enumerationIdentifier(this.schemaItemType, enumerationKey, "integer", enumerator.name));

      if (enumeration.isString && typeof (enumerator.value) !== "string")
        throw new SchemaEditingError(ECEditingStatus.InvalidEnumeratorType, enumerationIdentifier(this.schemaItemType, enumerationKey, "string", enumerator.name));

      (enumeration as MutableEnumeration).addEnumerator(enumerator);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.AddEnumeratorFailed, schemaItemIdentifier(this.schemaItemType, enumerationKey), e);
    }
  }

  public async setEnumeratorLabel(enumerationKey: SchemaItemKey, enumeratorName: string, label: string | undefined): Promise<void> {
    try {
      const enumeration = await this.getSchemaItem<Enumeration>(enumerationKey, SchemaItemType.Enumeration);

      const enumerator = enumeration.getEnumeratorByName(enumeratorName);
      if (enumerator === undefined)
        throw new SchemaEditingError(ECEditingStatus.EnumeratorDoesNotExist, enumerationIdentifier(this.schemaItemType, enumerationKey, primitiveTypeToString(enumeration.type!), enumeratorName));

      (enumerator as MutableEnumerator).label = label;
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.SetEnumeratorLabelFailed, schemaItemIdentifier(this.schemaItemType, enumerationKey), e);
    }
  }

  public async setEnumeratorDescription(enumerationKey: SchemaItemKey, enumeratorName: string, description: string | undefined): Promise<void> {
    try {
      const enumeration = await this.getSchemaItem<Enumeration>(enumerationKey, SchemaItemType.Enumeration);

      const enumerator = enumeration.getEnumeratorByName(enumeratorName);
      if (enumerator === undefined)
        throw new SchemaEditingError(ECEditingStatus.EnumeratorDoesNotExist, enumerationIdentifier(this.schemaItemType, enumerationKey, primitiveTypeToString(enumeration.type!), enumeratorName));

      (enumerator as MutableEnumerator).description = description;
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.SetEnumeratorLabelFailed, schemaItemIdentifier(this.schemaItemType, enumerationKey), e);
    }
  }
}

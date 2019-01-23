/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { ISchemaPartVisitor, AnyECType, AnyClass } from "./Interfaces";
import { SchemaItem } from "./Metadata/SchemaItem";
import { Schema } from "./Metadata/Schema";
import { SchemaItemType } from "./ECObjects";
import { Constant } from "./Metadata/Constant";
import { CustomAttributeClass } from "./Metadata/CustomAttributeClass";
import { ECClass, StructClass } from "./Metadata/Class";
import { EntityClass } from "./Metadata/EntityClass";
import { Enumeration } from "./Metadata/Enumeration";
import { Format } from "./Metadata/Format";
import { Mixin } from "./Metadata/Mixin";
import { Unit } from "./Metadata/Unit";
import { InvertedUnit } from "./Metadata/InvertedUnit";
import { KindOfQuantity } from "./Metadata/KindOfQuantity";
import { Phenomenon } from "./Metadata/Phenomenon";
import { PropertyCategory } from "./Metadata/PropertyCategory";
import { RelationshipClass, RelationshipConstraint } from "./Metadata/RelationshipClass";
import { UnitSystem } from "./Metadata/UnitSystem";
import { CustomAttributeContainerProps } from "./Metadata/CustomAttribute";
import { Property } from "./Metadata/Property";

function isCustomAttributeContainer(object: any): object is CustomAttributeContainerProps {
  return "customAttributes" in object;
}

/**
 * A helper class to call methods on the provided [[ISchemaPartVisitor]].
 */
export class SchemaPartVisitorHelper {
  private _visitor: ISchemaPartVisitor;

  constructor (visitor: ISchemaPartVisitor) {
    this._visitor = visitor;
  }

  /**
   * Calls visitEmptySchema or visitFullSchema on the configured [[ISchemaPartVisitor]].
   * @param schema The schema to pass to the visitor.
   * @param fullSchema Indicates if the schema is partially or fully-loaded.
   */
  public async visitSchema(schema: Schema, fullSchema: boolean = true): Promise<void> {
    if (!fullSchema && this._visitor.visitEmptySchema)
      await this._visitor.visitEmptySchema(schema);

    if (fullSchema && this._visitor.visitFullSchema)
      await this._visitor.visitFullSchema(schema);
  }

  /**
   * Calls the appropriate visit methods on the configured [[ISchemaPartVisitor]]
   * based on the type of the part specified.
   * @param schemaPart The schema part to pass to the visitor methods.
   */
  public async visitSchemaPart(schemaPart: AnyECType): Promise<void> {
    const schemaItem = schemaPart as SchemaItem;
    if (schemaPart instanceof SchemaItem)
      await this.visitSchemaItem(schemaItem);

    if (isCustomAttributeContainer(schemaPart) && this._visitor.visitCustomAttributeContainer) {
      await this._visitor.visitCustomAttributeContainer(schemaPart);
    }

    if (schemaPart instanceof Property && this._visitor.visitProperty) {
      await this._visitor.visitProperty(schemaPart);
      return;
    }

    if (schemaPart instanceof RelationshipConstraint && this._visitor.visitRelationshipConstraint) {
      await this._visitor.visitRelationshipConstraint(schemaPart);
      return;
    }
  }

  private async visitSchemaItem (schemaItem: SchemaItem) {
    if (this._visitor.visitSchemaItem)
      await this._visitor.visitSchemaItem(schemaItem);

    if (schemaItem instanceof ECClass && this._visitor.visitClass)
      await this._visitor.visitClass(schemaItem as AnyClass);

    switch (schemaItem.schemaItemType) {
      case SchemaItemType.Constant:
        if (this._visitor.visitConstant)
          await this._visitor.visitConstant(schemaItem as Constant);
        break;
      case SchemaItemType.CustomAttributeClass:
        if (this._visitor.visitCustomAttributeClass)
          await this._visitor.visitCustomAttributeClass(schemaItem as CustomAttributeClass);
        break;
      case SchemaItemType.EntityClass:
        if (this._visitor.visitEntityClass)
          await this._visitor.visitEntityClass(schemaItem as EntityClass);
        break;
      case SchemaItemType.Enumeration:
        if (this._visitor.visitEnumeration)
          await this._visitor.visitEnumeration(schemaItem as Enumeration);
        break;
      case SchemaItemType.Format:
        if (this._visitor.visitFormat)
          await this._visitor.visitFormat(schemaItem as Format);
        break;
      case SchemaItemType.InvertedUnit:
        if (this._visitor.visitInvertedUnit)
          await this._visitor.visitInvertedUnit(schemaItem as InvertedUnit);
        break;
      case SchemaItemType.KindOfQuantity:
        if (this._visitor.visitKindOfQuantity)
          await this._visitor.visitKindOfQuantity(schemaItem as KindOfQuantity);
        break;
      case SchemaItemType.Mixin:
        if (this._visitor.visitMixin)
          await this._visitor.visitMixin(schemaItem as Mixin);
        break;
      case SchemaItemType.Phenomenon:
        if (this._visitor.visitPhenomenon)
          await this._visitor.visitPhenomenon(schemaItem as Phenomenon);
        break;
      case SchemaItemType.PropertyCategory:
        if (this._visitor.visitPropertyCategory)
          await this._visitor.visitPropertyCategory(schemaItem as PropertyCategory);
        break;
      case SchemaItemType.RelationshipClass:
        if (this._visitor.visitRelationshipClass)
          await this._visitor.visitRelationshipClass(schemaItem as RelationshipClass);
        break;
      case SchemaItemType.StructClass:
        if (this._visitor.visitStructClass)
          await this._visitor.visitStructClass(schemaItem as StructClass);
        break;
      case SchemaItemType.Unit:
        if (this._visitor.visitUnit)
          await this._visitor.visitUnit(schemaItem as Unit);
        break;
      case SchemaItemType.UnitSystem:
        if (this._visitor.visitUnitSystem)
          await this._visitor.visitUnitSystem(schemaItem as UnitSystem);
        break;
    }
  }
}

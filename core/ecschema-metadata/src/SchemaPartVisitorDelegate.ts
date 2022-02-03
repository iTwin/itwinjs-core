/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { SchemaItemType } from "./ECObjects";
import type { AnyClass, AnyECType } from "./Interfaces";
import type { StructClass } from "./Metadata/Class";
import { ECClass } from "./Metadata/Class";
import type { Constant } from "./Metadata/Constant";
import type { CustomAttributeContainerProps } from "./Metadata/CustomAttribute";
import type { CustomAttributeClass } from "./Metadata/CustomAttributeClass";
import type { EntityClass } from "./Metadata/EntityClass";
import type { Enumeration } from "./Metadata/Enumeration";
import type { Format } from "./Metadata/Format";
import type { InvertedUnit } from "./Metadata/InvertedUnit";
import type { KindOfQuantity } from "./Metadata/KindOfQuantity";
import type { Mixin } from "./Metadata/Mixin";
import type { Phenomenon } from "./Metadata/Phenomenon";
import type { AnyProperty} from "./Metadata/Property";
import { Property } from "./Metadata/Property";
import type { PropertyCategory } from "./Metadata/PropertyCategory";
import type { RelationshipClass} from "./Metadata/RelationshipClass";
import { RelationshipConstraint } from "./Metadata/RelationshipClass";
import type { Schema } from "./Metadata/Schema";
import { SchemaItem } from "./Metadata/SchemaItem";
import type { Unit } from "./Metadata/Unit";
import type { UnitSystem } from "./Metadata/UnitSystem";

/**
 * Interface to allow schema traversal/deserialization workflows to visit
 * each part, item, class, etc. that exists in a given schema.
 * @beta
 */
export interface ISchemaPartVisitor {
  /**
   * Called for a partially loaded schema. During deserialization, this would
   * be after a schema and all its references are deserialized, but _before_
   * any of its items or custom attributes have been deserialized.
   * @param schema A partially-loaded Schema.
   */
  /* async */ visitEmptySchema?: (schema: Schema) => Promise<void>;

  /**
   * Called for a partially loaded schema. During deserialization, this would
   * be after a schema and all its references are deserialized, but _before_
   * any of its items or custom attributes have been deserialized.
   * @param schema A partially-loaded Schema.
   */
  visitEmptySchemaSync?: (schema: Schema) => void;

  /**
   * Called for a fully loaded schema.
   * @param schema A fully-loaded Schema.
   */
  /* async */ visitFullSchema?: (schema: Schema) => Promise<void>;

  /**
   * Called for a fully loaded schema.
   * @param schema A fully-loaded Schema.
   */
  visitFullSchemaSync?: (schema: Schema) => void;

  /**
   * Called for each [[SchemaItem]] instance.
   * @param schemaItem a SchemaItem object.
   */
  /* async */ visitSchemaItem?: (schemaItem: SchemaItem) => Promise<void>;

  /**
   * Called for each [[SchemaItem]] instance.
   * @param schemaItem a SchemaItem object.
   */
  visitSchemaItemSync?: (schemaItem: SchemaItem) => void;

  /**
   * Called for each [[AnyClass]] instance.
   * @param ecClass an ECClass object.
   */
  /* async */ visitClass?: (ecClass: AnyClass) => Promise<void>;

  /**
   * Called for each [[AnyClass]] instance.
   * @param ecClass an ECClass object.
   */
  visitClassSync?: (ecClass: AnyClass) => void;

  /**
   * Called for each [[AnyProperty]] instance of an ECClass.
   * @param property an AnyProperty object.
   */
  /* async */ visitProperty?: (property: AnyProperty) => Promise<void>;

  /**
   * Called for each [[AnyProperty]] instance of an ECClass.
   * @param property an AnyProperty object.
   */
  visitPropertySync?: (property: AnyProperty) => void;

  /**
   * Called for each [[EntityClass]] instance.
   * @param entityClass an EntityClass object.
   */
  /* async */ visitEntityClass?: (entityClass: EntityClass) => Promise<void>;

  /**
   * Called for each [[EntityClass]] instance.
   * @param entityClass an EntityClass object.
   */
  visitEntityClassSync?: (entityClass: EntityClass) => void;

  /**
   * Called for each [[StructClass]] instance.
   * @param structClass a StructClass object.
   */
  /* async */ visitStructClass?: (structClass: StructClass) => Promise<void>;

  /**
   * Called for each [[StructClass]] instance.
   * @param structClass a StructClass object.
   */
  visitStructClassSync?: (structClass: StructClass) => void;

  /**
   * Called for each [[Mixin]] instance.
   * @param mixin a Mixin object.
   */
  /* async */ visitMixin?: (mixin: Mixin) => Promise<void>;

  /**
   * Called for each [[Mixin]] instance.
   * @param mixin a Mixin object.
   */
  visitMixinSync?: (mixin: Mixin) => void;

  /**
   * Called for each [[RelationshipClass]] instance.
   * @param relationshipClass a RelationshipClass object.
   */
  /* async */ visitRelationshipClass?: (relationshipClass: RelationshipClass) => Promise<void>;

  /**
   * Called for each [[RelationshipClass]] instance.
   * @param relationshipClass a RelationshipClass object.
   */
  visitRelationshipClassSync?: (relationshipClass: RelationshipClass) => void;

  /**
   * Called for each [[RelationshipConstraint]] of each RelationshipClass.
   * @param relationshipConstraint a RelationshipConstraint object.
   */
  /* async */ visitRelationshipConstraint?: (relationshipConstraint: RelationshipConstraint) => Promise<void>;

  /**
   * Called for each [[RelationshipConstraint]] of each RelationshipClass.
   * @param relationshipConstraint a RelationshipConstraint object.
   */
  visitRelationshipConstraintSync?: (relationshipConstraint: RelationshipConstraint) => void;

  /**
   * Called for each [[CustomAttributeClass]] instance.
   * @param customAttributeClass a CustomAttributeClass object.
   */
  /* async */ visitCustomAttributeClass?: (customAttributeClass: CustomAttributeClass) => Promise<void>;

  /**
   * Called for each [[CustomAttributeClass]] instance.
   * @param customAttributeClass a CustomAttributeClass object.
   */
  visitCustomAttributeClassSync?: (customAttributeClass: CustomAttributeClass) => void;

  /**
   * Called for each CustomAttribute container in the schema.
   * @param customAttributeContainer a CustomAttributeContainerProps object.
   */
  /* async */ visitCustomAttributeContainer?: (customAttributeContainer: CustomAttributeContainerProps) => Promise<void>;

  /**
   * Called for each CustomAttribute container in the schema.
   * @param customAttributeContainer a CustomAttributeContainerProps object.
   */
  visitCustomAttributeContainerSync?: (customAttributeContainer: CustomAttributeContainerProps) => void;

  /**
   * Called for each [[Enumeration]] instance.
   * @param enumeration an Enumeration object.
   */
  /* async */ visitEnumeration?: (enumeration: Enumeration) => Promise<void>;

  /**
   * Called for each [[Enumeration]] instance.
   * @param enumeration an Enumeration object.
   */
  visitEnumerationSync?: (enumeration: Enumeration) => void;

  /**
   * Called for each [[KindOfQuantity]] instance.
   * @param koq a KindOfQuantity object.
   */
  /* async */ visitKindOfQuantity?: (koq: KindOfQuantity) => Promise<void>;

  /**
   * Called for each [[KindOfQuantity]] instance.
   * @param koq a KindOfQuantity object.
   */
  visitKindOfQuantitySync?: (koq: KindOfQuantity) => void;

  /**
   * Called for each [[PropertyCategory]] instance.
   * @param category a PropertyCategory object.
   */
  /* async */ visitPropertyCategory?: (category: PropertyCategory) => Promise<void>;

  /**
   * Called for each [[PropertyCategory]] instance.
   * @param category a PropertyCategory object.
   */
  visitPropertyCategorySync?: (category: PropertyCategory) => void;

  /**
   * Called for each [[Format]] instance.
   * @param format a Format object.
   */
  /* async */ visitFormat?: (format: Format) => Promise<void>;

  /**
   * Called for each [[Format]] instance.
   * @param format a Format object.
   */
  visitFormatSync?: (format: Format) => void;

  /**
   * Called for each [[Unit]] instance.
   * @param unit a Unit object.
   */
  /* async */ visitUnit?: (unit: Unit) => Promise<void>;

  /**
   * Called for each [[Unit]] instance.
   * @param unit a Unit object.
   */
  visitUnitSync?: (unit: Unit) => void;

  /**
   * Called for each [[InvertedUnit]] instance.
   * @param invertedUnit an InvertedUnit object.
   */
  /* async */ visitInvertedUnit?: (invertedUnit: InvertedUnit) => Promise<void>;

  /**
   * Called for each [[InvertedUnit]] instance.
   * @param invertedUnit an InvertedUnit object.
   */
  visitInvertedUnitSync?: (invertedUnit: InvertedUnit) => void;

  /**
   * Called for each [[UnitSystem]] instance.
   * @param unitSystem a UnitSystem object.
   */
  /* async */ visitUnitSystem?: (unitSystem: UnitSystem) => Promise<void>;

  /**
   * Called for each [[UnitSystem]] instance.
   * @param unitSystem a UnitSystem object.
   */
  visitUnitSystemSync?: (unitSystem: UnitSystem) => void;

  /**
   * Called for each [[Phenomenon]] instance.
   * @param phenomena a Phenomenon object.
   */
  /* async */ visitPhenomenon?: (phenomena: Phenomenon) => Promise<void>;

  /**
   * Called for each [[Phenomenon]] instance.
   * @param phenomena a Phenomenon object.
   */
  visitPhenomenonSync?: (phenomena: Phenomenon) => void;

  /**
   * Called for each [[Constant]] instance.
   * @param constant a Constant object.
   */
  /* async */ visitConstant?: (constant: Constant) => Promise<void>;

  /**
   * Called for each [[Constant]] instance.
   * @param constant a Constant object.
   */
  visitConstantSync?: (constant: Constant) => void;
}

function isCustomAttributeContainer(object: any): object is CustomAttributeContainerProps {
  return "customAttributes" in object;
}

/**
 * A helper class to call methods on the provided [[ISchemaPartVisitor]].
 * @beta
 */
export class SchemaPartVisitorDelegate {
  private _visitor: ISchemaPartVisitor;

  constructor(visitor: ISchemaPartVisitor) {
    this._visitor = visitor;
  }

  /**
   * Calls (async) visitEmptySchema or visitFullSchema on the configured [[ISchemaPartVisitor]].
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
   * Calls (synchronously) visitEmptySchema or visitFullSchema on the configured [[ISchemaPartVisitor]].
   * @param schema The schema to pass to the visitor.
   * @param fullSchema Indicates if the schema is partially or fully-loaded.
   */
  public visitSchemaSync(schema: Schema, fullSchema: boolean = true): void {
    if (!fullSchema && this._visitor.visitEmptySchemaSync)
      this._visitor.visitEmptySchemaSync(schema);

    if (fullSchema && this._visitor.visitFullSchemaSync)
      this._visitor.visitFullSchemaSync(schema);
  }

  /**
   * Calls (async) the appropriate visit methods on the configured [[ISchemaPartVisitor]]
   * based on the type of the part specified.
   * @param schemaPart The schema part to pass to the visitor methods.
   */
  public async visitSchemaPart(schemaPart: AnyECType): Promise<void> {
    if (SchemaItem.isSchemaItem(schemaPart)) {
      await this.visitSchemaItem(schemaPart);
    } else if (Property.isProperty(schemaPart) && this._visitor.visitProperty) {
      await this._visitor.visitProperty(schemaPart);
    } else if (RelationshipConstraint.isRelationshipConstraint(schemaPart) && this._visitor.visitRelationshipConstraint) {
      await this._visitor.visitRelationshipConstraint(schemaPart);
    }

    if (isCustomAttributeContainer(schemaPart) && this._visitor.visitCustomAttributeContainer) {
      await this._visitor.visitCustomAttributeContainer(schemaPart);
    }
  }

  /**
   * Calls (synchronously) the appropriate visit methods on the configured [[ISchemaPartVisitor]]
   * based on the type of the part specified.
   * @param schemaPart The schema part to pass to the visitor methods.
   */
  public visitSchemaPartSync(schemaPart: AnyECType): void {
    if (SchemaItem.isSchemaItem(schemaPart)) {
      this.visitSchemaItemSync(schemaPart);
    } else if (Property.isProperty(schemaPart) && this._visitor.visitPropertySync) {
      this._visitor.visitPropertySync(schemaPart);
    } else if (RelationshipConstraint.isRelationshipConstraint(schemaPart) && this._visitor.visitRelationshipConstraintSync) {
      this._visitor.visitRelationshipConstraintSync(schemaPart);
    }

    if (isCustomAttributeContainer(schemaPart) && this._visitor.visitCustomAttributeContainerSync)
      this._visitor.visitCustomAttributeContainerSync(schemaPart);
  }

  private async visitSchemaItem(schemaItem: SchemaItem) {
    if (this._visitor.visitSchemaItem)
      await this._visitor.visitSchemaItem(schemaItem);

    if (ECClass.isECClass(schemaItem) && this._visitor.visitClass)
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

  private visitSchemaItemSync(schemaItem: SchemaItem) {
    if (this._visitor.visitSchemaItemSync)
      this._visitor.visitSchemaItemSync(schemaItem);

    if (ECClass.isECClass(schemaItem) && this._visitor.visitClassSync)
      this._visitor.visitClassSync(schemaItem as AnyClass);

    switch (schemaItem.schemaItemType) {
      case SchemaItemType.Constant:
        if (this._visitor.visitConstantSync)
          this._visitor.visitConstantSync(schemaItem as Constant);
        break;
      case SchemaItemType.CustomAttributeClass:
        if (this._visitor.visitCustomAttributeClassSync)
          this._visitor.visitCustomAttributeClassSync(schemaItem as CustomAttributeClass);
        break;
      case SchemaItemType.EntityClass:
        if (this._visitor.visitEntityClassSync)
          this._visitor.visitEntityClassSync(schemaItem as EntityClass);
        break;
      case SchemaItemType.Enumeration:
        if (this._visitor.visitEnumerationSync)
          this._visitor.visitEnumerationSync(schemaItem as Enumeration);
        break;
      case SchemaItemType.Format:
        if (this._visitor.visitFormatSync)
          this._visitor.visitFormatSync(schemaItem as Format);
        break;
      case SchemaItemType.InvertedUnit:
        if (this._visitor.visitInvertedUnitSync)
          this._visitor.visitInvertedUnitSync(schemaItem as InvertedUnit);
        break;
      case SchemaItemType.KindOfQuantity:
        if (this._visitor.visitKindOfQuantitySync)
          this._visitor.visitKindOfQuantitySync(schemaItem as KindOfQuantity);
        break;
      case SchemaItemType.Mixin:
        if (this._visitor.visitMixinSync)
          this._visitor.visitMixinSync(schemaItem as Mixin);
        break;
      case SchemaItemType.Phenomenon:
        if (this._visitor.visitPhenomenonSync)
          this._visitor.visitPhenomenonSync(schemaItem as Phenomenon);
        break;
      case SchemaItemType.PropertyCategory:
        if (this._visitor.visitPropertyCategorySync)
          this._visitor.visitPropertyCategorySync(schemaItem as PropertyCategory);
        break;
      case SchemaItemType.RelationshipClass:
        if (this._visitor.visitRelationshipClassSync)
          this._visitor.visitRelationshipClassSync(schemaItem as RelationshipClass);
        break;
      case SchemaItemType.StructClass:
        if (this._visitor.visitStructClassSync)
          this._visitor.visitStructClassSync(schemaItem as StructClass);
        break;
      case SchemaItemType.Unit:
        if (this._visitor.visitUnitSync)
          this._visitor.visitUnitSync(schemaItem as Unit);
        break;
      case SchemaItemType.UnitSystem:
        if (this._visitor.visitUnitSystemSync)
          this._visitor.visitUnitSystemSync(schemaItem as UnitSystem);
        break;
    }
  }
}

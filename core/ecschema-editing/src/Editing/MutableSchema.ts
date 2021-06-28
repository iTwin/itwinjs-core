/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Constant, CustomAttribute, CustomAttributeClass, ECClassModifier, EntityClass, Enumeration,
  Format, InvertedUnit, KindOfQuantity, Mixin, Phenomenon, PrimitiveType, PropertyCategory,
  RelationshipClass, Schema, SchemaContext, SchemaItem, StructClass, Unit, UnitSystem,
} from "@bentley/ecschema-metadata";

/**
 * Hackish approach that works like a "friend class" so we can access protected members without making them public.
 * We cannot put this into Helper.ts and make it non-export, because we are importing Helper.ts from this file, and the circular import
 * would prevent this class from extending Schema.
 * @internal
 */
export abstract class MutableSchema extends Schema {
  public abstract addCustomAttribute(customAttribute: CustomAttribute): void;
  public abstract createEntityClass(name: string, modifier?: ECClassModifier): Promise<EntityClass>;
  public abstract createEntityClassSync(name: string, modifier?: ECClassModifier): EntityClass;
  public abstract createMixinClass(name: string): Promise<Mixin>;
  public abstract createMixinClassSync(name: string): Mixin;
  public abstract createStructClass(name: string, modifier?: ECClassModifier): Promise<StructClass>;
  public abstract createStructClassSync(name: string, modifier?: ECClassModifier): StructClass;
  public abstract createCustomAttributeClass(name: string, modifier?: ECClassModifier): Promise<CustomAttributeClass>;
  public abstract createCustomAttributeClassSync(name: string, modifier?: ECClassModifier): CustomAttributeClass;
  public abstract createRelationshipClass(name: string, modifier?: ECClassModifier): Promise<RelationshipClass>;
  public abstract createRelationshipClassSync(name: string, modifier?: ECClassModifier): RelationshipClass;
  public abstract createEnumeration(name: string, primitiveType?: PrimitiveType.Integer | PrimitiveType.String): Promise<Enumeration>;
  public abstract createEnumerationSync(name: string, primitiveType?: PrimitiveType.Integer | PrimitiveType.String): Enumeration;
  public abstract createKindOfQuantity(name: string): Promise<KindOfQuantity>;
  public abstract createKindOfQuantitySync(name: string): KindOfQuantity;
  public abstract createUnit(name: string): Promise<Unit>;
  public abstract createUnitSync(name: string): Unit;
  public abstract createConstant(name: string): Promise<Constant>;
  public abstract createConstantSync(name: string): Constant;
  public abstract createInvertedUnit(name: string): Promise<InvertedUnit>;
  public abstract createInvertedUnitSync(name: string): InvertedUnit;
  public abstract createPhenomenon(name: string): Promise<Phenomenon>;
  public abstract createPhenomenonSync(name: string): Phenomenon;
  public abstract createFormat(name: string): Promise<Format>;
  public abstract createFormatSync(name: string): Format;
  public abstract createUnitSystem(name: string): Promise<UnitSystem>;
  public abstract createUnitSystemSync(name: string): UnitSystem;
  public abstract createPropertyCategory(name: string): Promise<PropertyCategory>;
  public abstract createPropertyCategorySync(name: string): PropertyCategory;
  public abstract addItem<T extends SchemaItem>(item: T): void;
  public abstract addReference(refSchema: Schema): Promise<void>;
  public abstract addReferenceSync(refSchema: Schema): void;
  public abstract setContext(schemaContext: SchemaContext): void;
  public abstract setVersion(readVersion?: number, writeVersion?: number, minorVersion?: number): void;
}

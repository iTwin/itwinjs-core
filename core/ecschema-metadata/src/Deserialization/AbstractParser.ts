/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  ConstantProps, CustomAttributeClassProps, EntityClassProps, EnumerationPropertyProps, EnumerationProps, FormatProps, InvertedUnitProps, KindOfQuantityProps,
  MixinProps, NavigationPropertyProps, PhenomenonProps, PrimitiveArrayPropertyProps, PrimitivePropertyProps, PropertyCategoryProps,
  RelationshipClassProps, SchemaProps, StructArrayPropertyProps, StructPropertyProps, UnitProps, SchemaReferenceProps, StructClassProps, UnitSystemProps,
} from "./../Deserialization/JsonProps";
import { CustomAttribute } from "../Metadata/CustomAttribute";

type SchemaItemTuple<T> = Readonly<[string /** Name */, string /** SchemaItemType */, Readonly<T>]>;
type PropertyTuple<T> = Readonly<[string /** Name */, string /** Property */, Readonly<T>]>;

/** @hidden */
export abstract class AbstractParser<TItem = any, TProperty = TItem> {
  public abstract parseSchema(): SchemaProps;
  public abstract getReferences(): Iterable<SchemaReferenceProps>;

  public abstract getItems(): Iterable<SchemaItemTuple<TItem>>;
  public abstract findItem(itemName: string): SchemaItemTuple<TItem> | undefined;

  public abstract parseEntityClass(data: Readonly<TItem>): EntityClassProps;
  public abstract parseMixin(data: Readonly<TItem>): MixinProps;
  public abstract parseStructClass(data: Readonly<TItem>): StructClassProps;
  public abstract parseCustomAttributeClass(data: Readonly<TItem>): CustomAttributeClassProps;
  public abstract parseRelationshipClass(data: Readonly<TItem>): RelationshipClassProps;
  public abstract parseEnumeration(data: Readonly<TItem>): EnumerationProps;
  public abstract parseKindOfQuantity(data: Readonly<TItem>): KindOfQuantityProps;
  public abstract parsePropertyCategory(data: Readonly<TItem>): PropertyCategoryProps;
  public abstract parseUnit(data: Readonly<TItem>): UnitProps;
  public abstract parseInvertedUnit(data: Readonly<TItem>): InvertedUnitProps;
  public abstract parseConstant(data: Readonly<TItem>): ConstantProps;
  public abstract parsePhenomenon(data: Readonly<TItem>): PhenomenonProps;
  public abstract parseFormat(data: Readonly<TItem>): FormatProps;
  public abstract parseUnitSystem(data: Readonly<TItem>): UnitSystemProps;

  public abstract getProperties(data: Readonly<TItem>): Iterable<PropertyTuple<TProperty>>;
  public abstract parsePrimitiveProperty(data: Readonly<TProperty>): PrimitivePropertyProps;
  public abstract parseStructProperty(data: Readonly<TProperty>): StructPropertyProps;
  public abstract parseEnumerationProperty(data: Readonly<TProperty>): EnumerationPropertyProps;
  public abstract parsePrimitiveArrayProperty(data: Readonly<TProperty>): PrimitiveArrayPropertyProps;
  public abstract parseStructArrayProperty(data: Readonly<TProperty>): StructArrayPropertyProps;
  public abstract parseNavigationProperty(data: Readonly<TProperty>): NavigationPropertyProps;

  public abstract getSchemaCustomAttributes(): Iterable<CustomAttribute>;
  public abstract getClassCustomAttributes(data: Readonly<TItem>): Iterable<CustomAttribute>;
  public abstract getPropertyCustomAttributes(data: Readonly<TProperty>): Iterable<CustomAttribute>;
  public abstract getRelationshipConstraintCustomAttributes(data: Readonly<TItem>): [Iterable<CustomAttribute> /* source */, Iterable<CustomAttribute> /* target */];
}

export interface AbstractParserConstructor<TSchema, TItem = any, TProperty = TItem> { new(obj: Readonly<TSchema>): AbstractParser<TItem, TProperty>; }

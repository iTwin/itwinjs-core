/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  ConstantProps, CustomAttributeClassProps, EntityClassProps, EnumerationPropertyProps, EnumerationProps, FormatProps, InvertedUnitProps, KindOfQuantityProps,
  MixinProps, NavigationPropertyProps, PhenomenonProps, PrimitiveArrayPropertyProps, PrimitivePropertyProps, PropertyCategoryProps,
  RelationshipClassProps, SchemaProps, StructArrayPropertyProps, StructPropertyProps, UnitProps, SchemaReferenceProps, StructClassProps, UnitSystemProps,
} from "./../Deserialization/JsonProps";
import { CustomAttribute } from "../Metadata/CustomAttribute";

type SchemaItemTuple<T> = [string /** Name */, string /** SchemaItemType */, T];
type PropertyTuple<T> = [string /** Name */, string /** Property */, T];

/** @hidden */
export abstract class AbstractParser<TItem = any, TProperty = TItem> {
  public abstract parseSchema(): SchemaProps;
  public abstract getReferences(): Iterable<SchemaReferenceProps>;
  public abstract getCustomAttributes(): Iterable<CustomAttribute>;

  public abstract getItems(): Iterable<SchemaItemTuple<TItem>>;
  public abstract findItem(itemName: string): SchemaItemTuple<TItem> | undefined;

  public abstract parseEntityClass(data: TItem): EntityClassProps;
  public abstract parseMixin(data: TItem): MixinProps;
  public abstract parseStructClass(data: TItem): StructClassProps;
  public abstract parseCustomAttributeClass(data: TItem): CustomAttributeClassProps;
  public abstract parseRelationshipClass(data: TItem): RelationshipClassProps;
  public abstract parseEnumeration(data: TItem): EnumerationProps;
  public abstract parseKindOfQuantity(data: TItem): KindOfQuantityProps;
  public abstract parsePropertyCategory(data: TItem): PropertyCategoryProps;
  public abstract parseUnit(data: TItem): UnitProps;
  public abstract parseInvertedUnit(data: TItem): InvertedUnitProps;
  public abstract parseConstant(data: TItem): ConstantProps;
  public abstract parsePhenomenon(data: TItem): PhenomenonProps;
  public abstract parseFormat(data: TItem): FormatProps;
  public abstract parseUnitSystem(data: TItem): UnitSystemProps;

  public abstract getProperties(data: TItem): Iterable<PropertyTuple<TProperty>>;
  public abstract parsePrimitiveProperty(data: TProperty): PrimitivePropertyProps;
  public abstract parseStructProperty(data: TProperty): StructPropertyProps;
  public abstract parseEnumerationProperty(data: TProperty): EnumerationPropertyProps;
  public abstract parsePrimitiveArrayProperty(data: TProperty): PrimitiveArrayPropertyProps;
  public abstract parseStructArrayProperty(data: TProperty): StructArrayPropertyProps;
  public abstract parseNavigationProperty(data: TProperty): NavigationPropertyProps;
}

export interface AbstractParserConstructor<TSchema, TItem = any, TProperty = TItem> { new(obj: TSchema): AbstractParser<TItem, TProperty>; }

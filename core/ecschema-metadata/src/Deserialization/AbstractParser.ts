/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  ClassProps, ConstantProps, CustomAttributeClassProps, EntityClassProps, EnumerationPropertyProps, EnumerationProps, FormatProps, InvertedUnitProps, KindOfQuantityProps,
  MixinProps, NavigationPropertyProps, PhenomenonProps, PrimitiveArrayPropertyProps, PrimitiveOrEnumPropertyBaseProps, PrimitivePropertyProps, PropertyCategoryProps,
  PropertyProps, RelationshipClassProps, RelationshipConstraintProps, SchemaItemProps, SchemaProps, StructArrayPropertyProps, StructPropertyProps, UnitProps,
} from "./../Deserialization/JsonProps";
import { AnyClass } from "./../Interfaces";

export abstract class AbstractParser<T> {
  public abstract parseSchemaProps(obj: T): SchemaProps;
  public abstract parseSchemaItemProps(obj: T, schemaName: string, name: string): SchemaItemProps;
  public abstract parseClassProps(obj: T, name: string): ClassProps;
  public abstract parseEntityClassProps(obj: T, name: string): EntityClassProps;
  public abstract parseMixinProps(obj: T, name: string): MixinProps;
  public abstract parseCustomAttributeClassProps(obj: T, name: string): CustomAttributeClassProps;
  public abstract parseRelationshipClassProps(obj: T, name: string): RelationshipClassProps;
  public abstract parseRelationshipConstraintProps(relClassName: string, obj: T, isSource?: boolean): RelationshipConstraintProps;
  public abstract parseEnumerationProps(obj: T, name: string): EnumerationProps;
  public abstract parseKindOfQuantityProps(obj: T, name: string): KindOfQuantityProps;
  public abstract parsePropertyCategoryProps(obj: T, name: string): PropertyCategoryProps;
  public abstract parseUnitProps(obj: T, name: string): UnitProps;
  public abstract parseInvertedUnitProps(obj: T, name: string): InvertedUnitProps;
  public abstract parseConstantProps(obj: T, name: string): ConstantProps;
  public abstract parsePhenomenonProps(obj: T, name: string): PhenomenonProps;
  public abstract parseFormatProps(obj: T, name: string): FormatProps;
  public abstract parsePropertyProps(obj: T, schemaName: string, className: string): PropertyProps;
  public abstract parsePrimitiveOrEnumPropertyBaseProps(obj: T, schemaName: string, className: string): PrimitiveOrEnumPropertyBaseProps;
  public abstract parsePrimitivePropertyProps(obj: T, schemaName: string, className: string): PrimitivePropertyProps;
  public abstract parseStructPropertyProps(obj: T, schemaName: string, className: string): StructPropertyProps;
  public abstract parseEnumerationPropertyProps(obj: T, schemaName: string, className: string): EnumerationPropertyProps;
  public abstract parsePrimitiveArrayPropertyProps(obj: T, schemaName: string, className: string): PrimitiveArrayPropertyProps;
  public abstract parseStructArrayPropertyProps(obj: T, schemaName: string, className: string): StructArrayPropertyProps;
  public abstract parseNavigationPropertyProps(obj: T, name: string, classObj: AnyClass): NavigationPropertyProps;
  public abstract parsePropertyTypes(obj: T, schemaName: string, className: string): PropertyProps;

}

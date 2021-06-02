/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Validation
 */

import { AnyClass, AnyECType, AnyProperty, Constant, CustomAttribute, CustomAttributeClass,
  CustomAttributeContainerProps, EntityClass, Enumeration, Format, InvertedUnit, KindOfQuantity, Mixin, Phenomenon,
  PropertyCategory, RelationshipClass, RelationshipConstraint, Schema, SchemaItem, StructClass, Unit,
  UnitSystem } from "@bentley/ecschema-metadata";
import { BaseDiagnostic } from "./Diagnostic";

/**
 * Interface used for all rule implementations used during schema validation.
 * @beta
 */
export type IRule<T extends AnyECType, U = {}> = (ecDefinition: T, ...args: U[]) => AsyncIterable<BaseDiagnostic<T, any[]>>;

/** @beta */
export type BaseRule<T extends AnyECType, U extends AnyECType> = IRule<T, U>;

/**
 * Interface used to represent logical collection of [[IRule]] instances.
 * @beta
 */
export interface IRuleSet {
  /** The name of the rule set. */
  name: string;

  /** A collection of schema names that should be excluded from adhering to the rules defined in this rule set. */
  schemaExclusionSet?: string[];

  /** The rules that apply to [[Schema]] objects. */
  schemaRules?: Array<IRule<Schema>>;
  /** The rules that apply to [[SchemaItem]] objects. */
  schemaItemRules?: Array<IRule<SchemaItem>>;
  /** The rules that apply to [[ECClass]] objects. */
  classRules?: Array<IRule<AnyClass>>;
  /** The rules that apply to [[Property]] objects. */
  propertyRules?: Array<IRule<AnyProperty>>;
  /** The rules that apply to [[EntityClass]] objects. */
  entityClassRules?: Array<IRule<EntityClass>>;
  /** The rules that apply to [[StructClass]] objects. */
  structClassRules?: Array<IRule<StructClass>>;
  /** The rules that apply to [[Mixin]] objects. */
  mixinRules?: Array<IRule<Mixin>>;
  /** The rules that apply to [[RelationshipClass]] objects. */
  relationshipRules?: Array<IRule<RelationshipClass>>;
  /** The rules that apply to [[RelationshipConstraint]] objects. */
  relationshipConstraintRules?: Array<IRule<RelationshipConstraint>>;
  /** The rules that apply to [[CustomAttributeClass]] objects. */
  customAttributeClassRules?: Array<IRule<CustomAttributeClass>>;
  /** The rules that apply to [[CustomAttributeContainerProps]] objects. */
  customAttributeContainerRules?: Array<IRule<CustomAttributeContainerProps>>;
  /** The rules that apply to [[CustomAttribute]] objects. */
  customAttributeInstanceRules?: Array<BaseRule<CustomAttributeContainerProps, CustomAttribute>>;
  /** The rules that apply to [[Enumeration]] objects. */
  enumerationRules?: Array<IRule<Enumeration>>;
  /** The rules that apply to [[KindOfQuantity]] objects. */
  kindOfQuantityRules?: Array<IRule<KindOfQuantity>>;
  /** The rules that apply to [[PropertyCategory]] objects. */
  propertyCategoryRules?: Array<IRule<PropertyCategory>>;
  /** The rules that apply to [[Format]] objects. */
  formatRules?: Array<IRule<Format>>;
  /** The rules that apply to [[Unit]] objects. */
  unitRules?: Array<IRule<Unit>>;
  /** The rules that apply to [[InvertedUnit]] objects. */
  invertedUnitRules?: Array<IRule<InvertedUnit>>;
  /** The rules that apply to [[UnitSystem]] objects. */
  unitSystemRules?: Array<IRule<UnitSystem>>;
  /** The rules that apply to [[Phenomenon]] objects. */
  phenomenonRules?: Array<IRule<Phenomenon>>;
  /** The rules that apply to [[Constant]] objects. */
  constantRules?: Array<IRule<Constant>>;
}

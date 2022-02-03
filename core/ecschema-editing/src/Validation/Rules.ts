/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Validation
 */

import type { AnyClass, AnyECType, AnyProperty, Constant, CustomAttribute, CustomAttributeClass,
  CustomAttributeContainerProps, EntityClass, Enumeration, Format, InvertedUnit, KindOfQuantity, Mixin, Phenomenon,
  PropertyCategory, RelationshipClass, RelationshipConstraint, Schema, SchemaItem, StructClass, Unit,
  UnitSystem } from "@itwin/ecschema-metadata";
import type { BaseDiagnostic } from "./Diagnostic";

/**
 * Interface used for all rule implementations used during schema validation.
 * @beta
 */
export type IRule<T extends AnyECType, U = {}> = (ecDefinition: T, ...args: U[]) => AsyncIterable<BaseDiagnostic<T, any[]>>;

/** @beta */
export type BaseRule<T extends AnyECType, U extends AnyECType> = IRule<T, U>;

/**
 * Interface used to represent logical collection of [IRule]($ecschema-editing) instances.
 * @beta
 */
export interface IRuleSet {
  /** The name of the rule set. */
  name: string;

  /** A collection of schema names that should be excluded from adhering to the rules defined in this rule set. */
  schemaExclusionSet?: string[];

  /** The rules that apply to [Schema]($ecschema-metadata) objects. */
  schemaRules?: Array<IRule<Schema>>;
  /** The rules that apply to [SchemaItem]($ecschema-metadata) objects. */
  schemaItemRules?: Array<IRule<SchemaItem>>;
  /** The rules that apply to [ECClass]($ecschema-metadata) objects. */
  classRules?: Array<IRule<AnyClass>>;
  /** The rules that apply to [Property]($ecschema-metadata) objects. */
  propertyRules?: Array<IRule<AnyProperty>>;
  /** The rules that apply to [EntityClass]($ecschema-metadata) objects. */
  entityClassRules?: Array<IRule<EntityClass>>;
  /** The rules that apply to [StructClass]($ecschema-metadata) objects. */
  structClassRules?: Array<IRule<StructClass>>;
  /** The rules that apply to [Mixin]($ecschema-metadata) objects. */
  mixinRules?: Array<IRule<Mixin>>;
  /** The rules that apply to [RelationshipClass]($ecschema-metadata) objects. */
  relationshipRules?: Array<IRule<RelationshipClass>>;
  /** The rules that apply to [RelationshipConstraint]($ecschema-metadata) objects. */
  relationshipConstraintRules?: Array<IRule<RelationshipConstraint>>;
  /** The rules that apply to [CustomAttributeClass]($ecschema-metadata) objects. */
  customAttributeClassRules?: Array<IRule<CustomAttributeClass>>;
  /** The rules that apply to [CustomAttributeContainerProps]($ecschema-metadata) objects. */
  customAttributeContainerRules?: Array<IRule<CustomAttributeContainerProps>>;
  /** The rules that apply to [CustomAttribute]($ecschema-metadata) objects. */
  customAttributeInstanceRules?: Array<BaseRule<CustomAttributeContainerProps, CustomAttribute>>;
  /** The rules that apply to [Enumeration]($ecschema-metadata) objects. */
  enumerationRules?: Array<IRule<Enumeration>>;
  /** The rules that apply to [KindOfQuantity]($ecschema-metadata) objects. */
  kindOfQuantityRules?: Array<IRule<KindOfQuantity>>;
  /** The rules that apply to [PropertyCategory]($ecschema-metadata) objects. */
  propertyCategoryRules?: Array<IRule<PropertyCategory>>;
  /** The rules that apply to [Format]($ecschema-metadata) objects. */
  formatRules?: Array<IRule<Format>>;
  /** The rules that apply to [Unit]($ecschema-metadata) objects. */
  unitRules?: Array<IRule<Unit>>;
  /** The rules that apply to [InvertedUnit]($ecschema-metadata) objects. */
  invertedUnitRules?: Array<IRule<InvertedUnit>>;
  /** The rules that apply to [UnitSystem]($ecschema-metadata) objects. */
  unitSystemRules?: Array<IRule<UnitSystem>>;
  /** The rules that apply to [Phenomenon]($ecschema-metadata) objects. */
  phenomenonRules?: Array<IRule<Phenomenon>>;
  /** The rules that apply to [Constant]($ecschema-metadata) objects. */
  constantRules?: Array<IRule<Constant>>;
}

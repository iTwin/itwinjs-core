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
  UnitSystem } from "@itwin/ecschema-metadata";
import { AnyDiagnostic } from "./Diagnostic";

/**
 * Interface used for all rule suppressions used during schema validation.
 * Just telling us whether a rule is suppressed or not.
 * @beta
 */
export type ISuppressionRule<T extends AnyECType, U = {}> = (diagnostic: AnyDiagnostic, ecDefinition: T, ...args: U[]) => Promise<boolean>;

/** @beta */
export type BaseSuppressionRule<T extends AnyECType, U extends AnyECType> = ISuppressionRule<T, U>;

export type AnyRuleSuppressionMap = IRuleSuppressionMap<AnyECType>;

/**
 * Interface used to represent elements of a rule suppression
 * @beta
 */
export interface IRuleSuppressionMap<T extends AnyECType, U = {}> {
  ruleCode: string;
  rule: ISuppressionRule<T, U>;
}

/**
 * Interface used to represent elements of a rule suppression
 * @beta
 */
export interface BaseRuleSuppressionMap<T extends AnyECType, U extends AnyECType> {
  ruleCode: string;
  rule: BaseSuppressionRule<T, U>;
}

/**
 * Interface used to represent logical collection of [[ISuppressionRule]] instances.
 * @beta
 */
export interface IRuleSuppressionSet {
  name: string;
  schemaRuleSuppressions?: Array<IRuleSuppressionMap<Schema>>;
  schemaItemRuleSuppressions?: Array<IRuleSuppressionMap<SchemaItem>>;
  classRuleSuppressions?: Array<IRuleSuppressionMap<AnyClass>>;
  propertyRuleSuppressions?: Array<IRuleSuppressionMap<AnyProperty>>;
  entityRuleSuppressions?: Array<IRuleSuppressionMap<EntityClass>>;
  structRuleSuppressions?: Array<IRuleSuppressionMap<StructClass>>;
  mixinRuleSuppressions?: Array<IRuleSuppressionMap<Mixin>>;
  relationshipRuleSuppressions?: Array<IRuleSuppressionMap<RelationshipClass>>;
  relationshipConstraintRuleSuppressions?: Array<IRuleSuppressionMap<RelationshipConstraint>>;
  customAttributeRuleSuppressions?: Array<IRuleSuppressionMap<CustomAttributeClass>>;
  customAttributeContainerSuppressions?: Array<IRuleSuppressionMap<CustomAttributeContainerProps>>;
  customAttributeInstanceSuppressions?: Array<BaseRuleSuppressionMap<CustomAttributeContainerProps, CustomAttribute>>;
  enumerationRuleSuppressions?: Array<IRuleSuppressionMap<Enumeration>>;
  koqRuleSuppressions?: Array<IRuleSuppressionMap<KindOfQuantity>>;
  propertyCategoryRuleSuppressions?: Array<IRuleSuppressionMap<PropertyCategory>>;
  formatRuleSuppressions?: Array<IRuleSuppressionMap<Format>>;
  unitRuleSuppressions?: Array<IRuleSuppressionMap<Unit>>;
  invertedUnitRuleSuppressions?: Array<IRuleSuppressionMap<InvertedUnit>>;
  unitSystemRuleSuppressions?: Array<IRuleSuppressionMap<UnitSystem>>;
  phenomenonRuleSuppressions?: Array<IRuleSuppressionMap<Phenomenon>>;
  constantRuleSuppressions?: Array<IRuleSuppressionMap<Constant>>;
}

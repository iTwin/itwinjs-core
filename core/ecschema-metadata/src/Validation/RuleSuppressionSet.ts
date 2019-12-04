/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { AnyECType, AnyClass } from "../Interfaces";
import { KindOfQuantity } from "../Metadata/KindOfQuantity";
import { Schema } from "../Metadata/Schema";
import { SchemaItem } from "../Metadata/SchemaItem";
import { AnyProperty } from "../Metadata/Property";
import { EntityClass } from "../Metadata/EntityClass";
import { StructClass } from "../Metadata/Class";
import { Mixin } from "../Metadata/Mixin";
import { RelationshipClass, RelationshipConstraint } from "../Metadata/RelationshipClass";
import { CustomAttributeClass } from "../Metadata/CustomAttributeClass";
import { CustomAttributeContainerProps, CustomAttribute } from "../Metadata/CustomAttribute";
import { Enumeration } from "../Metadata/Enumeration";
import { PropertyCategory } from "../Metadata/PropertyCategory";
import { Format } from "../Metadata/Format";
import { Unit } from "../Metadata/Unit";
import { InvertedUnit } from "../Metadata/InvertedUnit";
import { UnitSystem } from "../Metadata/UnitSystem";
import { Phenomenon } from "../Metadata/Phenomenon";
import { Constant } from "../Metadata/Constant";

/**
 * Interface used for all rule suppressions used during schema validation.
 * Just telling us whether a rule is suppressed or not.
 * @beta
 */
export type ISuppressionRule<T extends AnyECType, U = {}> = (ecDefinition: T, ...args: U[]) => Promise<boolean>;

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

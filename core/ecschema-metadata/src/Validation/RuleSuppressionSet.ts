/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Validation
 */

import { AnyClass, AnyECType } from "../Interfaces";
import { StructClass } from "../Metadata/Class";
import { Constant } from "../Metadata/Constant";
import { CustomAttribute, CustomAttributeContainerProps } from "../Metadata/CustomAttribute";
import { CustomAttributeClass } from "../Metadata/CustomAttributeClass";
import { EntityClass } from "../Metadata/EntityClass";
import { Enumeration } from "../Metadata/Enumeration";
import { Format } from "../Metadata/Format";
import { InvertedUnit } from "../Metadata/InvertedUnit";
import { KindOfQuantity } from "../Metadata/KindOfQuantity";
import { Mixin } from "../Metadata/Mixin";
import { Phenomenon } from "../Metadata/Phenomenon";
import { AnyProperty } from "../Metadata/Property";
import { PropertyCategory } from "../Metadata/PropertyCategory";
import { RelationshipClass, RelationshipConstraint } from "../Metadata/RelationshipClass";
import { Schema } from "../Metadata/Schema";
import { SchemaItem } from "../Metadata/SchemaItem";
import { Unit } from "../Metadata/Unit";
import { UnitSystem } from "../Metadata/UnitSystem";
import { AnyDiagnostic } from "./Diagnostic";

/* eslint-disable deprecation/deprecation */

/**
 * Interface used for all rule suppressions used during schema validation.
 * Just telling us whether a rule is suppressed or not.
 * @beta
 * @deprecated Moved to the ecschema-editing package.
 */
export type ISuppressionRule<T extends AnyECType, U = {}> = (diagnostic: AnyDiagnostic, ecDefinition: T, ...args: U[]) => Promise<boolean>;

/**
 * @beta
 * @deprecated Moved to the ecschema-editing package.
*/
export type BaseSuppressionRule<T extends AnyECType, U extends AnyECType> = ISuppressionRule<T, U>;

export type AnyRuleSuppressionMap = IRuleSuppressionMap<AnyECType>;

/**
 * Interface used to represent elements of a rule suppression
 * @beta
 * @deprecated Moved to the ecschema-editing package.
 */
export interface IRuleSuppressionMap<T extends AnyECType, U = {}> {
  ruleCode: string;
  rule: ISuppressionRule<T, U>;
}

/**
 * Interface used to represent elements of a rule suppression
 * @deprecated Moved to the ecschema-editing package.
 */
export interface BaseRuleSuppressionMap<T extends AnyECType, U extends AnyECType> {
  ruleCode: string;
  rule: BaseSuppressionRule<T, U>;
}

/**
 * Interface used to represent logical collection of [[ISuppressionRule]] instances.
 * @beta
 * @deprecated Moved to the ecschema-editing package.
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

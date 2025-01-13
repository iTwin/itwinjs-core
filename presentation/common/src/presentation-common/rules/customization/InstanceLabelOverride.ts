/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { SingleSchemaClassSpecification } from "../ClassSpecifications";
import { RelationshipPathSpecification } from "../RelationshipPathSpecification";
import { RuleBase } from "../Rule";

/**
 * Instance label override rule provides a way to set instance label to one of its property values,
 * other attributes and/or combination of them.
 *
 * @see [Instance label override reference documentation page]($docs/presentation/customization/InstanceLabelOverride.md)
 * @public
 */
export interface InstanceLabelOverride extends RuleBase {
  /** Used for serializing to JSON. */
  ruleType: "InstanceLabelOverride";

  /**
   * Specifies the ECClass to apply this rule to.
   */
  class: SingleSchemaClassSpecification;

  /**
   * Specifications of values used to override label. The first non-empty value is used as the actual label.
   */
  values: InstanceLabelOverrideValueSpecification[];
}

/**
 * Types of possible [[InstanceLabelOverride]] label values.
 * @public
 */
export enum InstanceLabelOverrideValueSpecificationType {
  Composite = "Composite",
  Property = "Property",
  ClassName = "ClassName",
  ClassLabel = "ClassLabel",
  BriefcaseId = "BriefcaseId",
  LocalId = "LocalId",
  String = "String",
  RelatedInstanceLabel = "RelatedInstanceLabel",
}

/**
 * Base interface for all [[InstanceLabelOverrideValueSpecification]] implementations.
 * @public
 */
export interface InstanceLabelOverrideValueSpecificationBase {
  /**
   * Type of the specification
   * @see InstanceLabelOverrideValueSpecificationType
   */
  specType: `${InstanceLabelOverrideValueSpecificationType}`;
}

/**
 * Specification allows creating a label value composited using multiple other specifications.
 *
 * @see [Composite value specification reference documentation page]($docs/presentation/customization/InstanceLabelOverride.md#composite-value-specification)
 * @public
 */
export interface InstanceLabelOverrideCompositeValueSpecification extends InstanceLabelOverrideValueSpecificationBase {
  specType: "Composite";

  /**
   * Parts of the value.
   *
   * If any of the parts with `isRequired` flag evaluate to an empty string, the
   * result of this specification is also an empty string.
   */
  parts: Array<{ spec: InstanceLabelOverrideValueSpecification; isRequired?: boolean }>;

  /** Separator to use when joining the parts. Defaults to a space character. */
  separator?: string;
}

/**
 * Specification uses property value as the label content.
 *
 * @see [Property value specification reference documentation page]($docs/presentation/customization/InstanceLabelOverride.md#property-value-specification)
 * @public
 */
export interface InstanceLabelOverridePropertyValueSpecification extends InstanceLabelOverrideValueSpecificationBase {
  specType: "Property";

  /**
   * Name of the property whose value should be used.
   * @note A property with this name must exist on the property class (see [[propertySource]]).
   */
  propertyName: string;

  /**
   * [Specification of the relationship path]($docs/presentation/RelationshipPathSpecification.md) from [[InstanceLabelOverride.class]]
   * to class of the property. If omitted, [[InstanceLabelOverride.class]] is used as property class.
   */
  propertySource?: RelationshipPathSpecification;
}

/**
 * Specification uses ECClass name as the label content.
 *
 * @see [Class name value specification reference documentation page]($docs/presentation/customization/InstanceLabelOverride.md#class-name-value-specification)
 * @public
 */
export interface InstanceLabelOverrideClassNameSpecification extends InstanceLabelOverrideValueSpecificationBase {
  specType: "ClassName";

  /** Should full (`{schemaName}.{className}`) class name be used */
  full?: boolean;
}

/**
 * Specification uses ECClass display label as the label content.
 *
 * @see [Class label value specification reference documentation page]($docs/presentation/customization/InstanceLabelOverride.md#class-label-value-specification)
 * @public
 */
export interface InstanceLabelOverrideClassLabelSpecification extends InstanceLabelOverrideValueSpecificationBase {
  specType: "ClassLabel";
}

/**
 * Specification returns ECInstance's briefcase ID in base36 format.
 *
 * @see [BriefcaseId value specification reference documentation page]($docs/presentation/customization/InstanceLabelOverride.md#briefcaseid-value-specification)
 * @public
 */
export interface InstanceLabelOverrideBriefcaseIdSpecification extends InstanceLabelOverrideValueSpecificationBase {
  specType: "BriefcaseId";
}

/**
 * Specification returns ECInstance's local ID in base36 format.
 *
 * @see [LocalId value specification reference documentation page]($docs/presentation/customization/InstanceLabelOverride.md#localid-value-specification)
 * @public
 */
export interface InstanceLabelOverrideLocalIdSpecification extends InstanceLabelOverrideValueSpecificationBase {
  specType: "LocalId";
}

/**
 * Specification uses the specified value as the label content.
 *
 * @see [String value specification reference documentation page]($docs/presentation/customization/InstanceLabelOverride.md#string-value-specification)
 * @public
 */
export interface InstanceLabelOverrideStringValueSpecification extends InstanceLabelOverrideValueSpecificationBase {
  specType: "String";

  /** The value to use as the label content. */
  value: string;
}

/**
 * Specification uses label of another related instance as the label content.
 *
 * @see [Related instance label value specification reference documentation page]($docs/presentation/customization/InstanceLabelOverride.md#related-instance-label-value-specification)
 * @public
 */
export interface InstanceLabelOverrideRelatedInstanceLabelSpecification extends InstanceLabelOverrideValueSpecificationBase {
  specType: "RelatedInstanceLabel";

  /**
   * [Specification of the relationship path]($docs/presentation/RelationshipPathSpecification.md) from `InstanceLabelOverride.class`
   * to class of the related instance.
   */
  pathToRelatedInstance: RelationshipPathSpecification;
}

/**
 * Specification to define how the label for [[InstanceLabelOverride]] should be created.
 * @public
 */
export type InstanceLabelOverrideValueSpecification =
  | InstanceLabelOverrideCompositeValueSpecification
  | InstanceLabelOverridePropertyValueSpecification
  | InstanceLabelOverrideStringValueSpecification
  | InstanceLabelOverrideClassNameSpecification
  | InstanceLabelOverrideClassLabelSpecification
  | InstanceLabelOverrideBriefcaseIdSpecification
  | InstanceLabelOverrideLocalIdSpecification
  | InstanceLabelOverrideRelatedInstanceLabelSpecification;

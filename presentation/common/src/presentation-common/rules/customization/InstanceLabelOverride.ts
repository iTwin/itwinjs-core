/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import type { SingleSchemaClassSpecification } from "../ClassSpecifications";
import type { RelationshipPathSpecification } from "../RelationshipPathSpecification";
import type { RuleBase, RuleTypes } from "../Rule";

/**
 * Rule to override labels for instances of specific ECClasses.
 *
 * **Important:** Prefer this rule over [[LabelOverride]] when possible as it
 * has better performance.
 *
 * @see [More details]($docs/presentation/Customization/InstanceLabelOverride.md)
 * @public
 */
export interface InstanceLabelOverride extends RuleBase {
  /** Used for serializing to JSON. */
  ruleType: RuleTypes.InstanceLabelOverride;

  /**
   * Specification of the ECClass to apply this rule to.
   */
  class: SingleSchemaClassSpecification;

  /**
   * Specifications for the label value. The first non-empty value
   * is used as the actual label.
   */
  values: InstanceLabelOverrideValueSpecification[];
}

/**
 * Types of possible [[InstanceLabelOverride]] label value.
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
  /** Type of the specification */
  specType: InstanceLabelOverrideValueSpecificationType;
}

/**
 * Specification that allows creating a label value composited using
 * multiple other specifications.
 *
 * @public
 */
export interface InstanceLabelOverrideCompositeValueSpecification extends InstanceLabelOverrideValueSpecificationBase {
  specType: InstanceLabelOverrideValueSpecificationType.Composite;

  /**
   * Parts of the value.
   *
   * If any of the parts with `isRequired` flag evaluate to an empty string, the
   * result of this specification is also an empty string.
   */
  parts: Array<{ spec: InstanceLabelOverrideValueSpecification, isRequired?: boolean }>;

  /** Separator to use when joining the parts. Defaults to a space character. */
  separator?: string;
}

/**
 * Specification that uses property value as the label content.
 * @public
 */
export interface InstanceLabelOverridePropertyValueSpecification extends InstanceLabelOverrideValueSpecificationBase {
  specType: InstanceLabelOverrideValueSpecificationType.Property;

  /**
   * Name of the property whose value should be used.
   * @note A property with this name must exist on the property class (see [[propertySource]]).
   */
  propertyName: string;

  /**
   * Path from `InstanceLabelOverride.class` to the property class. If omitted,
   * `InstanceLabelOverride.class` is used as property class.
   * @beta
   */
  propertySource?: RelationshipPathSpecification;
}

/**
 * Specification that uses ECClass name as the label content.
 * @public
 */
export interface InstanceLabelOverrideClassNameSpecification extends InstanceLabelOverrideValueSpecificationBase {
  specType: InstanceLabelOverrideValueSpecificationType.ClassName;

  /** Should full (`{schemaName}.{className}`) class name be used */
  full?: boolean;
}

/**
 * Specification that uses ECClass display label as the label content.
 * @public
 */
export interface InstanceLabelOverrideClassLabelSpecification extends InstanceLabelOverrideValueSpecificationBase {
  specType: InstanceLabelOverrideValueSpecificationType.ClassLabel;
}

/**
 * Specification that returns ECInstance's briefcase ID in base36 format.
 * @public
 */
export interface InstanceLabelOverrideBriefcaseIdSpecification extends InstanceLabelOverrideValueSpecificationBase {
  specType: InstanceLabelOverrideValueSpecificationType.BriefcaseId;
}

/**
 * Specification that returns ECInstance's local ID in base36 format.
 * @public
 */
export interface InstanceLabelOverrideLocalIdSpecification extends InstanceLabelOverrideValueSpecificationBase {
  specType: InstanceLabelOverrideValueSpecificationType.LocalId;
}

/**
 * Specification that uses the specified value as the label content.
 * @public
 */
export interface InstanceLabelOverrideStringValueSpecification extends InstanceLabelOverrideValueSpecificationBase {
  specType: InstanceLabelOverrideValueSpecificationType.String;

  /** The value to use as the label content. */
  value: string;
}

/**
 * Specification that uses label of a related instance as the label content.
 * @public
 */
export interface InstanceLabelOverrideRelatedInstanceLabelSpecification extends InstanceLabelOverrideValueSpecificationBase {
  specType: InstanceLabelOverrideValueSpecificationType.RelatedInstanceLabel;

  /**
   * Path from `InstanceLabelOverride.class` to the class of related instance whose label
   * should be returned.
   */
  pathToRelatedInstance: RelationshipPathSpecification;
}

/**
 * Specification to define how the label for [[InstanceLabelOverride]] should be created.
 * @public
 */
export type InstanceLabelOverrideValueSpecification =
  InstanceLabelOverrideCompositeValueSpecification | InstanceLabelOverridePropertyValueSpecification |
  InstanceLabelOverrideStringValueSpecification | InstanceLabelOverrideClassNameSpecification |
  InstanceLabelOverrideClassLabelSpecification | InstanceLabelOverrideBriefcaseIdSpecification |
  InstanceLabelOverrideLocalIdSpecification | InstanceLabelOverrideRelatedInstanceLabelSpecification;

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { StrippedRelationshipPath } from "./EC";

/**
 * Definition of an instance filter that can be used to filter content or hierarchy levels.
 *
 * Example:
 *
 * ```json
 * {
 *   selectClassName: "MySchema:MyClass",
 *   expression: "this.MyProperty = 1 AND other.OtherProperty = 2",
 *   relatedInstances: [{
 *     pathFromSelectToPropertyClass: [{
 *         sourceClassName: "MySchema:MyClass",
 *         relationshipName: "MySchema:RelationshipFromMyToOtherClass",
 *         isForwardRelationship: true,
 *         targetClassName: "MySchema:OtherClass",
 *     }],
 *     alias: "other",
 *   }],
 * }
 * ```
 *
 * @beta
 */
export interface InstanceFilterDefinition {
  /**
   * Select class filter used to select only instances of specific class.
   * The [[relatedInstances]] attribute, when used, should specify paths from this class.
   * Also, the [[expression]] attribute's `this` symbol points to instances of this class.
   *
   * The format is full class name: `SchemaName:ClassName`.
   */
  selectClassName: string;

  /**
   * Specifies relationship paths pointing to related instances used in the [[expression]] attribute.
   *
   * Sometimes there's a need to filter on a related instance property. In that case, the relationship
   * needs to be named by specifying the path and alias for the target (or the relationship). Then, the
   * related instance's symbol context can be accessed through the root symbol named as specified in the
   * [[alias]] (or [[relationshipAlias]]) attribute.
   */
  relatedInstances?: InstanceFilterRelatedInstanceDefinition[];

  /**
   * [ECExpression]($docs/presentation/advanced/ECExpressions.md) for filtering the select instances.
   */
  expression: string;
}

/**
 * Related instance definition for accessing properties of a related instance in [[InstanceFilterDefinition.expression]].
 * @beta
 */
export type InstanceFilterRelatedInstanceDefinition = InstanceFilterRelatedInstancePath &
  (InstanceFilterRelatedInstanceTargetAlias | InstanceFilterRelatedInstanceRelationshipAlias);

/**
 * Partial definition of common attributes for [[InstanceFilterRelatedInstanceDefinition]].
 * @beta
 */
export interface InstanceFilterRelatedInstancePath {
  /**
   * A relationship path from select class (either specified through [[InstanceFilterDefinition.selectClassName]] or taken from context)
   * to the target related instance containing the properties used in [[InstanceFilterDefinition.expression]].
   */
  pathFromSelectToPropertyClass: StrippedRelationshipPath;
  /**
   * An optional flag indicating that the target instance must exist. Setting this allows to filter out all
   * select instances that don't have a related instance by following the [[pathFromSelectToPropertyClass]] path.
   */
  isRequired?: boolean;
}

/**
 * Partial definition of [[InstanceFilterRelatedInstanceDefinition]] for the case when referencing the target class.
 * @beta
 */
export interface InstanceFilterRelatedInstanceTargetAlias {
  /**
   * An alias for the target class in the [[InstanceFilterRelatedInstancePath.pathFromSelectToPropertyClass]] path. This alias can be used to
   * access related instance symbols context in the [[InstanceFilterDefinition.expression]].
   */
  alias: string;
}

/**
 * Partial definition of [[InstanceFilterRelatedInstanceDefinition]] for the case when referencing the relationship class.
 * @beta
 */
export interface InstanceFilterRelatedInstanceRelationshipAlias {
  /**
   * An alias for the relationship in the last step of the [[InstanceFilterRelatedInstancePath.pathFromSelectToPropertyClass]] path. This alias can be
   * used to access the relationship instance symbols context in the [[InstanceFilterDefinition.expression]].
   */
  relationshipAlias: string;
}

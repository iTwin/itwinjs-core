/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { StrippedRelationshipPath } from "./EC";

/** @alpha */
export interface InstanceFilterDefinition {
  /**
   * Select class filter that used to select only instances of specific class.
   * The [[relatedInstances]] attribute should specify paths from this class.
   * Also, the [[expression]] attribute's `this` symbol points to instances of this class.
   *
   * It should by full class name: `SchemaName:ClassName`.
   */
  selectClassName: string;

  /**
   * Relationship paths pointing to related instances used in the [[expression]] attribute.
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

/** @alpha */
export type InstanceFilterRelatedInstanceDefinition =
  InstanceFilterRelatedInstancePath
  & (InstanceFilterRelatedInstanceTargetAlias | InstanceFilterRelatedInstanceRelationshipAlias);

/** @alpha */
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

/** @alpha */
export interface InstanceFilterRelatedInstanceTargetAlias {
  /**
   * An alias for the target class in the [[InstanceFilterRelatedInstancePath.pathFromSelectToPropertyClass]] path. This alias can be used to
   * access related instance symbols context in the [[InstanceFilterDefinition.expression]].
   */
  alias: string;
}

/** @alpha */
export interface InstanceFilterRelatedInstanceRelationshipAlias {
  /**
   * An alias for the relationship in the last step of the [[InstanceFilterRelatedInstancePath.pathFromSelectToPropertyClass]] path. This alias can be
   * used to access the relationship instance symbols context in the [[InstanceFilterDefinition.expression]].
   */
  relationshipAlias: string;
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { StrippedRelationshipPath } from "./EC";

/**
  * @alpha
  */
export interface InstanceFilterDefinition {
  /**
    * Select class filter that may be used to select only instances of specific class.
    *
    * If specified, the [[relatedInstances]] attribute should specify paths from this
    * class. Also, the [[expression]] attribute's `this` symbol points to instances of this class.
    */
  selectClassName?: string;

  /**
    * Relationship paths pointing to related instances used in the [[expression]] attribute.
    *
    * Sometimes there's a need to filter on a related instance property. In that case, the relationship
    * needs to be named by specifying the path and alias for the target (or the relationship). Then, the
    * related instance's symbol context can be accessed through the root symbol named as specified in the
    * [[alias]] (or [[relationshipAlias]]) attribute.
    */
  relatedInstances?: Array<{
    /**
      * A relationship path from select class (either specified through [[selectClassName]] or taken from context)
      * to the target related instance containing the properties used in [[expression]].
      */
    pathFromSelectToPropertyClass: StrippedRelationshipPath;
    /**
      * An optional flag indicating that the target instance must exist. Setting this allows to filter out all
      * select instances that don't have a related instance by following the [[pathFromSelectToPropertyClass]] path.
      */
    isRequired?: boolean;
  } & ({
    /**
      * An alias for the target class in the [[pathFromSelectToPropertyClass]] path. This alias can be used to
      * access related instance symbols context in the [[expression]].
      */
    alias: string;
  } | {
    /**
      * An alias for the relationship in the last step of the [[pathFromSelectToPropertyClass]] path. This alias can be
      * used to access the relationship instance symbols context in the [[expression]].
      */
    relationshipAlias: string;
  })>;

  /**
    * [ECExpression]($docs/presentation/advanced/ECExpressions.md) for filtering the select instances.
    */
  expression: string;
}

/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { RelationshipDirection } from "./RelationshipDirection";
import { SingleSchemaClassSpecification } from "./ClassSpecifications";

/**
 * This sub-specification allows joining the primary node instance with any number of related instances and creating
 * hierarchies based on a mix of those related instances.
 *
 * The related instance property values can be accessed from [[CustomizationRule]] and also used in
 * instance filters.
 */
export interface RelatedInstanceSpecification {
  /** Specification of the relationship to use for joining the related instance */
  relationship: SingleSchemaClassSpecification;

  /** Specification of the related instance class. */
  class: SingleSchemaClassSpecification;

  /** Direction of the relationship */
  requiredDirection: RelationshipDirection.Forward | RelationshipDirection.Backward;

  /**
   * The alias to give for the joined related instance. Used to reference the related instance in
   * instance filter and customization rules.
   *
   * **The value must be unique per-specification!**
   */
  alias: string;

  /**
   * Is the related instance required to exist. If yes, primary instance won't be returned
   * if the related instance doesn't exist. If not, primary instance will be returned, but related
   * instance will be null.
   *
   * In SQL terms in can be compared to INNER JOIN vs OUTER JOIN.
   */
  isRequired?: boolean;
}

/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

/** Query specifications used in [[SearchResultInstanceNodesSpecification]]. */
export declare type QuerySpecification = StringQuerySpecification | ECPropertyValueQuerySpecification;

/** Used for serializing array of [[QuerySpecification]] to JSON. */
export enum QuerySpecificationTypes {
  StringQuerySpecification = "StringQuery",
  ECPropertyValueQuerySpecification = "ECPropertyQuery",
}

/** Base interface for [[QuerySpecification]] */
export interface QuerySpecificationBase {
  /** Used for serializing to JSON. */
  type: QuerySpecificationTypes;

  /** The schema name of ECClass whose ECInstances the query returns. */
  schemaName: string;

  /** The ECClass name whose ECInstances the query returns. */
  className: string;
}

/**
 * The StringQuery specification contains an ECSQL query which is used to query for instances.
 */
export interface StringQuerySpecification extends QuerySpecificationBase {
  /** Used for serializing to JSON. */
  type: QuerySpecificationTypes.StringQuerySpecification;

  /** Specifies the search ECSQL query. */
  query: string;
}

/**
 * The parentPropertyValue specification specifies the name of the parent instance property whose value is the
 * ECSQL used to query for instances.
 *
 * **Precondition:**
 * Can be used only if parent node is ECInstance node, if there is no immediate parent instance node it will go up
 * until it finds one.
 */
export interface ECPropertyValueQuerySpecification extends QuerySpecificationBase {
  /** Used for serializing to JSON. */
  type: QuerySpecificationTypes.ECPropertyValueQuerySpecification;

  /**
   * Specifies the name of the parent instance property whose value contains the ECSQL query.
   *
   * **Warning:**
   * The property whose name is specified must be of string type.
   */
  parentPropertyName: string;
}

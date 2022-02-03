/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import type { SingleSchemaClassSpecification } from "../ClassSpecifications";
import type { ChildNodeSpecificationBase, ChildNodeSpecificationTypes, DefaultGroupingPropertiesContainer } from "./ChildNodeSpecification";

/**
 * Creates nodes for instances which are returned by an ECSQL query.
 *
 * **Note:** this specification is formerly known as `SearchResultInstanceNodesSpecification`.
 *
 * @see [More details]($docs/presentation/Hierarchies/CustomQueryInstanceNodes.md)
 * @public
 */
export interface CustomQueryInstanceNodesSpecification extends ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer {
  /** Used for serializing to JSON. */
  specType: ChildNodeSpecificationTypes.CustomQueryInstanceNodes;

  /**
   * Specifications of queries used to create the content.
   *
   * **Note:** if more than one search query is specified, the results get merged.
   */
  queries?: QuerySpecification[];
}

/**
 * Query specifications used in [[CustomQueryInstanceNodesSpecification]].
 * @public
 */
export declare type QuerySpecification = StringQuerySpecification | ECPropertyValueQuerySpecification;

/**
 * Used for serializing array of [[QuerySpecification]] to JSON.
 * @public
 */
export enum QuerySpecificationTypes {
  String = "String",
  ECPropertyValue = "ECPropertyValue",
}

/**
 * Base interface for all [[QuerySpecification]] implementations. Not meant
 * to be used directly, see `QuerySpecification`.
 * @public
 */
export interface QuerySpecificationBase {
  /** Used for serializing to JSON. */
  specType: QuerySpecificationTypes;

  /** Specification of ECClass whose instances the query returns. */
  class: SingleSchemaClassSpecification;
}

/**
 * Specification which contains an ECSQL query used to query for instances.
 * @public
 */
export interface StringQuerySpecification extends QuerySpecificationBase {
  /** Used for serializing to JSON. */
  specType: QuerySpecificationTypes.String;

  /** Specifies the search ECSQL query. */
  query: string;
}

/**
 * Specification which specifies the name of the parent instance property whose
 * value is the ECSQL used to query for instances.
 *
 * **Precondition:** can be used only if parent node is ECInstance node.
 * If there is no immediate parent instance node it will go up until it finds one.
 *
 * @public
 */
export interface ECPropertyValueQuerySpecification extends QuerySpecificationBase {
  /** Used for serializing to JSON. */
  specType: QuerySpecificationTypes.ECPropertyValue;

  /**
   * Specifies name of the parent instance property whose value
   * contains the ECSQL query.
   *
   * **Warning:** the property whose name is specified must be of string type.
   */
  parentPropertyName: string;
}

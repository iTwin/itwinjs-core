/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer } from "./ChildNodeSpecification";
import { RuleSpecificationTypes } from "../RuleSpecification";
import { SingleSchemaClassSpecification } from "../ClassSpecifications";

/**
 * Returns nodes for instances which are returned by an ECSQL query.
 *
 * **Note:** this specification is formerly known as `SearchResultInstanceNodesSpecification`.
 */
export interface CustomQueryInstanceNodesSpecification extends ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer {
  /** Used for serializing to JSON. */
  specType: RuleSpecificationTypes.CustomQueryInstanceNodes;

  /**
   * Specifications of queries used to create the content.
   *
   * **Note:** if more than one search query is specified, the results get merged.
   */
  queries?: QuerySpecification[];
}

/** Query specifications used in [[CustomQueryInstanceNodesSpecification]]. */
export declare type QuerySpecification = StringQuerySpecification | ECPropertyValueQuerySpecification;

/** Used for serializing array of [[QuerySpecification]] to JSON. */
export const enum QuerySpecificationTypes {
  String = "String",
  ECPropertyValue = "ECPropertyValue",
}

/** Base interface for all [[QuerySpecification]] implementations */
export interface QuerySpecificationBase {
  /** Used for serializing to JSON. */
  specType: QuerySpecificationTypes;

  /** Specification of ECClass whose instances the query returns. */
  class: SingleSchemaClassSpecification;
}

/**
 * Specification which contains an ECSQL query used to query for instances.
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

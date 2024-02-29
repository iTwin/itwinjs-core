/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PresentationRules
 */

import { SingleSchemaClassSpecification } from "../ClassSpecifications";
import { ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer } from "./ChildNodeSpecification";

/**
 * Returns nodes for instances returned by a provided ECSQL query.
 *
 * @see [Custom query instance nodes specification reference documentation page]($docs/presentation/hierarchies/CustomQueryInstanceNodes.md)
 * @public
 */
export interface CustomQueryInstanceNodesSpecification extends ChildNodeSpecificationBase, DefaultGroupingPropertiesContainer {
  /** Used for serializing to JSON. */
  specType: "CustomQueryInstanceNodes";

  /**
   * Specifications of queries used to create the content. Query specifications define the actual
   * results of the specification.
   */
  queries?: QuerySpecification[];
}

/**
 * Query specifications used in [[CustomQueryInstanceNodesSpecification]].
 *
 * @see [Custom query specifications reference documentation section]($docs/presentation/hierarchies/CustomQueryInstanceNodes.md#attribute-queries)
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
 * Base interface for all [[QuerySpecification]] implementations.
 * @public
 */
export interface QuerySpecificationBase {
  /**
   * Used for serializing to JSON.
   * @see QuerySpecificationTypes
   */
  specType: `${QuerySpecificationTypes}`;

  /**
   * Specification of ECClass whose instances the query returns. The specification may also point to a
   * base class of instances returned by the query. If the query returns instances that are not of this
   * class, they aren't included in the result set.
   */
  class: SingleSchemaClassSpecification;
}

/**
 * The specification contains an ECSQL query which is used to query for instances.
 *
 * @see [String query specification reference documentation section]($docs/presentation/hierarchies/CustomQueryInstanceNodes.md#string-query-specification)
 * @public
 */
export interface StringQuerySpecification extends QuerySpecificationBase {
  /** Used for serializing to JSON. */
  specType: "String";

  /** Specifies the search ECSQL query. */
  query: string;
}

/**
 * The specification specifies the name of the parent node instance property whose value is the ECSQL
 * used to query for instances.
 *
 * @see [ECProperty value query specification reference documentation section]($docs/presentation/hierarchies/CustomQueryInstanceNodes.md#ecproperty-value-query-specification)
 * @public
 */
export interface ECPropertyValueQuerySpecification extends QuerySpecificationBase {
  /** Used for serializing to JSON. */
  specType: "ECPropertyValue";

  /**
   * Specifies name of the parent instance property whose value contains the ECSQL query.
   */
  parentPropertyName: string;
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Entities
 */

import { Id64String } from "@itwin/core-bentley";

/** The persistent format of an [Entity]($backend), also used as the "wire format" when transmitting information about entities
 * between the backend and frontend.
 * EntityProps and all of its sub-types like [[ElementProps]] are "plain old Javascript objects" - that is, objects containing
 * no methods and no properties of `class` type.
 * @public
 * @extensions
 */
export interface EntityProps {
  /** A non-existent property used to discriminate between [[EntityProps]] and [Entity]($backend).
   * @see [Entity.isInstanceOfEntity]($backend).
   */
  readonly isInstanceOfEntity?: never;
  /** The full name of the [ECClass]($docs/bis/guide/references/glossary/#ecclass) for this entity, in the form "Schema:ClassName" */
  classFullName: string;
  /** The Id of the entity. Must be present for SELECT, UPDATE, or DELETE, ignored for INSERT. */
  id?: Id64String;
  /** Optional [json properties]($docs/bis/guide/fundamentals/element-fundamentals.md#jsonproperties) of this Entity. */
  jsonProperties?: { [key: string]: any };
}

/** Specifies the source and target elements of a [[Relationship]] instance.
 * @public
 * @extensions
 */
export interface SourceAndTarget {
  sourceId: Id64String;
  targetId: Id64String;
}

/** Properties that are common to all types of link table ECRelationships
 * @public
 * @extensions
 */
export interface RelationshipProps extends EntityProps, SourceAndTarget {
}

/** Parameters for performing a query on [Entity]($backend) classes.
 * @public
 * @extensions
 */
export interface EntityQueryParams {
  /** The sql className, in the form "Schema.ClassName", of the class to search. */
  from?: string;
  /** Set to true to limit results to *not* include sub-classes of "from" class */
  only?: boolean;
  /** Optional "WHERE" clause to filter entities. Note: do *not* include the "WHERE" keyword. */
  where?: string;
  /** Optional "ORDERBY" clause to sort results. Note: do *not* include the "ORDERBY" keyword. */
  orderBy?: string;
  /** Optional "LIMIT" clause to limit the number of rows returned. */
  limit?: number;
  /** Optional "OFFSET" clause. Only valid if Limit is also present. */
  offset?: number;
  /** Bindings for parameterized values.
   * @see [[ECSqlStatement.bindValues]]
   */
  bindings?: any[] | object;
}

/** The primitive types of an Entity property.
 * @beta
 */
export enum PrimitiveTypeCode {
  Uninitialized = 0x00,
  Binary = 0x101,
  Boolean = 0x201,
  DateTime = 0x301,
  Double = 0x401,
  Integer = 0x501,
  Long = 0x601,
  Point2d = 0x701, // eslint-disable-line @typescript-eslint/no-shadow
  Point3d = 0x801, // eslint-disable-line @typescript-eslint/no-shadow
  String = 0x901,
  IGeometry = 0xa01, // Used for Bentley.Geometry.Common.IGeometry types
}

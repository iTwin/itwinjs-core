/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module WireFormats */

import { Id64Props } from "@bentley/bentleyjs-core";

/** The properties of an [Entity]($backend) as they are read/stored from/to the iModel. */
export interface EntityProps {
  /** The full name of the [ECClass]($docs/bis/intro/glossary/#ecclass) for this entity, in the form "Schema:ClassName" */
  classFullName: string;
  /** The Id of the entity. Must be present for SELECT, UPDATE, or DELETE, ignored for INSERT. */
  id?: Id64Props;
  /**
   * If this Entity is *not* from the `BisCore` schema, the name of the highest level (leaf-most)
   * class *in the BisCore schema* for this entity. If the entity is an instance of a class in the BisCore schema
   * this will be the same class name as in `classFullName`. This can be helpful to classify entities on the
   * front end where the class hierarchy is not available.
   */
  bisBaseClass?: string;

  [propName: string]: any;
}

/** Parameters for performing an ECSQL SELECT query on [Entity]($backend) classes. */
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
}

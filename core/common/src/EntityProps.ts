/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module Schemas */

import { Id64Props } from "@bentley/bentleyjs-core";

/** The properties of a BIS Entity as they are read/stored from/to the database. */
export interface EntityProps {
  /** The full name of the EC Class for this entity. Must be in the form "Schema:ClassName" */
  classFullName: string;
  /** The id of the entity. Must be present for SELECT, UPDATE, or DELETE, ignored for INSERT. */
  id?: Id64Props;
  [propName: string]: any;
}

/** Parameters for performing an ECSQL SELECT query on BIS entity classes. */
export interface EntityQueryParams {
  /** The sql className, in the form "Schema.ClassName", of the class to search. */
  from?: string;
  /** Set to true to limit results to *not* include sub-classes of "from" class */
  only?: boolean;
  /** Optional "WHERE" clause to filter entities. Note: do *not* include the "WHERE" keyword. */
  where?: string;
  /** Optional "ORDERBY" clause to sort results. Note: do *not* include the "ORDERBY" keyword. */
  orderBy?: string;
  /** Optional "LIMIT" clause to limit the number or rows returned. */
  limit?: number;
  /** Optional "OFFSET" clause. Only valid if Limit is also present. */
  offset?: number;
}

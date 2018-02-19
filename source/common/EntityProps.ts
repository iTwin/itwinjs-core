/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { Id64Props } from "@bentley/bentleyjs-core/lib/Id";

/** The properties to create an Entity. Every Entity must have the full name of the class that defines it. */
export interface EntityProps {
  classFullName: string;
  [propName: string]: any;
  id?: Id64Props;
}

/** Parameters for performing an ECSQL SELECT query on entity classes. */
export interface EntityQueryParams {
  /** the classFullName of the class to search. */
  from?: string;
  /** set to true to limit results to *not* include sub-classes of "from" class */
  only?: boolean;
  /** optional "WHERE" clause to filter entities. Note: do *not* include the "WHERE" keyword. */
  where?: string;
  /** optional "ORDERBY" clause to sort results. Note: do *not* include the "ORDERBY" keyword. */
  orderBy?: string;
  /** optional "LIMIT" clause to limit the number or rows returned. */
  limit?: number;
  /** optional "OFFSET" clause. Only valid if Limit is also present. */
  offset?: number;
}

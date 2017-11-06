/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

/** The properties to create an Entity. Every Entity must have the full name of the class that defines it. */
export interface EntityProps {
  classFullName: string;
  [propName: string]: any;
}

/** Interface for capturing input to query functions. */
export interface EntityQueryParams {
  from: string;
  where?: string;
  orderBy?: string;
  limit: number;
  offset: number;
}

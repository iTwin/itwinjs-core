/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ITwinRegistry
 */

import { AccessToken } from "@itwin/core-bentley";

/** The iTwin context object, for generalized properties of Projects, Assets, custom contexts, etc.
 * @beta
 */
export interface ITwin {
  name?: string;
  id: string;
  code?: string;
}

/** Argument for methods that may take pagination
 * @beta
*/
export interface ITwinPaginationArg {
  top?: number;
  skip?: number;
}

/** Set of properties that can be searched
 * @beta
*/
export enum ITwinSearchableProperty {
  Name = "name",
}

/** Argument for methods that may take searching
 * @beta
*/
export interface ITwinSearchArg {
  searchString: string;
  propertyName: ITwinSearchableProperty;
  exactMatch: boolean;
}

/** Set of optional arguments used for methods that allow advanced queries
 * @beta
 */
export interface ITwinQueryArg {
  pagination?: ITwinPaginationArg;
  search?: ITwinSearchArg;
}

/** Methods for accessing iTwins
 * @beta
*/
export interface ITwinAccess {
  /** Get iTwins associated with the requester */
  getAll(accessToken: AccessToken, arg?: ITwinQueryArg): Promise<ITwin[]>;
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ContextRegistry
 */

import { AuthorizedClientRequestContext } from "@bentley/itwin-client";

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
export interface ITwinQueryArg {
  top?: number;
  skip?: number;
}

/** Methods for accessing iTwins
 * @beta
*/
export interface ITwinAccess {
  /** Get iTwins associated with the requester */
  getAll: (requestContext: AuthorizedClientRequestContext, queryOptions?: ITwinQueryArg) => Promise<ITwin[]>;
  /** Get all iTWins with the exact name */
  getAllByName: (requestContext: AuthorizedClientRequestContext, name: string) => Promise<ITwin[]>;
  /** Get favorited iTwins associated with the requester */
  getFavorites: (requestContext: AuthorizedClientRequestContext, queryOptions?: ITwinQueryArg) => Promise<ITwin[]>;
  /** Get recently used iTwins associated with the requester */
  getRecentlyUsed: (requestContext: AuthorizedClientRequestContext, queryOptions?: ITwinQueryArg) => Promise<ITwin[]>;
  /** Get an iTwin with exact id */
  getById: (requestContext: AuthorizedClientRequestContext, id: string) => Promise<ITwin>;
}

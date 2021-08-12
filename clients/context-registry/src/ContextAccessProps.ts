/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * SWB NOTE: Change module name?
 * @module ContextRegistryNTBD
 */

import { AuthorizedClientRequestContext } from "@bentley/itwin-client";

/** The iTwin context object, includes Projects, Assets, and custom contexts
 * @beta
 */
export interface ITwin {
  name?: string;
  // SWB NOTE: Should this be GuidString?
  id: string;
  // SWB NOTE: Maybe change to iTwinCode, since it is not required to be a number?
  iTwinNumber?: string;
}

/** Methods for accessing context containers
 * @beta
*/
// SWB NOTE: Rename?
export interface ContextRegistryNTBD {
  /** Get all containers associated */
  // SWB NOTE: API features unaccounted for: paging, search by iTwinNumber, get favorites, get recently used
  // SWB NOTE: For pagination example look at ui\framework\src\ui-framework\clientservices\DefaultProjectServices.ts ln 43

  getContextContainers: (requestContext: AuthorizedClientRequestContext) => Promise<ITwin[]>;
  /** Get a container by name */
  getContextContainerByName: (requestContext: AuthorizedClientRequestContext, name: string) => Promise<ITwin>;
  /** Get a container by id */
  // SWB NOTE: Used only once, Candidate for deletion
  getContextContainerById: (requestContext: AuthorizedClientRequestContext, id: string) => Promise<ITwin>;
  // /** Get set of containers with names containing the search string, case insensitive */
  // // SWB NOTE: Unused, candidate for deletion
  // getContextContainersByNameSubstring: (requestContext: AuthorizedClientRequestContext, searchString: string) => Promise<ITwin[]>;
}

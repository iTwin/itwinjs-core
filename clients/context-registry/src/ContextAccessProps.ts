/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * SWB NOTE: Change module name?
 * @module ContextRegistryNTBD
 */

import { AuthorizedClientRequestContext } from "@bentley/itwin-client";

/** The iTwin context container
 * @beta
 */
// SWB NOTE: Name To Be Determined
export interface ContextContainerNTBD {
  name?: string;
  id: string;
  // SWB NOTE: Maybe change to containerCode, since it is not required to be a number?
  containerNumber?: string;
}

/** Methods for accessing context containers
 * @beta
*/
// SWB NOTE: Rename?
export interface ContextRegistryNTBD {
  /** Get all containers associated */
  // SWB NOTE: API features unaccounted for: paging, search by containerNumber, get favorites, get recently used
  // SWB NOTE: For pagination example look at ui\framework\src\ui-framework\clientservices\DefaultProjectServices.ts ln 43

  getContextContainers: (requestContext: AuthorizedClientRequestContext) => Promise<ContextContainerNTBD[]>;
  /** Get a container by name */
  getContextContainerByName: (requestContext: AuthorizedClientRequestContext, name: string) => Promise<ContextContainerNTBD>;
  /** Get a container by id */
  getContextContainerById: (requestContext: AuthorizedClientRequestContext, id: string) => Promise<ContextContainerNTBD>;
  /** Get set of containers with names containing the search string, case insensitive */
  getContextContainersByNameSubstring: (requestContext: AuthorizedClientRequestContext, searchString: string) => Promise<ContextContainerNTBD[]>;
}

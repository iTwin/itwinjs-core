/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ContextRegistry
 */

import { AuthorizedClientRequestContext } from "@bentley/itwin-client";

/** The iTwin context container
 * @beta
 */
export interface ContextContainer {
  name: string;
  id: string;
  containerNumber: string;
}

/** Methods for accessing context containers
 * @beta
*/
export interface ContextRegistry {
  /** Get all containers associated */
  getContextContainers: (requestContext: AuthorizedClientRequestContext) => Promise<ContextContainer[]>;
  /** Get a container by name */
  getContextContainerByName: (requestContext: AuthorizedClientRequestContext, name: string) => Promise<ContextContainer>;
  /** Get a container by id */
  getContextContainerById: (requestContext: AuthorizedClientRequestContext, id: string) => Promise<ContextContainer>;
  /** Get set of containers with matching regex pattern in the name */
  getContextContainersByNamePattern: (requestContext: AuthorizedClientRequestContext, pattern: string) => Promise<ContextContainer[]>;
}

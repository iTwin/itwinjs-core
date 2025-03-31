/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */
/** @packageDocumentation
 * @module Internal
 */

function sym(name: string): string {
  return `${name}_presentation-frontend_INTERNAL_ONLY_DO_NOT_USE`;
}

export const _presentation_manager_rpcRequestsHandler = Symbol.for(sym("presentation_manager_rpcRequestsHandler"));
export const _presentation_manager_ipcRequestsHandler = Symbol.for(sym("presentation_manager_ipcRequestsHandler"));

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */

function sym(name: string): string {
  return `${name}_presentation-backend_INTERNAL_ONLY_DO_NOT_USE`;
}

export const _presentation_manager_detail = Symbol.for(sym("presentation_manager_detail"));

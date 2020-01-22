/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import { UiError as Abstract_UiError } from "@bentley/ui-abstract";

/** iModel.js UI UiError class is a subclass of BentleyError. Errors are logged.
 * Deprecated - use UiError in bentley/ui-abstract instead.
 * @public
 * @deprecated - use UiError in bentley/ui-abstract instead
 */
export const UiError = Abstract_UiError;      // tslint:disable-line: variable-name

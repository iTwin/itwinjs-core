/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

import { UiError as Abstract_UiError } from "@bentley/ui-abstract";

/** iModel.js UI UiError class is a subclass of BentleyError. Errors are logged.
 * Deprecated - use UiError in bentley/ui-abstract instead.
 * @public
 * @deprecated - use UiError in bentley/ui-abstract instead
 */
export const UiError = Abstract_UiError;      // tslint:disable-line: variable-name

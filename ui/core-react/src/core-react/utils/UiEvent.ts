/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import { BeUiEvent } from "@itwin/core-bentley";

/** iModel.js UI UiEvent class is a subclass of BeEvent with argument type safety.
 * @public
 */
export class UiEvent<TEventArgs> extends BeUiEvent<TEventArgs> { }

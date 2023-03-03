/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import * as path from "path";

/**
 * Path to presentation-backend assets root directory.
 * @internal
 */
// istanbul ignore next
export const PRESENTATION_BACKEND_ASSETS_ROOT = (-1 !== __dirname.indexOf("presentation-backend")) ? path.join(__dirname, "../assets") : path.join(__dirname, "assets");

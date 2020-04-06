/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import * as path from "path";
import { PRESENTATION_COMMON_ROOT } from "@bentley/presentation-common/lib/presentation-common/Utils";

/**
 * Path to presentation-backend assets root directory.
 * @internal
 */
// istanbul ignore next
export const PRESENTATION_BACKEND_ASSETS_ROOT = (-1 !== __dirname.indexOf("presentation-backend")) ? path.join(__dirname, "../assets") : path.join(__dirname, "assets");

/**
 * Path to presentation-common public root directory.
 * @internal
 */
// istanbul ignore next
export const PRESENTATION_COMMON_PUBLIC_ROOT = (-1 !== PRESENTATION_COMMON_ROOT.indexOf("presentation-common")) ? path.join(PRESENTATION_COMMON_ROOT, "../public") : path.join(__dirname, "assets");

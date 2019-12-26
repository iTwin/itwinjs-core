/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Models */

import { GeometricModel3d } from "../Model";

/** A container for persisting AnalyticalElement instances used to model
 * a specialized analytical perspective.
 * @beta
 */
export abstract class AnalyticalModel extends GeometricModel3d {
  /** @internal */
  public static get className(): string { return "AnalyticalModel"; }
}

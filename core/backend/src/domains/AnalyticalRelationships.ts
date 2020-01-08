/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Schema */

import { ElementRefersToElements } from "../Relationship";

/** Relates an AnalyticalElement to the SpatialLocationElement or PhysicalElement it is simulating,
 * in light of a specialized analytical perspective.
 * @beta
 */
export class AnalyticalSimulatesSpatialElement extends ElementRefersToElements {
  /** @internal */
  public static get className(): string { return "AnalyticalSimulatesSpatialElement"; }
}

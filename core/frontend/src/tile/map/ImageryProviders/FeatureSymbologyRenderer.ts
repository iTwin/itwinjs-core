/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { FeatureAttributeDrivenSymbology } from "../../internal";

/**  Defines how feature symbology is applied to a canvas
* @internal
*/
export interface FeatureSymbologyRenderer {
  isAttributeDriven(): this is FeatureAttributeDrivenSymbology;
  activeGeometryType: string;

  applyFillStyle(context: CanvasRenderingContext2D): void;
  applyStrokeStyle(context: CanvasRenderingContext2D): void;
  drawPoint(context: CanvasRenderingContext2D, ptX: number, ptY: number): void;
}

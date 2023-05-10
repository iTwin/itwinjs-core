/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Transform } from "@itwin/core-geometry";
import { ArcGisGeometryBaseRenderer } from "./ArcGisGeometryRenderer";
import { ArcGisSymbologyRenderer } from "./ArcGisSymbologyRenderer";

export class ArcGisCanvasRenderer extends ArcGisGeometryBaseRenderer {
  private _context: CanvasRenderingContext2D;
  private _symbol: ArcGisSymbologyRenderer;

  constructor(context: CanvasRenderingContext2D, symbol: ArcGisSymbologyRenderer, world2PixelTransform?: Transform) {
    super(world2PixelTransform);
    this._symbol = symbol;
    this._context = context;
  }

  protected beginPath() {
    this._context.beginPath();
  }

  protected closePath() {
    this._context.closePath();
  }

  protected lineTo(x: number, y: number) {
    this._context.lineTo(x, y);
  }

  protected moveTo(x: number, y: number) {
    this._context.moveTo(x, y);
  }

  protected async fill() {
    this._symbol.applyFillStyle(this._context);
    this._context.fill();
  }

  protected async stroke() {
    this._symbol.applyStrokeStyle(this._context);
    this._context.stroke();
  }

  protected async finishPoints() {
  }

  protected async drawPoint(x: number, y: number) {
    this._symbol.drawPoint(this._context, x, y);
  }

}

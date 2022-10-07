/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Transform } from "@itwin/core-geometry";
import { ArcGisSymbologyRenderer } from "./ArcGisSymbologyRenderer";

export class ArcGisFeatureRenderer  {
  private _symbol: ArcGisSymbologyRenderer;
  private _transform: Transform|undefined;
  private _context: CanvasRenderingContext2D;

  constructor(context: CanvasRenderingContext2D, symbol: ArcGisSymbologyRenderer, world2PixelTransform?: Transform) {

    this._symbol = symbol;
    this._context = context;
    this._transform = world2PixelTransform;

  }

  // Utility functions to make ease testing.
  private closePath() {
    this._context.closePath();
  }

  private lineTo(x: number, y: number) {
    this._context.lineTo(x,y);
  }

  private moveTo(x: number, y: number) {
    this._context.moveTo(x,y);
  }

  private fill() {
    this._context.fill();
  }

  private stroke() {
    this._context.stroke();
  }

  public renderPathFeature(geometryLengths: number[], geometryCoords: number[], fill: boolean, stride: number) {
    // Keep track of our position in the in the 'coords' array:
    // Every time we loop on the 'lengths' array, the position
    // to start reading vertices in the 'coords' must be the sum of all previously read vertices.
    let coordsOffset = 0;

    // Begin the path here.
    // Note: Even though path is closed inside the 'geometryLengths' loop,
    //       it's import to begin the path only once.
    this._context.beginPath();
    for (const vertexCount of geometryLengths) {
      let lastPtX = 0, lastPtY = 0;
      for (let vertexIdx=0 ; vertexIdx <vertexCount; vertexIdx++) {
        const pX = geometryCoords[coordsOffset+(vertexIdx*stride)];
        const pY = geometryCoords[coordsOffset+(vertexIdx*stride)+1];
        if (vertexIdx === 0) {
          // first vertex is always "absolute" and must be drawn as 'moveTo' (i.e. not lineTo)
          if (this._transform) {
            const transformedPoint = this._transform.multiplyPoint2d({x: pX, y:pY});
            this.moveTo(transformedPoint.x, transformedPoint.y);
          } else {
            this.moveTo(pX, pY);
            lastPtX = pX;
            lastPtY = pY;
          }
        } else {

          // console.log (`this._context.moveTo(${lastPtX}, ${lastPtY});`);
          if (this._transform) {
            const transformedPoint = this._transform.multiplyPoint2d({x: pX, y:pY});
            this.lineTo(transformedPoint.x, transformedPoint.y);
          } else {
            // Following vertices are relative to the previous one (sadly not really well documented by ESRI)
            // typically this happens when 'coordinates quantization' is active (i.e. no client side transformation is needed)
            lastPtX = lastPtX+pX;
            lastPtY = lastPtY+pY;
            this.lineTo(lastPtX, lastPtY);
          }
        }

      }
      coordsOffset+=stride*vertexCount;
      if (fill) {
        // ClosePath but do not 'fill' here, only at the very end (otherwise it will mess up holes)
        this.closePath();
      }
    }

    if (fill) {
      this._symbol.applyFillStyle(this._context);
      this.fill();
    }

    this._symbol.applyStrokeStyle(this._context);
    this.stroke();  // draw line path or polygon outline
  }

  public renderPointFeature(geometryLengths: number[], geometryCoords: number[], stride: number)  {
    let coordsOffset = 0;
    if (geometryLengths.length === 0) {
      // Strangely, for points, 'lengths' array is empty, so we assume there is a single vertex in 'coords' array.
      if (geometryCoords.length >= stride) {

        if (this._transform) {
          const transformedPoint = this._transform.multiplyPoint2d({x: geometryCoords[0], y:geometryCoords[1]});
          this._symbol.drawPoint(this._context, transformedPoint.x, transformedPoint.y);
        } else {
          this._symbol.drawPoint(this._context, geometryCoords[0], geometryCoords[1]);
        }
      }
    } else {
      // MULTI-POINTS: Needs testing
      // I assume 'lengths' array will get populated and 'coords' array will look similar to line/polygons.
      for (const vertexCount of geometryLengths) {
        let lastPtX = 0, lastPtY = 0;
        for (let vertexIdx=0 ; vertexIdx <vertexCount; vertexIdx++) {
          const pX = geometryCoords[coordsOffset+(vertexIdx*2)];
          const pY = geometryCoords[coordsOffset+(vertexIdx*2)+1];
          lastPtX = (vertexIdx === 0) ? pX : lastPtX+pX;
          lastPtY = (vertexIdx === 0) ? pY : lastPtY+pY;

          if (this._transform) {
            const transformedPoint = this._transform.multiplyPoint2d({x: lastPtX, y:lastPtY});
            this._symbol.drawPoint(this._context, transformedPoint.x, transformedPoint.y);
          } else {
            this._symbol.drawPoint(this._context, lastPtX, lastPtY);
          }

        }
        coordsOffset+=stride*vertexCount;
      }
    }

  }

}

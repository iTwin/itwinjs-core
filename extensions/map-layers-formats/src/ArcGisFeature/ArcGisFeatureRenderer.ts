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

  public renderPathFeature(geometryLenths: number[], geometryCoords: number[], fill: boolean, stride: number) {
    // Keep track of our position in the in the 'coords' array:
    // Everytime we loop on the 'lengths' array, the position
    // to start reading vertices in the 'coords' must be the sum of all previously read vertices.
    let coordsOffet = 0;

    // const geometryLenths = feature.geometry.lengths;
    // const geometryCoords = feature.geometry.coords;
    // Begin the path here.
    // Note: Even though path is closed inside the 'geometryLenths' loop,
    //       it's import to begin the path only once.
    this._context.beginPath();
    // console.log ("this._context.beginPath();");
    for (const vertexCount of geometryLenths) {
      let lastPtX = 0, lastPtY = 0;
      for (let vertexIdx=0 ; vertexIdx <vertexCount; vertexIdx++) {
        const pX = geometryCoords[coordsOffet+(vertexIdx*stride)];
        const pY = geometryCoords[coordsOffet+(vertexIdx*stride)+1];
        if (vertexIdx === 0) {
          // first vertex is always "absolute" and must be drawn as 'moveTo' (i.e. not lineTo)
          // console.log (`this._context.moveTo(${pX}, ${pY});`);
          if (this._transform) {
            const transformedPoint = this._transform.multiplyPoint2d({x: pX, y:pY});
            this._context.moveTo(transformedPoint.x, transformedPoint.y);
          } else {
            this._context.moveTo(pX, pY);
            lastPtX = pX;
            lastPtY = pY;
          }
        } else {

          // console.log (`this._context.moveTo(${lastPtX}, ${lastPtY});`);
          if (this._transform) {
            const transformedPoint = this._transform.multiplyPoint2d({x: pX, y:pY});
            this._context.lineTo(transformedPoint.x, transformedPoint.y);
          } else {
            // Following vertices are relative to the previous one (sadly not really well documented by ESRI)
            // typically this happens when 'coordinates quantization' is active (i.e. no client side transformation is needed)
            lastPtX = lastPtX+pX;
            lastPtY = lastPtY+pY;
            this._context.lineTo(lastPtX, lastPtY);
          }
        }

      }
      coordsOffet+=stride*vertexCount;
      if (fill) {
        // console.log (`this._context.closePath();`);

        // ClosePath but do not 'fill' here, only at the very end (otherwise it will mess up holes)
        this._context.closePath();
      }
    }

    if (fill) {
      this._symbol.applyFillStyle(this._context);
      this._context.fill();
    }

    this._symbol.applyStrokeStyle(this._context);
    this._context.stroke();  // draw line path or polygon outline
  }

  public renderPointFeature(geometryLenths: number[], geometryCoords: number[], stride: number)  {
    let coordsOffet = 0;
    if (geometryLenths.length === 0) {
      // Strangely, for points, 'lengths' array is empty, so we assume there is a single vertex in 'coords' array.
      if (geometryCoords.length >= stride) {

        if (this._transform) {
          const transformedPoint = this._transform.multiplyPoint2d({x: geometryCoords[0], y:geometryCoords[1]});
          this._symbol.drawPoint(this._context, transformedPoint.x, transformedPoint.y);
        } else {
          this._symbol.drawPoint(this._context, geometryCoords[0], geometryCoords[1]);
        }
        /*
        if (this._transform) {
          const transformedPoint = this._transform.multiplyPoint2d({x: geometryCoords[0], y:geometryCoords[1]});
          this._context.drawImage(sampleIconImg, transformedPoint.x-iconSizeHalf, transformedPoint.y-iconSizeHalf, iconSize, iconSize);
        } else {
          this._context.drawImage(sampleIconImg, geometryCoords[0]-iconSizeHalf, geometryCoords[1]-iconSizeHalf, iconSize, iconSize);
        } */
      }
    } else {
      // MULTI-POINTS: Needs testing
      // I assume 'lenghts' array will get populated and 'coords' array will look similar to line/polygons.
      for (const vertexCount of geometryLenths) {
        let lastPtX = 0, lastPtY = 0;
        for (let vertexIdx=0 ; vertexIdx <vertexCount; vertexIdx++) {
          const pX = geometryCoords[coordsOffet+(vertexIdx*2)];
          const pY = geometryCoords[coordsOffet+(vertexIdx*2)+1];
          lastPtX = (vertexIdx === 0) ? pX : lastPtX+pX;
          lastPtY = (vertexIdx === 0) ? pY : lastPtY+pY;

          if (this._transform) {
            const transformedPoint = this._transform.multiplyPoint2d({x: lastPtX, y:lastPtY});
            this._symbol.drawPoint(this._context, transformedPoint.x, transformedPoint.y);
          } else {
            this._symbol.drawPoint(this._context, lastPtX, lastPtY);
          }

        }
        coordsOffet+=stride*vertexCount;
      }
    }

  }

}

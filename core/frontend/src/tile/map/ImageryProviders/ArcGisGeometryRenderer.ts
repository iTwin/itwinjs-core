/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Transform } from "@itwin/core-geometry";
import { ArcGisAttributeDrivenSymbology } from "../../internal";

/** Interface defining minimal implementation needed to create an ArcGIS geometry renderer,
 * that will ultimately be called by an [[ArcGisFeatureReader]] implementation.
 * @internal
 */
export interface ArcGisGeometryRenderer {
  transform: Transform | undefined;
  attributeSymbology?: ArcGisAttributeDrivenSymbology;
  renderPath(geometryLengths: number[], geometryCoords: number[], fill: boolean, stride: number, relativeCoords: boolean): Promise<void>;
  renderPoint(geometryLengths: number[], geometryCoords: number[], stride: number, relativeCoords: boolean): Promise<void>;
}

/** Internal implementation of [[ArcGisGeometryRenderer]]
 * @internal
 */
export abstract class ArcGisGeometryBaseRenderer implements ArcGisGeometryRenderer {
  private _transform: Transform | undefined;

  constructor(world2PixelTransform?: Transform) {
    this._transform = world2PixelTransform;
  }
  public abstract get attributeSymbology(): ArcGisAttributeDrivenSymbology | undefined;

  public get transform() { return this._transform; }

  protected abstract beginPath(): void;
  protected abstract closePath(): void;
  protected abstract lineTo(x: number, y: number): void;
  protected abstract moveTo(x: number, y: number): void;
  protected abstract stroke(): Promise<void>;
  protected abstract fill(): Promise<void>;
  protected abstract drawPoint(x: number, y: number): void;
  protected abstract finishPoints(): Promise<void>;

  /**
   * Render a path on the renderer's context.
   * Note: Inputs are designed based on the PBF format, to avoid any data transformation.
   * @param geometryLengths  Array be used to determine the start and end of each sub-path / rings. (i.e. [5,5] =  two rings of 5 vertices)
   * @param geometryCoords Array that linearly encodes the vertices of each sub-path of a polyline / ring of a polygon
   * @param fill Indicates if the path should be filled or not.
   * @param stride Dimension of each vertices (i.e. 2 or 3.  3 could be X,Y,Z, X,YM) Currently 3rd dimension is ignored.
  */
  public async renderPath(geometryLengths: number[], geometryCoords: number[], fill: boolean, stride: number, relativeCoords: boolean) {
    if (stride < 2 || stride > 3) {
      return;
    }

    // Keep track of our position in the in the 'coords' array:
    // Every time we loop on the 'lengths' array, the position
    // to start reading vertices in the 'coords' must be the sum of all previously read vertices.
    let coordsOffset = 0;

    // Begin the path here.
    // Note: Even though path is closed inside the 'geometryLengths' loop,
    //       it's import to begin the path only once.
    this.beginPath();
    for (const vertexCount of geometryLengths) {
      let lastPtX = 0, lastPtY = 0;
      for (let vertexIdx = 0; vertexIdx < vertexCount; vertexIdx++) {
        let pX = geometryCoords[coordsOffset + (vertexIdx * stride)];
        let pY = geometryCoords[coordsOffset + (vertexIdx * stride) + 1];
        if (vertexIdx === 0) {
          // first vertex is always "absolute" and must be drawn as 'moveTo' (i.e. not lineTo)
          if (relativeCoords) {
            lastPtX = pX;
            lastPtY = pY;
          }

          if (this._transform) {
            const transformedPoint = this._transform.multiplyPoint2d({ x: pX, y: pY });
            pX = transformedPoint.x;
            pY = transformedPoint.y;
          }

          this.moveTo(pX, pY);
        } else {

          // Following vertices are relative to the previous one (sadly not really well documented by ESRI)
          // typically this happens when 'coordinates quantization' is active (i.e. no client side transformation is needed)
          if (relativeCoords) {
            pX = lastPtX = lastPtX + pX;
            pY = lastPtY = lastPtY + pY;
          }

          if (this._transform) {
            const transformedPoint = this._transform.multiplyPoint2d({ x: pX, y: pY });
            pX = transformedPoint.x;
            pY = transformedPoint.y;
          }
          this.lineTo(pX, pY);
        }

      }
      coordsOffset += stride * vertexCount;
      if (fill) {
        // ClosePath but do not 'fill' here, only at the very end (otherwise it will mess up holes)
        this.closePath();
      }
    }

    if (fill) {
      await this.fill();
    }

    await this.stroke();  // draw line path or polygon outline
  }

  /**
   * Render a point on the renderer's context.
   * Note: Inputs are designed based on the PBF format, to avoid any data transformation.
   * @param geometryLengths  Array be used to determine the start and end of each multi-point array, empty for single point.
   * @param geometryCoords Array that linearly encodes vertices.
   * @param stride Dimension of each vertices (i.e. 2 or 3.  3 could be X,Y,Z, X,YM) Currently 3rd dimension is ignored.
  */
  public async renderPoint(geometryLengths: number[], geometryCoords: number[], stride: number, relativeCoords: boolean) {

    if (stride < 2 || stride > 3) {
      return;
    }
    let coordsOffset = 0;
    if (geometryLengths.length === 0) {
      // Strangely, for points, 'lengths' array is empty, so we assume there is a single vertex in 'coords' array.
      if (geometryCoords.length >= stride) {

        if (this._transform) {
          const transformedPoint = this._transform.multiplyPoint2d({ x: geometryCoords[0], y: geometryCoords[1] });
          this.drawPoint(transformedPoint.x, transformedPoint.y);
        } else {
          this.drawPoint(geometryCoords[0], geometryCoords[1]);
        }
      }
    } else {
      // MULTI-POINTS: Needs testing
      // I assume 'lengths' array will get populated and 'coords' array will look similar to line/polygons.
      for (const vertexCount of geometryLengths) {
        let lastPtX = 0, lastPtY = 0;
        for (let vertexIdx = 0; vertexIdx < vertexCount; vertexIdx++) {
          let pX = geometryCoords[coordsOffset + (vertexIdx * stride)];
          let pY = geometryCoords[coordsOffset + (vertexIdx * stride) + 1];

          if (relativeCoords) {
            pX = lastPtX = lastPtX + pX;
            pY = lastPtY = lastPtY + pY;
          }

          if (this._transform) {
            const transformedPoint = this._transform.multiplyPoint2d({ x: pX, y: pY });
            pX = transformedPoint.x;
            pY = transformedPoint.y;
          }

          this.drawPoint(pX, pY);

        }
        coordsOffset += stride * vertexCount;
      }
    }
    await this.finishPoints();
  }
}


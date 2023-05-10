/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Transform } from "@itwin/core-geometry";

import { ArcGisGeometryRenderer } from "./ArcGisGeometryRenderer";


/** @internal */
export class ArcGisGeometryReaderJSON {
  public transform: Transform | undefined;

  public constructor() {

  }

  public async readRingsAndPaths(geometry: any, renderer: ArcGisGeometryRenderer, fill: boolean, relativeCoords: boolean) {
    let offset = 0;
    const lengths: number[] = [];
    const coords: number[] = [];

    if (geometry?.rings) {
      for (const ring of geometry?.rings) {
        offset = ArcGisGeometryReaderJSON.deflateCoordinates(ring, coords, 2, offset);
        lengths.push(ring.length);
      }
    } else if (geometry?.paths) {
      for (const path of geometry?.paths) {
        offset = ArcGisGeometryReaderJSON.deflateCoordinates(path, coords, 2, offset);
        lengths.push(path.length);
      }
    }
    await renderer.renderPath(lengths, coords, fill, 2, relativeCoords);
  }

  public async readPoints(geometry: any, renderer: ArcGisGeometryRenderer, relativeCoords: boolean) {
    if (geometry) {
      const lengths: number[] = [];
      const coords: number[] = [geometry.x, geometry.y];
      await renderer.renderPoint(lengths, coords, 2, relativeCoords);
    }
  }

  // Converts an [[x1,y1], [x2,y2], ...] to [x1,y1,x2,y2, ...]
  // stride is the number of dimensions
  // https://github.com/openlayers/openlayers/blob/7a2f87caca9ddc1912d910f56eb5637445fc11f6/src/ol/geom/flat/deflate.js#L26
  protected static deflateCoordinates(coordinates: number[][], flatCoordinates: number[], stride: number, offset: number) {
    for (let i = 0, ii = coordinates.length; i < ii; ++i) {
      const coordinate = coordinates[i];
      for (let j = 0; j < stride; ++j)
        flatCoordinates[offset++] = coordinate[j];
    }

    return offset;
  }

}

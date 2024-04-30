/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**  Converts an [[x1,y1], [x2,y2], ...] to [x1,y1,x2,y2, ...]
  *  stride is the number of dimensions
  *  https://github.com/openlayers/openlayers/blob/7a2f87caca9ddc1912d910f56eb5637445fc11f6/src/ol/geom/flat/deflate.js#L26
* @internal
*/
export function deflateCoordinates(coordinates: number[][], flatCoordinates: number[], stride: number, offset: number) {
  for (let i = 0, ii = coordinates.length; i < ii; ++i) {
    const coordinate = coordinates[i];
    for (let j = 0; j < stride; ++j)
      flatCoordinates[offset++] = coordinate[j];
  }

  return offset;
}

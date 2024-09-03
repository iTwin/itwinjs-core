/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert } from "@itwin/core-bentley";
import { ColorDef, FeatureIndexType, QParams2d, QParams3d } from "@itwin/core-common";

/** Describes a VertexTable.
 * @internal
 */
export interface VertexTable {
  /** The rectangular array of vertex data, of size width*height*numRgbaPerVertex bytes. */
  readonly data: Uint8Array;
  /** If true, positions are not quantized but instead stored as 32-bit floats.
   * [[qparams]] will still be defined; it can be used to derive the range of positions in the table.
   */
  readonly usesUnquantizedPositions?: boolean;
  /** Quantization parameters for the vertex positions encoded into the array, if the positions are quantized;
   * and for deriving the range of positions in the table, whether quantized or not.
   */
  readonly qparams: QParams3d;
  /** The number of 4-byte 'RGBA' values in each row of the array. Must be divisible by numRgbaPerVertex. */
  readonly width: number;
  /** The number of rows in the array. */
  readonly height: number;
  /** Whether or not the vertex colors contain translucent colors. */
  readonly hasTranslucency: boolean;
  /** If no color table exists, the color to use for all vertices. */
  readonly uniformColor?: ColorDef;
  /** Describes the number of features (none, one, or multiple) contained. */
  readonly featureIndexType: FeatureIndexType;
  /** If featureIndexType is 'Uniform', the feature ID associated with all vertices. */
  readonly uniformFeatureID?: number;
  /** The number of vertices in the table. Must be less than (width*height)/numRgbaPerVertex. */
  readonly numVertices: number;
  /** The number of 4-byte 'RGBA' values associated with each vertex. */
  readonly numRgbaPerVertex: number;
  /** If vertex data include texture UV coordinates, the quantization params for those coordinates. */
  readonly uvParams?: QParams2d;
}

/** @internal */
export interface Dimensions {
  width: number;
  height: number;
}

/** @internal */
export function computeDimensions(nEntries: number, nRgbaPerEntry: number, nExtraRgba: number, maxSize: number): Dimensions {
  const nRgba = nEntries * nRgbaPerEntry + nExtraRgba;

  if (nRgba < maxSize)
    return { width: nRgba, height: 1 };

  // Make roughly square to reduce unused space in last row
  let width = Math.ceil(Math.sqrt(nRgba));

  // Ensure a given entry's RGBA values all fit on the same row.
  const remainder = width % nRgbaPerEntry;
  if (0 !== remainder) {
    width += nRgbaPerEntry - remainder;
  }

  // Compute height
  let height = Math.ceil(nRgba / width);
  if (width * height < nRgba)
    ++height;

  assert(height <= maxSize);
  assert(width <= maxSize);
  assert(width * height >= nRgba);
  assert(Math.floor(height) === height);
  assert(Math.floor(width) === width);

  // Row padding should never be necessary...
  assert(0 === width % nRgbaPerEntry);

  return { width, height };
}

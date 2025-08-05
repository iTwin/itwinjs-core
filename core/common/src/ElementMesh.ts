/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import { ByteStream, Id64String } from "@itwin/core-bentley";
import { BentleyGeometryFlatBuffer, IndexedPolyface } from "@itwin/core-geometry";

/** Options used to control how [Polyface]($core-geometry)s are produced from elements by [IModelConnection.generateElementMeshes]($frontend).
 * @beta
 */
export interface ElementMeshOptions {
  /** Maximum distance from a face to the original geometry.
   * If not supplied, defaults to zero and [[angleTolerance]] will control the quality of the resulting mesh instead.
   * @see [StrokeOptions.chordTol]($core-geometry).
   */
  chordTolerance?: number;
  /** Maximum angle difference in radians for an approximated face.
   * If not supplied, defaults to PI/12 (15 degrees).
   * @see [StrokeOptions.angleTol]($core-geometry).
   */
  angleTolerance?: number;
  /** BRep features with bounding boxes smaller than this size will not generate graphics.
   * This option can be used to ignore expensive details from [BRepEntity.DataProps]($core-common)
   * like screws and screw holes.
   */
  minBRepFeatureSize?: number;
  // ###TODO? decimationTolerance?: number;
}

/** Describes a request to generate [Polyface]($core-geometry)s from an element.
 * @see [IModelConnection.generateElementMeshes]($frontend).
 * @beta
 */
export interface ElementMeshRequestProps extends ElementMeshOptions {
  /** The Id of the [GeometricElement]($backend) from which to obtain meshes. */
  source: Id64String;
}

interface Chunk {
  type: string;
  data?: Uint8Array;
}

function nextChunk(stream: ByteStream): Chunk | undefined {
  if (stream.remainingLength < 8) {
    // Consume remaining bytes.
    stream.curPos = stream.length;
    return undefined;
  }

  // Type codes are a sequence of four uppercase ASCII letters.
  const chars = [stream.readUint8(), stream.readUint8(), stream.readUint8(), stream.readUint8()];
  if (chars.some((c) => c < 65 || c > 90))
    return undefined;

  const dataLength = stream.readUint32();
  const data = dataLength > 0 ? stream.nextBytes(dataLength) : undefined;
  return {
    type: String.fromCharCode(...chars),
    data,
  };
}

/** Convert the output of [IModelConnection.generateElementMeshes]($frontend) into an array of [Polyface]($core-geometry)s.
 * @param data Encoded polyfaces obtained from [IModelConnection.generateElementMeshes]($frontend).
 * @returns a list of decoded polyfaces.
 * @beta
 */
export function readElementMeshes(data: Uint8Array): IndexedPolyface[] {
  const polyfaces: IndexedPolyface[] = [];

  const stream = ByteStream.fromUint8Array(data);
  const firstChunk = nextChunk(stream);
  if (!firstChunk || "LMSH" !== firstChunk.type)
    return polyfaces;

  while (stream.remainingLength > 0) {
    const chunk = nextChunk(stream);
    if (!chunk || chunk.type !== "PLFC" || !chunk.data)
      continue;

    try {
      const geom = BentleyGeometryFlatBuffer.bytesToGeometry(chunk.data, true);
      if (geom instanceof IndexedPolyface)
        polyfaces.push(geom);
    } catch {
      //
    }
  }

  return polyfaces;
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import { ByteStream, Id64String } from "@itwin/core-bentley";
import { BentleyGeometryFlatBuffer, IndexedPolyface } from "@itwin/core-geometry";

export interface ElementMeshOptions {
  chordTolerance?: number;
  angleTolerance?: number;
  minBRepFeatureSize?: number;
  // ###TODO? decimationTolerance?: number;
}

export interface ElementMeshRequestProps extends ElementMeshOptions {
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
  const chars = [stream.nextUint8, stream.nextUint8, stream.nextUint8, stream.nextUint8];
  if (chars.some((c) => c < 65 || c > 90))
    return undefined;

  const dataLength = stream.nextUint32;
  const data = dataLength > 0 ? stream.nextBytes(dataLength) : undefined;
  return {
    type: String.fromCharCode(...chars),
    data,
  };
}

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

    const geom = BentleyGeometryFlatBuffer.bytesToGeometry(chunk.data);
    if (geom instanceof IndexedPolyface)
      polyfaces.push(geom);
  }

  return polyfaces;
}

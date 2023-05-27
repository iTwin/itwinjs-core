/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert } from "@itwin/core-bentley";
import { ImdlEdgeVisibility } from "./ImdlSchema";
import { ImdlModel } from "./ImdlModel";
import { calculateEdgeTableParams } from "../render/primitives/EdgeParams";
import { VertexIndices } from "../render/primitives/VertexIndices";

export interface CompactEdgeParams {
  numVisibleEdges: number;
  visibility: Uint8Array;
  vertexIndices: VertexIndices;
  normalPairs?: Uint32Array;
  maxEdgeTableDimension: number;
}

interface CompactEdge {
  index0: number;
  index1: number;
  normals?: number;
}

function * visibilityIterator(visibilityFlags: Uint8Array, vertexIndices: VertexIndices, normalPairs: Uint32Array | undefined): IterableIterator<CompactEdge> {
  let bitIndex = 0;
  let flagsIndex = 0;
  let normalIndex = 0;

  const output: CompactEdge = { index0: 0, index1: 1 };
  for (let i = 0; i < vertexIndices.length; i++) {
    const visibility = (visibilityFlags[flagsIndex] >> bitIndex) & 3;
    bitIndex += 2;
    if (bitIndex == 8) {
      bitIndex = 0;
      flagsIndex++;
    }

    if (ImdlEdgeVisibility.Hidden === visibility)
      continue;

    output.index0 = vertexIndices.decodeIndex(i);
    output.index1 = vertexIndices.decodeIndex(i % 3 === 2 ? i - 2 : i + 1);
    if (ImdlEdgeVisibility.Silhouette === visibility) {
      assert(undefined !== normalPairs);
      output.normals = normalPairs[normalIndex++];
    } else {
      output.normals = undefined;
    }

    yield output;
  }
}

function setUint24(edgeTable: Uint8Array, byteIndex: number, value: number): void {
  edgeTable[byteIndex + 0] = value & 0x0000ff;
  edgeTable[byteIndex + 1] = (value & 0x00ff00) >>> 8;
  edgeTable[byteIndex + 2] = (value & 0xff0000) >>> 16;
}

function setEdge(edgeTable: Uint8Array, index: number, startPointIndex: number, endPointIndex: number): void {
  const byteIndex = index * 6;
  setUint24(edgeTable, byteIndex, startPointIndex);
  setUint24(edgeTable, byteIndex + 3, endPointIndex);
}

export function indexedEdgeParamsFromCompactEdges(compact: CompactEdgeParams): ImdlModel.IndexedEdgeParams  | undefined {
  const numSilhouettes = compact.normalPairs?.length ?? 0;
  const numTotalEdges = compact.numVisibleEdges + numSilhouettes;
  if (numTotalEdges === 0 || numTotalEdges % 3 !== 0)
    return undefined;

  // Each edge is a quad consisting of six vertices. Each vertex is an identical 24-bit index into the lookup table.
  const indices = new VertexIndices(new Uint8Array(numTotalEdges * 6 * 3));
  for (let i = 0; i < numTotalEdges; i++)
    for (let j = 0; j < 6; j++)
      indices.setNthIndex(i * 6 + j, i);

  const {width, height, silhouettePadding, silhouetteStartByteIndex} = calculateEdgeTableParams(compact.numVisibleEdges, numSilhouettes, compact.maxEdgeTableDimension);
  const edgeTable = new Uint8Array(width * height * 4);

  let curVisibleIndex = 0;
  let curSilhouetteIndex = 0;
  for (const edge of visibilityIterator(compact.visibility, compact.vertexIndices, compact.normalPairs)) {
    if (undefined === edge.normals) {
      setEdge(edgeTable, curVisibleIndex++, edge.index0, edge.index1);
    } else {
      const index = curSilhouetteIndex++;
      const byteIndex = silhouetteStartByteIndex + silhouettePadding + index * 10;
      setUint24(edgeTable, byteIndex, edge.index0);
      setUint24(edgeTable, byteIndex + 3, edge.index1);
      edgeTable[byteIndex + 6] = edge.normals & 0xff;
      edgeTable[byteIndex + 7] = (edge.normals & 0xff00) >>> 8;
      edgeTable[byteIndex + 8] = (edge.normals & 0xff0000) >>> 16;
      edgeTable[byteIndex + 9] = (edge.normals & 0xff000000) >>> 24;
    }
  }

  return {
    indices: indices.data,
    edges: {
      data: edgeTable,
      width,
      height,
      numSegments: compact.numVisibleEdges,
      silhouettePadding,
    },
  };
}

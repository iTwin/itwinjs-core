/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert } from "@itwin/core-bentley";
import { LinePixels, MeshEdge, OctEncodedNormalPair, PolylineData } from "@itwin/core-common";
import { MeshArgs, MeshArgsEdges } from "./mesh/MeshPrimitives";
import { VertexIndices } from "./VertexTable";
import { TesselatedPolyline, wantJointTriangles } from "./PolylineParams";
import { IModelApp } from "../../IModelApp";

/**
 * Describes a set of line segments representing edges of a mesh.
 * Each segment is expanded into a quad defined by two triangles.
 * The positions are adjusted in the shader to account for the edge width.
 * @internal
 */
export interface SegmentEdgeParams {
  /** The 24-bit indices of the tesselated line segment */
  readonly indices: VertexIndices;
  /**
   * For each 24-bit index, 4 bytes:
   * the 24-bit index of the vertex at the other end of the segment, followed by
   * an 8-bit 'quad index' in [0..3] indicating which point in the expanded quad the vertex represents.
   */
  readonly endPointAndQuadIndices: Uint8Array;
}

function convertPolylinesAndEdges(polylines?: PolylineData[], edges?: MeshEdge[]): SegmentEdgeParams | undefined {
  let numIndices = undefined !== edges ? edges.length : 0;
  if (undefined !== polylines)
    for (const pd of polylines)
      numIndices += (pd.vertIndices.length - 1);

  if (0 === numIndices)
    return undefined;

  numIndices *= 6;
  const indexBytes = new Uint8Array(numIndices * 3);
  const endPointAndQuadIndexBytes = new Uint8Array(numIndices * 4);

  let ndx: number = 0;
  let ndx2: number = 0;

  const addPoint = (p0: number, p1: number, quadIndex: number) => {
    VertexIndices.encodeIndex(p0, indexBytes, ndx);
    ndx += 3;
    VertexIndices.encodeIndex(p1, endPointAndQuadIndexBytes, ndx2);
    endPointAndQuadIndexBytes[ndx2 + 3] = quadIndex;
    ndx2 += 4;
  };

  if (undefined !== polylines) {
    for (const pd of polylines) {
      const num = pd.vertIndices.length - 1;
      for (let i = 0; i < num; ++i) {
        let p0 = pd.vertIndices[i];
        let p1 = pd.vertIndices[i + 1];
        if (p1 < p0) { // swap so that lower index is first.
          p0 = p1;
          p1 = pd.vertIndices[i];
        }
        addPoint(p0, p1, 0);
        addPoint(p1, p0, 2);
        addPoint(p0, p1, 1);
        addPoint(p0, p1, 1);
        addPoint(p1, p0, 2);
        addPoint(p1, p0, 3);
      }
    }
  }

  if (undefined !== edges) {
    for (const meshEdge of edges) {
      const p0 = meshEdge.indices[0];
      const p1 = meshEdge.indices[1];
      addPoint(p0, p1, 0);
      addPoint(p1, p0, 2);
      addPoint(p0, p1, 1);
      addPoint(p0, p1, 1);
      addPoint(p1, p0, 2);
      addPoint(p1, p0, 3);
    }
  }

  return {
    indices: new VertexIndices(indexBytes),
    endPointAndQuadIndices: endPointAndQuadIndexBytes,
  };
}

/**
 * A set of line segments representing edges of curved portions of a mesh.
 * Each vertex is augmented with a pair of oct-encoded normals used in the shader
 * to determine whether or not the edge should be displayed.
 * @internal
 */
export interface SilhouetteParams extends SegmentEdgeParams {
  /** Per index, 2 16-bit oct-encoded normals */
  readonly normalPairs: Uint8Array;
}

function convertSilhouettes(edges: MeshEdge[], normalPairs: OctEncodedNormalPair[]): SilhouetteParams | undefined {
  const base = convertPolylinesAndEdges(undefined, edges);
  if (undefined === base)
    return undefined;

  const normalPairBytes = new Uint8Array(normalPairs.length * 6 * 4);
  const normalPair16 = new Uint16Array(normalPairBytes.buffer);

  let ndx = 0;
  for (const pair of normalPairs) {
    for (let i = 0; i < 6; i++) {
      normalPair16[ndx++] = pair.first.value;
      normalPair16[ndx++] = pair.second.value;
    }
  }

  return {
    indices: base.indices,
    endPointAndQuadIndices: base.endPointAndQuadIndices,
    normalPairs: normalPairBytes,
  };
}

/** A lookup table of edges for a mesh. The table is partitioned such that the lower partition contains simple segment edges
 * and the upper partition contains silhouette edges. Each entry in the lower partition consists of 2 24-bit indices into
 * a [[VertexTable]] from which to obtain the endpoints of the edge. Each entry in the upper partition consists of 2 24-bit
 * vertex indices followed by two 16-bit [[OctEncodedNormal]]s.
 * If both partitions exist then one row may exist between them containing a mix of segments and silhouettes; in this case a handful
 * of padding bytes may exist between the last segment and the first silhouette.
 * @see [[IndexedEdgeParams.edges]].
 * @internal
 */
export interface EdgeTable {
  /** The rectangular lookup table. */
  readonly data: Uint8Array;
  /** Width of the table. */
  readonly width: number;
  /** Height of the table. */
  readonly height: number;
  /** The number of segments in the lower partition. */
  readonly numSegments: number;
  /** The number of padding bytes inserted between the partitions to preserve alignment of data. */
  readonly silhouettePadding: number;
}

/** Describes the edges of a surface as a lookup table. Each edge consists of six identical indices into the lookup table, forming a quad.
 * @see [[EdgeParams.indexed]].
 * @internal
 */
export interface IndexedEdgeParams {
  /** The indices into [[edges]]. */
  readonly indices: VertexIndices;
  /** The lookup table indexed by [[indices]]. */
  readonly edges: EdgeTable;
}

function buildIndexedEdges(args: MeshArgsEdges, doPolylines: boolean, maxSize: number): IndexedEdgeParams | undefined {
  const hardEdges = args.edges?.edges;
  const silhouettes = args.silhouettes;
  const polylines = doPolylines ? args.polylines?.lines : undefined;

  const numHardEdges = hardEdges?.length ?? 0;
  const numSilhouettes = silhouettes?.edges?.length ?? 0;
  const numPolylines = polylines ? polylines.reduce((count: number, pd: PolylineData) => count + Math.max(0, pd.vertIndices.length - 1), 0) : 0;
  const numSegmentEdges = numHardEdges + numPolylines;
  const numTotalEdges = numSegmentEdges + numSilhouettes;
  if (numTotalEdges === 0)
    return undefined;

  // Each edge is a quad consisting of six vertices. Each vertex is an identical 24-bit index into the lookup table.
  const indices = new VertexIndices(new Uint8Array(numTotalEdges * 6 * 3));
  for (let i = 0; i < numTotalEdges; i++)
    for (let j = 0; j < 6; j++)
      indices.setNthIndex(i * 6 + j, i);

  // Each segment edge requires 2 24-bit indices = 6 bytes = 1.5 RGBA values.
  // Each silhouette requires the same as segment edge plus 2 16-bit oct-encoded normals = 10 bytes = 2.5 RGBA values.
  let nRgbaRequired = Math.ceil(1.5 * numSegmentEdges + 2.5 * numSilhouettes);
  let dimensions;
  const silhouetteStartByteIndex = numSegmentEdges * 6;
  let silhouettePadding = 0;
  if (nRgbaRequired < maxSize) {
    dimensions = { width: nRgbaRequired, height: 1 };
  } else {
    // Make roughly square to reduce unused space in last row.
    let width = Math.ceil(Math.sqrt(nRgbaRequired));
    // Each entry's data must fit on the same row. 15 RGBA = 60 bytes = lowest common multiple of 6, 10, and 4.
    const remainder = width % 15;
    if (0 !== remainder)
      width += 15 - remainder;

    // If the table contains both segments and silhouettes, there may be one row containing a mix of the two where padding
    // is required between them.
    if (numSilhouettes > 0 && numSegmentEdges > 0) {
      const silOffset = silhouetteStartByteIndex % 60; // some multiple of 6.
      silhouettePadding = (60 - silOffset) % 10;
      nRgbaRequired += Math.ceil(silhouettePadding / 4);
    }

    let height = Math.ceil(nRgbaRequired / width);
    if (width * height < nRgbaRequired)
      height++;

    dimensions = { width, height };
  }

  const data = new Uint8Array(dimensions.width * dimensions.height * 4);
  function setUint24(byteIndex: number, value: number): void {
    data[byteIndex + 0] = value & 0x0000ff;
    data[byteIndex + 1] = (value & 0x00ff00) >>> 8;
    data[byteIndex + 2] = (value & 0xff0000) >>> 16;
  }

  function setEdge(index: number, startPointIndex: number, endPointIndex: number): void {
    const byteIndex = index * 6;
    setUint24(byteIndex, startPointIndex);
    setUint24(byteIndex + 3, endPointIndex);
  }

  let curIndex = 0;
  if (hardEdges)
    for (const edge of hardEdges)
      setEdge(curIndex++, edge.indices[0], edge.indices[1]);

  if (polylines) {
    for (const pd of polylines) {
      const num = pd.vertIndices.length - 1;
      for (let i = 0; i < num; i++) {
        const p0 = pd.vertIndices[i];
        const p1 = pd.vertIndices[i + 1];
        // Ensure lower index is first.
        if (p0 < p1)
          setEdge(curIndex++, p0, p1);
        else
          setEdge(curIndex++, p1, p0);
      }
    }
  }

  if (silhouettes?.edges) {
    assert(undefined !== silhouettes.normals);
    assert(silhouettes.normals.length === silhouettes.edges.length);
    function setSilhouette(index: number, start: number, end: number, normals: OctEncodedNormalPair): void {
      const byteIndex = silhouetteStartByteIndex + silhouettePadding + index * 10;
      setUint24(byteIndex, start);
      setUint24(byteIndex + 3, end);
      data[byteIndex + 6] = normals.first.value & 0xff;
      data[byteIndex + 7] = (normals.first.value & 0xff00) >>> 8;
      data[byteIndex + 8] = normals.second.value & 0xff;
      data[byteIndex + 9] = (normals.second.value & 0xff00) >>> 8;
    }

    curIndex = 0;
    for (let i = 0; i < silhouettes.edges.length; i++)
      setSilhouette(curIndex++, silhouettes.edges[i].indices[0], silhouettes.edges[i].indices[1], silhouettes.normals[i]);
  }

  return {
    indices,
    edges: {
      data,
      width: dimensions.width,
      height: dimensions.height,
      numSegments: numSegmentEdges,
      silhouettePadding,
    },
  };
}

/** Describes the edges of a mesh. */
export interface EdgeParams {
  /** The edge width in pixels. */
  readonly weight: number;
  /** The line pattern in which edges are drawn. */
  readonly linePixels: LinePixels;
  /** Simple single-segment edges, always displayed when edge display is enabled. */
  readonly segments?: SegmentEdgeParams;
  /** Single-segment edges of curved surfaces, displayed based on edge normal relative to eye. */
  readonly silhouettes?: SilhouetteParams;
  /** Polyline edges, always displayed when edge display is enabled. */
  readonly polylines?: TesselatedPolyline;
  /** Silhouettes and simple-segment edges, compactly represented as indices into a lookup table. */
  readonly indexed?: IndexedEdgeParams;
}

/** @internal */
export namespace EdgeParams {
  export function fromMeshArgs(meshArgs: MeshArgs, maxWidth?: number): EdgeParams | undefined {
    const args = meshArgs.edges;
    const doJoints = wantJointTriangles(args.width, meshArgs.is2d);
    const polylines = doJoints ? TesselatedPolyline.fromMesh(meshArgs) : undefined;

    let segments: SegmentEdgeParams | undefined;
    let silhouettes: SilhouetteParams | undefined;
    let indexed: IndexedEdgeParams | undefined;

    if (IModelApp.tileAdmin.enableIndexedEdges) {
      indexed = buildIndexedEdges(args, !doJoints, maxWidth ?? IModelApp.renderSystem.maxTextureSize);
    } else {
      segments = convertPolylinesAndEdges(undefined, args.edges.edges);
      silhouettes = args.silhouettes.edges && args.silhouettes.normals ? convertSilhouettes(args.silhouettes.edges, args.silhouettes.normals) : undefined;
    }

    if (!segments && !silhouettes && !polylines && !indexed)
      return undefined;

    return {
      weight: args.width,
      linePixels: args.linePixels,
      segments,
      silhouettes,
      polylines,
      indexed,
    };
  }
}

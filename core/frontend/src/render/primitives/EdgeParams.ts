/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { LinePixels, MeshEdge, OctEncodedNormalPair, PolylineData } from "@itwin/core-common";
import { MeshArgs, MeshArgsEdges } from "./mesh/MeshPrimitives";
import { computeDimensions, VertexIndices } from "./VertexTable";
import { TesselatedPolyline, wantJointTriangles } from "./PolylineParams";

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

export interface EdgeTable {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
}

export interface IndexedEdgeParams {
  readonly indices: VertexIndices;
  readonly edges: EdgeTable;
}

function buildIndexedEdges(args: MeshArgsEdges, doPolylines: boolean): IndexedEdgeParams | undefined {
  // ###TODO: Partition table between hard edges and silhouette edges. For now, treat everything as a hard edge.
  const hardEdges = args.edges?.edges;
  const silhouettes = args.silhouettes;
  const polylines = doPolylines ? args.polylines?.lines : undefined;

  const numHardEdges = hardEdges?.length ?? 0;
  const numSilhouettes = silhouettes?.edges?.length ?? 0;
  const numPolylines = polylines ? polylines.reduce((count: number, pd: PolylineData) => count + Math.max(0, pd.vertIndices.length - 1), 0) : 0;
  const numTotalEdges = numHardEdges + numSilhouettes + numPolylines;
  if (numTotalEdges === 0)
    return undefined;

  // Each edge is a quad consisting of six vertices. Each vertex is an identical 24-bit index into the lookup table.
  const indices = new VertexIndices(new Uint8Array(numTotalEdges * 6 * 3));
  for (let i = 0; i < numTotalEdges; i++)
    for (let j = 0; j < 6; j++)
      indices.setNthIndex(i * 6 + j, i);

  // ###TODO tightly pack edge data. For now allocate 2 RGBA values per edge.
  const numRgbaPerEdge = 2;
  const dimensions = computeDimensions(numTotalEdges, numRgbaPerEdge, 0);
  const data = new Uint8Array(dimensions.width * dimensions.height * 4);
  const view = new DataView(data.buffer);
  function setEdge(index: number, startPointIndex: number, endPointIndex: number): void {
    const byteIndex = index * 8;
    view.setUint32(byteIndex, startPointIndex, true);
    view.setUint32(byteIndex + 3, endPointIndex, true);
  }

  let curIndex = 0;
  if (hardEdges)
    for (const edge of hardEdges)
      setEdge(curIndex++, edge.indices[0], edge.indices[1]);

  if (polylines) {
    for (const pd of polylines) {
      const num = pd.vertIndices.length - 1;
      for (let i = 0; i < num; i++) {
        let p0 = pd.vertIndices[i];
        let p1 = pd.vertIndices[i + 1];
        // Ensure lower index is first.
        if (p0 < p1)
          setEdge(curIndex++, p0, p1);
        else
          setEdge(curIndex++, p1, p0);
      }
    }
  }

  if (silhouettes?.edges) {
    // ##TODO normals
    for (const silhouette of silhouettes.edges)
      setEdge(curIndex++, silhouette.indices[0], silhouette.indices[1]);
  }

  return {
    indices,
    edges: {
      data,
      width: dimensions.width,
      height: dimensions.height,
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
  readonly indexed?: IndexedEdgeParams;
}

export namespace EdgeParams {
  export function fromMeshArgs(meshArgs: MeshArgs): EdgeParams | undefined {
    const args = meshArgs.edges;
    const doJoints = wantJointTriangles(args.width, meshArgs.is2d);
    const polylines = doJoints ? TesselatedPolyline.fromMesh(meshArgs) : undefined;

    let segments: SegmentEdgeParams | undefined;
    let silhouettes: SilhouetteParams | undefined;
    let indexed: IndexedEdgeParams | undefined;

    const doIndexedEdges = true; // ###TODO check TileAdmin and RenderSystem
    if (doIndexedEdges) {
      indexed = buildIndexedEdges(args, !doJoints);
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

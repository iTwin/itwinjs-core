/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { LinePixels, MeshEdge, OctEncodedNormalPair, PolylineData } from "@itwin/core-common";
import { MeshArgs } from "./mesh/MeshPrimitives";
import { VertexIndices } from "./VertexTable";
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
}

export namespace EdgeParams {
  export function fromMeshArgs(meshArgs: MeshArgs): EdgeParams | undefined {
    const args = meshArgs.edges;
    if (undefined === args)
      return undefined;

    let polylines: TesselatedPolyline | undefined;
    let segments: SegmentEdgeParams | undefined;
    if (wantJointTriangles(args.width, meshArgs.is2d)) {
      segments = convertPolylinesAndEdges(args.polylines.lines, args.edges.edges);
    } else {
      segments = convertPolylinesAndEdges(undefined, args.edges.edges);
      polylines = TesselatedPolyline.fromMesh(meshArgs);
    }

    // ###TODO: why the heck are the edges and normals of SilhouetteEdgeArgs potentially undefined???
    const silhouettes = undefined !== args.silhouettes.edges && undefined !== args.silhouettes.normals ? convertSilhouettes(args.silhouettes.edges, args.silhouettes.normals) : undefined;
    if (undefined === segments && undefined === silhouettes && undefined === polylines)
      return undefined;

    return {
      weight: args.width,
      linePixels: args.linePixels,
      segments,
      silhouettes,
      polylines,
    };
  }
}

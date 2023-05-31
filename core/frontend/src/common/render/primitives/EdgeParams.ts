/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { LinePixels } from "@itwin/core-common";
import { VertexIndices } from "./VertexIndices";
import { TesselatedPolyline } from "./PolylineParams";

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

/** @internal */
export interface EdgeTableInfo {
  /** Width of the table. */
  readonly width: number;
  /** Height of the table. */
  readonly height: number;
  /** The number of segments in the lower partition. */
  readonly silhouettePadding: number;
  /** The starting byte index of silhouettes */
  readonly silhouetteStartByteIndex: number;
}

/** Describes the edges of a mesh.
 * @internal
 */
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
export function calculateEdgeTableParams(numSegmentEdges: number, numSilhouettes: number, maxSize: number): EdgeTableInfo {
  // Each segment edge requires 2 24-bit indices = 6 bytes = 1.5 RGBA values.
  // Each silhouette requires the same as segment edge plus 2 16-bit oct-encoded normals = 10 bytes = 2.5 RGBA values.
  let nRgbaRequired = Math.ceil(1.5 * numSegmentEdges + 2.5 * numSilhouettes);
  const silhouetteStartByteIndex = numSegmentEdges * 6;
  let silhouettePadding = 0;
  let width = nRgbaRequired;
  let height = 1;
  if (nRgbaRequired >= maxSize) {
    // Make roughly square to reduce unused space in last row.
    width = Math.ceil(Math.sqrt(nRgbaRequired));
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

    height = Math.ceil(nRgbaRequired / width);
    if (width * height < nRgbaRequired)
      height++;
  }

  return {
    width,
    height,
    silhouettePadding,
    silhouetteStartByteIndex,
  };
}

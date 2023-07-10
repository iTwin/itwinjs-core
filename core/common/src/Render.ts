/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { OctEncodedNormalPair } from "./OctEncodedNormal";

// cSpell:ignore vals

/** Describes the semantics of a [PolylineArgs]($frontend).
 * @alpha
 */
export enum PolylineTypeFlags {
  Normal = 0,      // Just an ordinary polyline
  Edge = 1 << 0, // A polyline used to define the edges of a planar region.
  Outline = 1 << 1, // Like Edge, but the edges are only displayed in wireframe mode when surface fill is undisplayed.
}

/** Flags describing a [PolylineArgs]($frontend).
 * @public
 */
export interface PolylineFlags {
  /** If `true`, the polylines are to be drawn as individual disconnected point strings instead of as connected line strings. */
  isDisjoint?: boolean;
  /** If `true`, the polylines' positions are all coplanar. */
  isPlanar?: boolean;
  /** If `true`, the polylines' positions all have the same z coordinate. */
  is2d?: boolean;
  /** Default: Normal.
   * @alpha
   */
  type?: PolylineTypeFlags;
}

/** Describes the vertex indices of a single line within a [PolylineArgs]($frontend).
 * The indices represent either a line string as a connected series of points, or a point string as a set of disconnected points, depending
 * on the [[PolylineFlags.isDisjoint]] value of [PolylineArgs.flags]($frontend).
 * @public
 */
export type PolylineIndices = number[];

/** @internal */
export class MeshPolyline {
  public readonly indices: PolylineIndices;

  public constructor(indices: PolylineIndices = []) {
    this.indices = indices.slice();
  }

  public addIndex(index: number) {
    const { indices } = this;
    if (indices.length === 0 || indices[indices.length - 1] !== index)
      indices.push(index);
  }

  public clear() { this.indices.length = 0; }
}

/** @internal */
export class MeshPolylineList extends Array<MeshPolyline> {
  constructor(...args: MeshPolyline[]) {
    super(...args);
  }
}

/** @internal */
export class MeshEdge {
  public indices = [0, 0];

  public constructor(index0?: number, index1?: number) {
    if (undefined === index0 || undefined === index1)
      return;
    if (index0 < index1) {
      this.indices[0] = index0;
      this.indices[1] = index1;
    } else {
      this.indices[0] = index1;
      this.indices[1] = index0;
    }
  }

  public compareTo(other: MeshEdge): number {
    let diff = this.indices[0] - other.indices[0];
    if (0 === diff)
      diff = this.indices[1] - other.indices[1];

    return diff;
  }
}

/** @internal */
export class MeshEdges {
  public visible: MeshEdge[] = [];
  public silhouette: MeshEdge[] = [];
  public polylines: MeshPolylineList = new MeshPolylineList();
  public silhouetteNormals: OctEncodedNormalPair[] = [];
  public constructor() { }
}

/** @internal */
export class EdgeArgs {
  public edges?: MeshEdge[];

  public init(meshEdges?: MeshEdges): boolean {
    this.clear();
    if (undefined !== meshEdges && 0 < meshEdges.visible.length)
      this.edges = meshEdges.visible;

    return this.isValid;
  }

  public clear(): void { this.edges = undefined; }
  public get isValid(): boolean { return 0 < this.numEdges; }
  public get numEdges() { return undefined !== this.edges ? this.edges.length : 0; }
}

/** @internal */
export class SilhouetteEdgeArgs extends EdgeArgs {
  public normals?: OctEncodedNormalPair[];

  public override init(meshEdges?: MeshEdges) {
    this.clear();
    if (undefined !== meshEdges && 0 < meshEdges.silhouette.length) {
      this.edges = meshEdges.silhouette;
      this.normals = meshEdges.silhouetteNormals;
    }

    return this.isValid;
  }

  public override clear() {
    this.normals = undefined;
    super.clear();
  }
}

/** @internal */
export class PolylineEdgeArgs {
  public lines?: PolylineIndices[];

  public constructor(lines?: PolylineIndices[]) { this.init(lines); }

  public init(lines?: PolylineIndices[]): boolean {
    this.lines = undefined !== lines && 0 < lines.length ? lines : undefined;
    return this.isValid;
  }

  public get numLines() { return undefined !== this.lines ? this.lines.length : 0; }
  public get isValid() { return this.numLines > 0; }
  public clear() { this.lines = undefined; }
}

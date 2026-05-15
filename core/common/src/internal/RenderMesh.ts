/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { ColorDef } from "../ColorDef";
import { LinePixels } from "../LinePixels";
import { OctEncodedNormalPair } from "../OctEncodedNormal";
import { PolylineIndices } from "../RenderPolyline";

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
export type MeshPolylineList = MeshPolyline[];

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
export interface EdgeAppearanceOverrides {
  color?: ColorDef;
  linePixels?: LinePixels;
  width?: number;
}

/** @internal */
export interface MeshPolylineGroup {
  polylines: MeshPolyline[];
  appearance?: EdgeAppearanceOverrides;
}

/** @internal */
export class MeshEdges {
  public visible: MeshEdge[] = [];
  public silhouette: MeshEdge[] = [];
  public appearance?: EdgeAppearanceOverrides;
  public polylineGroups: MeshPolylineGroup[] = [];
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
  public groups?: MeshPolylineGroup[];

  public constructor(groups?: MeshPolylineGroup[]) {
    this.init(groups);
  }

  public init(groups?: MeshPolylineGroup[]): boolean {
    this.groups = groups?.filter((group) => group.polylines.length > 0);
    return this.isValid;
  }

  public get numGroups() { return this.groups?.length ?? 0; }
  public get isValid() { return this.numGroups > 0; }
  public clear() { this.groups = undefined; }
}

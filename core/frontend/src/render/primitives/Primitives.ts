/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert, SortedArray } from "@itwin/core-bentley";
import { GraphicBuilder } from "../GraphicBuilder";

/** @internal */
export namespace ToleranceRatio {
  export const vertex = 0.1;
  export const facetArea = 0.1;
}

/** Specifies under what circumstances a GeometryAccumulator should generate normals.
 * @internal
 */
export enum NormalMode {
  Never,              // Never generate normals
  Always,             // Always generate normals
  CurvedSurfacesOnly, // Generate normals only for curved surfaces
}

/** @internal */
export enum SurfacesOnly { Yes = 1, No = 0 }  // Yes indicates polylines will not be generated, only meshes.

/** @internal */
export enum PreserveOrder { Yes = 1, No = 0 } // Yes indicates primitives will not be merged, and the order in which they were added to the GraphicBuilder will be preserved.

/** @internal */
export enum GenerateEdges { Yes = 1, No = 0 } // Yes indicates edges will be generated for surfaces

/** @internal */
export class GeometryOptions {
  public readonly normals: NormalMode;
  public readonly surfaces: SurfacesOnly;
  public readonly preserveOrder: PreserveOrder;
  public readonly edges: GenerateEdges;
  constructor(edges: GenerateEdges, normals: NormalMode = NormalMode.Always, surfaces: SurfacesOnly = SurfacesOnly.No, preserveOrder: PreserveOrder = PreserveOrder.No) {
    this.normals = normals; this.surfaces = surfaces; this.preserveOrder = preserveOrder; this.edges = edges;
  }

  public get wantSurfacesOnly(): boolean { return this.surfaces === SurfacesOnly.Yes; }
  public get wantPreserveOrder(): boolean { return this.preserveOrder === PreserveOrder.Yes; }
  public get wantEdges(): boolean { return this.edges === GenerateEdges.Yes; }

  public static createForGraphicBuilder(params: GraphicBuilder, normals: NormalMode = NormalMode.Always, surfaces: SurfacesOnly = SurfacesOnly.No): GeometryOptions {
    return new GeometryOptions(params.wantEdges ? GenerateEdges.Yes : GenerateEdges.No, normals, surfaces, params.preserveOrder ? PreserveOrder.Yes : PreserveOrder.No);
  }
}

/** @internal */
export class Triangle {
  public readonly indices = new Uint32Array(3);
  public readonly visible = [true, true, true];
  public singleSided: boolean;

  public constructor(singleSided: boolean = true) { this.singleSided = singleSided; }

  public setIndices(a: number, b: number, c: number) {
    this.indices[0] = a;
    this.indices[1] = b;
    this.indices[2] = c;
  }

  public setEdgeVisibility(a: boolean, b: boolean, c: boolean) {
    this.visible[0] = a;
    this.visible[1] = b;
    this.visible[2] = c;
  }

  public isEdgeVisible(index: number) {
    assert(index < 3 && index >= 0);
    return this.visible[index];
  }

  public get isDegenerate() { return this.indices[0] === this.indices[1] || this.indices[0] === this.indices[2] || this.indices[1] === this.indices[2]; }
}

/** @internal */
export class TriangleList {
  private readonly _flags: number[] = [];
  public readonly indices: number[] = [];

  public get length(): number { return this._flags.length; }
  public get isEmpty(): boolean { return 0 === this.length; }

  public addTriangle(triangle: Triangle): void {
    let flags = triangle.singleSided ? 1 : 0;
    for (let i = 0; i < 3; i++) {
      if (triangle.isEdgeVisible(i))
        flags |= (0x0002 << i);

      this.indices.push(triangle.indices[i]);
    }

    this._flags.push(flags);
  }
  public addFromTypedArray(indices: Uint16Array | Uint32Array, flags: number = 0) {
    for (let i = 0; i < indices.length;) {
      this.indices.push(indices[i++]);
      this.indices.push(indices[i++]);
      this.indices.push(indices[i++]);
      this._flags.push(flags);
    }
  }

  public getTriangle(index: number, out?: Triangle): Triangle {
    const triangle = undefined !== out ? out : new Triangle();

    if (index > this.length) {
      assert(false);
      return new Triangle();
    }

    const flags = this._flags[index];
    triangle.singleSided = 0 !== (flags & 0x0001);

    const baseIndex = index * 3;
    for (let i = 0; i < 3; i++) {
      triangle.indices[i] = this.indices[baseIndex + i];
      triangle.visible[i] = 0 !== (flags & 0x0002 << i);
    }

    return triangle;
  }
}

/** @internal */
export class TriangleKey {
  private readonly _sortedIndices = new Uint32Array(3);

  public constructor(triangle: Triangle) {
    const index = triangle.indices;
    const sorted = this._sortedIndices;

    if (index[0] < index[1]) {
      if (index[0] < index[2]) {
        sorted[0] = index[0];
        if (index[1] < index[2]) {
          sorted[1] = index[1];
          sorted[2] = index[2];
        } else {
          sorted[1] = index[2];
          sorted[2] = index[1];
        }
      } else {
        sorted[0] = index[2];
        sorted[1] = index[0];
        sorted[2] = index[1];
      }
    } else {
      if (index[1] < index[2]) {
        sorted[0] = index[1];
        if (index[0] < index[2]) {
          sorted[1] = index[0];
          sorted[2] = index[2];
        } else {
          sorted[1] = index[2];
          sorted[2] = index[0];
        }
      } else {
        sorted[0] = index[2];
        sorted[1] = index[1];
        sorted[2] = index[0];
      }
    }

    assert(sorted[0] < sorted[1]);
    assert(sorted[1] < sorted[2]);
  }

  public compare(rhs: TriangleKey): number {
    let diff = 0;
    for (let i = 0; i < 3; i++) {
      diff = this._sortedIndices[i] - rhs._sortedIndices[i];
      if (0 !== diff)
        break;
    }

    return diff;
  }
}

/** @internal */
export class TriangleSet extends SortedArray<TriangleKey> {
  public constructor() {
    super((lhs: TriangleKey, rhs: TriangleKey) => lhs.compare(rhs));
  }
  public insertKey(triangle: Triangle, onInsert: (triangleKey: TriangleKey) => any): number {
    return this.insert(new TriangleKey(triangle), onInsert);
  }
}

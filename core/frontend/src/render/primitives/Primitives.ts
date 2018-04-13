/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core";
import { MeshEdgeFlags } from "@bentley/imodeljs-common";
import { GraphicBuilderCreateParams } from "../GraphicBuilder";

export class ToleranceRatio {
  public static vertex = 0.1;
  public static facetArea = 0.1;
}
// Specifies under what circumstances a GeometryAccumulator should generate normals.
export const enum NormalMode {
    Never,              // Never generate normals
    Always,             // Always generate normals
    CurvedSurfacesOnly, // Generate normals only for curved surfaces
}
export const enum SurfacesOnly { Yes = 1, No = 0 }  // Yes indicates polylines will not be generated, only meshes.
export const enum PreserveOrder { Yes = 1, No = 0 } // Yes indicates primitives will not be merged, and the order in which they were added to the GraphicBuilder will be preserved.
export const enum GenerateEdges { Yes = 1, No = 0 } // Yes indicates edges will be generated for surfaces
export const enum ComparePurpose {
  Merge,  // ignores category, subcategory, class, and considers colors equivalent if both have or both lack transparency
  Strict,  // compares all members
}

export class GeometryOptions {
  public get wantSurfacesOnly(): boolean { return this.surfaces === SurfacesOnly.Yes; }
  public get wantPreserveOrder(): boolean { return this.preserveOrder === PreserveOrder.Yes; }
  public get wantEdges(): boolean { return this.edges === GenerateEdges.Yes; }
  constructor(public readonly normals: NormalMode = NormalMode.Always,
              public readonly surfaces: SurfacesOnly = SurfacesOnly.No,
              public readonly preserveOrder: PreserveOrder = PreserveOrder.No,
              public readonly edges: GenerateEdges = GenerateEdges.Yes) {}
  public static fromGraphicBuilderCreateParams(params: GraphicBuilderCreateParams, normals: NormalMode = NormalMode.Always, surfaces: SurfacesOnly = SurfacesOnly.No): GeometryOptions {
    return new GeometryOptions(normals, surfaces, (params.isOverlay || params.isViewBackground) ? PreserveOrder.Yes : PreserveOrder.No, params.isSceneGraphic ? GenerateEdges.Yes : GenerateEdges.No);
  }
}

export class Triangle {
  public indices: [number, number, number] = [0, 0, 0];
  public edgeFlags: [number, number, number] = [0, 0, 0];
  public constructor(public singleSided = true, indicesOrA: [number, number, number] | number = 0, b?: number, c?: number) {
    this.setIndices(indicesOrA, b, c);
    this.setEdgeFlags(MeshEdgeFlags.Visible);
  }

  public setIndices(indicesOrA: [number, number, number] | number, b?: number, c?: number) {
    if (indicesOrA instanceof Array) {
      this.indices[0] = indicesOrA[0];
      this.indices[1] = indicesOrA[1];
      this.indices[2] = indicesOrA[2];
    } else {
      this.indices[0] = indicesOrA;
      this.indices[1] = b ? b : 0;
      this.indices[2] = c ? c : 0;
    }
  }
  public setEdgeFlags(visibleOrA: MeshEdgeFlags | [boolean, boolean, boolean], b?: MeshEdgeFlags, c?: MeshEdgeFlags) {
    if (visibleOrA instanceof Array) {
      this.edgeFlags[0] = visibleOrA[0] ? MeshEdgeFlags.Visible : MeshEdgeFlags.Invisible;
      this.edgeFlags[1] = visibleOrA[1] ? MeshEdgeFlags.Visible : MeshEdgeFlags.Invisible;
      this.edgeFlags[2] = visibleOrA[2] ? MeshEdgeFlags.Visible : MeshEdgeFlags.Invisible;
    } else {
      this.edgeFlags[0] = visibleOrA;
      this.edgeFlags[1] = b ? b : visibleOrA;
      this.edgeFlags[2] = c ? c : visibleOrA;
    }
  }
  public getEdgeVisible(index: number) { assert(index < 3); if (index > 2) { index = 2; } return this.edgeFlags[index] === MeshEdgeFlags.Visible; }
  public isDegenerate() { return this.indices[0] === this.indices[1] || this.indices[0] === this.indices[2] || this.indices[1] === this.indices[2]; }
}

export class TriangleList {
  public flags: number[] = [];
  public indices: number[] = [];

  public count(): number { return this.indices.length / 3; }
  public empty() { return this.indices.length === 0; }
  public addTriangle(triangle: Triangle): void {
    let flags = triangle.singleSided ? 1 : 0;
    for (let i = 0; i < 3; i++) {
      if (triangle.getEdgeVisible(i)) { flags |= (0x0002 << i); }
      this.indices.push(triangle.indices[i]);
    }
    this.flags.push(flags);
  }
  public getTriangle(index: number): Triangle {
    if (index > this.flags.length) {
      assert(false);
      return new Triangle();
    }
    const flags = this.flags[index];
    const triangle = new Triangle(0 !== (flags & 0x0001));
    const pIndex = this.indices.splice(index * 3);
    for (let i = 0; i < 3; i++) {
      triangle.indices[i] = pIndex[i];
      triangle.edgeFlags[i] = (0 === (flags & (0x0002 << i))) ? MeshEdgeFlags.Invisible : MeshEdgeFlags.Visible;
    }
    return triangle;
  }
}

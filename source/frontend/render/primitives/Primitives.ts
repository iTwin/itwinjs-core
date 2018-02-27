/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
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
export const enum SurfacesOnly { Yes, No }  // Yes indicates polylines will not be generated, only meshes.
export const enum PreserveOrder { Yes, No } // Yes indicates primitives will not be merged, and the order in which they were added to the GraphicBuilder will be preserved.
export const enum GenerateEdges { Yes, No } // Yes indicates edges will be generated for surfaces
export const enum ComparePurpose {
  Merge,  // ignores category, subcategory, class, and considers colors equivalent if both have or both lack transparency
  Strict,  // compares all members
}

export class GeometryOptions {
  public get wantSurfacesOnly(): boolean { return this.surfaces === SurfacesOnly.Yes; }
  public get WantPreserveOrder(): boolean { return this.preserveOrder === PreserveOrder.Yes; }
  public get WantEdges(): boolean { return this.edges === GenerateEdges.Yes; }
  constructor(public readonly normals: NormalMode = NormalMode.Always,
              public readonly surfaces: SurfacesOnly = SurfacesOnly.No,
              public readonly preserveOrder: PreserveOrder = PreserveOrder.No,
              public readonly edges: GenerateEdges = GenerateEdges.Yes) {}
  public static fromGraphicBuilderCreateParams(params: GraphicBuilderCreateParams, normals: NormalMode = NormalMode.Always, surfaces: SurfacesOnly = SurfacesOnly.No): GeometryOptions {
    return new GeometryOptions(normals, surfaces, (params.isOverlay() || params.isViewBackground()) ? PreserveOrder.Yes : PreserveOrder.No, params.isSceneGraphic() ? GenerateEdges.Yes : GenerateEdges.No);
  }
}

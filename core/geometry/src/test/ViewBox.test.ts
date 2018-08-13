/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// import { IndexedPolyface, Polyface } from "../polyface/Polyface";
// import { PolyfaceQuery } from "../polyface/PolyfaceQuery";
// import { Sample } from "../serialization/GeometrySamples";
import { IndexedPolyface } from "../polyface/Polyface";
import { PolyfaceBuilder } from "../polyface/PolyfaceBuilder";
// import { GeometryQuery } from "../curve/CurvePrimitive";
import { Point3d } from "../PointVector";
// import { RotMatrix } from "../Transform";
// import { Transform } from "../Transform";
// import { Range3d } from "../Range";
// import { SolidPrimitive } from "../solid/SolidPrimitive";
// import { LineString3d } from "../curve/LineString3d";
// import { ParityRegion, Loop } from "../curve/CurveChain";
// import { SweepContour } from "../solid/SweepContour";
// import { Checker } from "./Checker";
// import { expect } from "chai";
// import { IModelJson } from "../serialization/IModelJsonSchema";
import { GeometryCoreTestIO } from "./IModelJson.test";
// import { AxisIndex } from "../Geometry";
// import { StrokeOptions } from "../geometry-core";
// import { prettyPrint } from "./testFunctions";
/* tslint:disable:no-console */

class PointLattice {
  public xCoordinates: number[] = [];
  public yCoordinates: number[] = [];
  public zCoordinates: number[] = [];
  public wrap: boolean = false;
  // construct with given arrays.
  // xCoordinates are required
  // If yCoordinates are missing, use xCoordinates
  // If zCoordinates are missing, use yCoordinates (which may have been defaulted to xCoordinates)
  public constructor(xCoordinates: number[], yCoordinates?: number[], zCoordinates?: number[]) {
    this.xCoordinates = xCoordinates.slice();
    this.yCoordinates = yCoordinates ? yCoordinates.slice() : this.xCoordinates.slice();
    this.zCoordinates = zCoordinates ? zCoordinates.slice() : this.yCoordinates.slice();
  }
  public getPoint(i: number, j: number, k: number, result?: Point3d): Point3d {
    return Point3d.create(this.xCoordinates[i], this.yCoordinates[j], this.zCoordinates[k], result);
  }
  // consider a cube with lattice corner indices (i0,j0,k0) and (i0+1, j0+1, k0+1)
  // if any are exterior, create an IndexedPolyface with the exterior polygons.
  // REMARK tag is unused -- for future use in tagging the various meshes, e.g. as vertex/edge/face
  public createMeshOnLatticeCubeExteriorFaces(i0: number, j0: number, k0: number, tag: number): IndexedPolyface | undefined {
    if (tag === -1)   // tag is unused otherwise .. get by the compiler complaint
      return undefined;
    const builder = PolyfaceBuilder.create();
    const corners = [];
    for (const k of [k0, k0 + 1]) {
      for (const j of [j0, j0 + 1]) {
        for (const i of [i0, i0 + 1]) {
          corners.push(this.getPoint(i, j, k));
        }
      }
    }
    if (i0 === 0)
      builder.addPolygon([corners[0], corners[4], corners[6], corners[2]]);
    if (i0 + 2 === this.xCoordinates.length)
      builder.addPolygon([corners[1], corners[3], corners[7], corners[5]]);

    if (j0 === 0)
      builder.addPolygon([corners[0], corners[1], corners[5], corners[4]]);
    if (j0 + 2 === this.yCoordinates.length)
      builder.addPolygon([corners[2], corners[6], corners[7], corners[3]]);

    if (k0 === 0)
      builder.addPolygon([corners[0], corners[2], corners[3], corners[1]]);
    if (k0 + 2 === this.zCoordinates.length)
      builder.addPolygon([corners[4], corners[5], corners[7], corners[6]]);
    const polyface = builder.claimPolyface(true);
    if (polyface.facetCount > 0)
      return polyface;
    return undefined;
  }

}
describe("ViewWidget", () => {
  it("CubeGeometry", () => {
    const geometry = [];
    for (const lattice of [
      new PointLattice([0, 0.2, 0.8, 1.0]),
      new PointLattice([0, 0.4, 1.6, 2.0],
        [2, 2.2, 2.8, 3.0],
        [0, 0.1, 0.4, 0.5]),
    ]
    ) {
      // 8 corners
      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(0, 0, 0, 0)!);
      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(2, 0, 0, 1)!);
      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(0, 2, 0, 2)!);
      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(2, 2, 0, 3)!);

      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(0, 0, 2, 4)!);
      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(2, 0, 2, 5)!);
      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(0, 2, 2, 6)!);
      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(2, 2, 2, 7)!);

      // 12 edges
      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(0, 1, 0, 100)!);
      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(2, 1, 0, 101)!);
      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(0, 1, 2, 102)!);
      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(2, 1, 2, 103)!);

      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(1, 0, 0, 110)!);
      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(1, 2, 0, 111)!);
      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(1, 0, 2, 112)!);
      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(1, 2, 2, 113)!);

      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(0, 0, 1, 120)!);
      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(2, 0, 1, 121)!);
      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(0, 2, 1, 122)!);
      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(2, 2, 1, 123)!);
      // 6 faces
      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(0, 1, 1, 201)!);
      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(2, 1, 1, 202)!);
      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(1, 0, 1, 203)!);
      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(1, 2, 1, 204)!);
      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(1, 1, 0, 205)!);
      geometry.push(lattice.createMeshOnLatticeCubeExteriorFaces(1, 1, 2, 206)!);

    }
    if (geometry)
      GeometryCoreTestIO.saveGeometry(geometry, "ViewWidget", "CubeGeometry");
  });
});

/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@bentley/bentleyjs-core";
import { Point2d, Range3d } from "@bentley/geometry-core";
import { Graphic, /*TriMeshArgs, IndexedPolylineArgs,*/ OctEncodedNormalList, QPoint3dList, MeshEdgeFlags, MeshPolyline, MeshEdges } from "@bentley/imodeljs-common";
import { DisplayParams } from "./DisplayParams";
// import { IModelConnection } from "../IModelConnection";
import { ColorMap } from "./primitives/ColorMap";
// import { System } from "./System";

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

export class MeshGraphicArgs {
  // public polylineArgs: PolylineArgs;
  // public meshArgs: MeshArgs;
}

export class MeshFeatures {

}

export class MeshPrimitiveType {

}

export type PolylineList = MeshPolyline[];

export class Mesh {
  public triangles: TriangleList = new TriangleList();
  public polylines: PolylineList = [];
  public verts: QPoint3dList;
  public normals: OctEncodedNormalList = new OctEncodedNormalList();
  public uvParams: Point2d[] = [];
  public colorMap: ColorMap = new ColorMap();
  public colors: number[] = [];
  public edges = new MeshEdges();
  // public auxChannel: PolyfaceAuxChannel;

  public constructor(public displayParams: DisplayParams, public features: MeshFeatures, public type: MeshPrimitiveType, range: Range3d, public is2d: boolean, public isPlanar: boolean) {
    this.verts = new QPoint3dList(range);
  }

  public getGraphics(/*args: MeshGraphicArgs /*, system: System, iModel: IModelConnection*/ ): Graphic | undefined {
    const graphic = undefined;
    // if (this.triangles.count() !== 0) {
    //   // if (args.meshArgs.Init(this)) { graphic = system.createTriMesh(args.meshArgs, iModel); }
    // } else if (this.polylines.length !== 0 && args.polylineArgs.Init(this)) {
    //   // graphic = system.createIndexedPolylines(args.polylineArgs, iModel);
    // }
    return graphic;
  }
}

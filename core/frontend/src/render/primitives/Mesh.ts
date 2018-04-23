/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Point2d, Range3d } from "@bentley/geometry-core";
import { RenderGraphic, /*TriMeshArgs, IndexedPolylineArgs,*/ OctEncodedNormalList, QPoint3dList, MeshPolyline, MeshEdges } from "@bentley/imodeljs-common";
import { DisplayParams } from "./DisplayParams";
// import { IModelConnection } from "../IModelConnection";
import { ColorMap } from "./ColorMap";
// import { System } from "./System";
import { TriangleList } from "./Primitives";

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

  public getGraphics(/*args: MeshGraphicArgs /*, system: System, iModel: IModelConnection*/ ): RenderGraphic | undefined {
    const graphic = undefined;
    // if (this.triangles.count() !== 0) {
    //   // if (args.meshArgs.Init(this)) { graphic = system.createTriMesh(args.meshArgs, iModel); }
    // } else if (this.polylines.length !== 0 && args.polylineArgs.Init(this)) {
    //   // graphic = system.createIndexedPolylines(args.polylineArgs, iModel);
    // }
    return graphic;
  }
}

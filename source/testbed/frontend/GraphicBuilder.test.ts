/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { GraphicBuilderTileCorners } from "@bentley/imodeljs-frontend/lib/render/GraphicBuilder";
import { Point3d } from "@bentley/geometry-core/lib/PointVector";
import { Viewport } from "@bentley/imodeljs-frontend/lib/Viewport";
import { Transform } from "@bentley/geometry-core/lib/Transform";
import { GraphicBuilderCreateParams, GraphicType } from "@bentley/imodeljs-frontend/lib/render/GraphicBuilder";
import { IModelConnection } from "@bentley/imodeljs-frontend/lib/IModelConnection";
import * as path from "path";

const iModelLocation = path.join(__dirname, "../../../backend/lib/test/assets/test.bim");
const iModelLocation2 = path.join(__dirname, "../../../backend/lib/test/assets/testImodel.bim");

describe("GraphicBuilderTileCorners", () => {
  it("works as expected", () => {
    const corners = [ new Point3d(0, 1, 2), new Point3d(3, 4, 5), new Point3d(6, 7, 8), new Point3d(9, 10, 11) ];
    const tileCorners = new GraphicBuilderTileCorners([ new Point3d(0, 1, 2), new Point3d(3, 4, 5), new Point3d(6, 7, 8), new Point3d(9, 10, 11) ]);
    let key = 0;
    for (const p of tileCorners) { assert.isTrue(corners[key].isExactEqual(p)); key++; }
  });
});

describe("GraphicBuilderCreateParams", () => {
  let iModel: IModelConnection;
  let iModel2: IModelConnection;

  before(async () => {
    iModel = await IModelConnection.openStandalone(iModelLocation);
    iModel2 = await IModelConnection.openStandalone(iModelLocation2);
  });
  after(async () => {
    if (iModel) await iModel.closeStandalone();
    if (iModel2) await iModel2.closeStandalone();
  });

  it("should create a GraphicBuilderCreateParams sucessfully and use all functions", () => {
    /** Test constructors */
    const vp: Viewport = new Viewport();
    const vp2: Viewport = new Viewport();
    const tf: Transform = Transform.createIdentity();
    const tf2: Transform = Transform.createIdentity();
    tf2.multiplyXYZ(5, 10, 15);
    assert.isTrue(vp !== vp2, "constructor test 1 failed");
    assert.isTrue(tf !== tf2, "constructor test 2 failed");
    assert.isTrue(iModel !== iModel2, "constructor test 3 failed");
    let a: GraphicBuilderCreateParams = new GraphicBuilderCreateParams(tf, GraphicType.Scene, vp, iModel);
    let b: GraphicBuilderCreateParams = new GraphicBuilderCreateParams(tf2, GraphicType.ViewBackground, vp2, iModel2);
    assert.isTrue(a !== b, "constructor test 4 failed");
    assert.isTrue(a.viewport === vp, "constructor test 5 failed");
    assert.isTrue(a.placement === tf, "constructor test 6 failed");
    assert.isTrue(a.type === GraphicType.Scene, "constructor test 7 failed");
    assert.isTrue(a.iModel === iModel, "constructor test 8 failed");
    assert.isTrue(b.viewport === vp2, "constructor test 9 failed");
    assert.isTrue(b.placement === tf2, "constructor test 10 failed");
    assert.isTrue(b.type === GraphicType.ViewBackground, "constructor test 11 failed");
    assert.isTrue(b.iModel === iModel2, "constructor test 12 failed");
    a = new GraphicBuilderCreateParams(tf, GraphicType.ViewOverlay);
    assert.isTrue(a.viewport === undefined, "constructor test 13 failed");
    assert.isTrue(a.placement === tf, "constructor test 14 failed");
    assert.isTrue(a.type === GraphicType.ViewOverlay, "constructor test 15 failed");
    assert.isTrue(a.iModel === undefined, "constructor test 16 failed");
    a = new GraphicBuilderCreateParams(tf, GraphicType.ViewOverlay, vp);
    assert.isTrue(a.viewport === vp, "constructor test 17 failed");
    assert.isTrue(a.placement === tf, "constructor test 18 failed");
    assert.isTrue(a.type === GraphicType.ViewOverlay, "constructor test 19 failed");
    assert.isTrue(a.iModel === undefined, "constructor test 20 failed");

    /** Test static Scene function */
    a = GraphicBuilderCreateParams.Scene();
    assert.isTrue(a.viewport === undefined, "static Scene test 1 failed");
    assert.isTrue(a.placement.isIdentity(), "static Scene test 2 failed");
    assert.isTrue(a.type === GraphicType.Scene, "static Scene test 3 failed");
    assert.isTrue(a.iModel === undefined, "static Scene test 4 failed");
    a = GraphicBuilderCreateParams.Scene(vp);
    assert.isTrue(a.viewport === vp, "static Scene test 5 failed");
    assert.isTrue(a.placement.isIdentity(), "static Scene test 6 failed");
    assert.isTrue(a.type === GraphicType.Scene, "static Scene test 7 failed");
    assert.isTrue(a.iModel === undefined, "static Scene test 8 failed");
    a = GraphicBuilderCreateParams.Scene(undefined, tf2);
    assert.isTrue(a.viewport === undefined, "static Scene test 9 failed");
    assert.isTrue(a.placement === tf2, "static Scene test 10 failed");
    assert.isTrue(a.type === GraphicType.Scene, "static Scene test 11 failed");
    assert.isTrue(a.iModel === undefined, "static Scene test 12 failed");
    a = GraphicBuilderCreateParams.Scene(vp, tf2);
    assert.isTrue(a.viewport === vp, "static Scene test 13 failed");
    assert.isTrue(a.placement === tf2, "static Scene test 14 failed");
    assert.isTrue(a.type === GraphicType.Scene, "static Scene test 15 failed");
    assert.isTrue(a.iModel === undefined, "static Scene test 16 failed");
    a = GraphicBuilderCreateParams.Scene(undefined, undefined, iModel);
    assert.isTrue(a.viewport === undefined, "static Scene test 17 failed");
    assert.isTrue(a.placement.isIdentity(), "static Scene test 18 failed");
    assert.isTrue(a.type === GraphicType.Scene, "static Scene test 19 failed");
    assert.isTrue(a.iModel === iModel, "static Scene test 20 failed");
    a = GraphicBuilderCreateParams.Scene(vp, undefined, iModel);
    assert.isTrue(a.viewport === vp, "static Scene test 21 failed");
    assert.isTrue(a.placement.isIdentity(), "static Scene test 22 failed");
    assert.isTrue(a.type === GraphicType.Scene, "static Scene test 23 failed");
    assert.isTrue(a.iModel === iModel, "static Scene test 24 failed");
    a = GraphicBuilderCreateParams.Scene(undefined, tf2, iModel);
    assert.isTrue(a.viewport === undefined, "static Scene test 25 failed");
    assert.isTrue(a.placement === tf2, "static Scene test 26 failed");
    assert.isTrue(a.type === GraphicType.Scene, "static Scene test 27 failed");
    assert.isTrue(a.iModel === iModel, "static Scene test 28 failed");
    a = GraphicBuilderCreateParams.Scene(vp, tf2, iModel);
    assert.isTrue(a.viewport === vp, "static Scene test 29 failed");
    assert.isTrue(a.placement === tf2, "static Scene test 30 failed");
    assert.isTrue(a.type === GraphicType.Scene, "static Scene test 31 failed");
    assert.isTrue(a.iModel === iModel, "static Scene test 32 failed");

    /** Test static WorldDecoration function */
    a = GraphicBuilderCreateParams.WorldDecoration(vp);
    assert.isTrue(a.viewport === vp, "static WorldDecoration test 1 failed");
    assert.isTrue(a.placement.isIdentity(), "static WorldDecoration test 2 failed");
    assert.isTrue(a.type === GraphicType.WorldDecoration, "static WorldDecoration test 3 failed");
    assert.isTrue(a.iModel === undefined, "static WorldDecoration test 4 failed");
    a = GraphicBuilderCreateParams.WorldDecoration(vp2);
    assert.isTrue(a.viewport === vp2, "static WorldDecoration test 5 failed");
    assert.isTrue(a.placement.isIdentity(), "static WorldDecoration test 6 failed");
    assert.isTrue(a.type === GraphicType.WorldDecoration, "static WorldDecoration test 7 failed");
    assert.isTrue(a.iModel === undefined, "static WorldDecoration test 8 failed");
    a = GraphicBuilderCreateParams.WorldDecoration(vp, tf2);
    assert.isTrue(a.viewport === vp, "static WorldDecoration test 9 failed");
    assert.isTrue(a.placement === tf2, "static WorldDecoration test 10 failed");
    assert.isTrue(a.type === GraphicType.WorldDecoration, "static WorldDecoration test 11 failed");
    assert.isTrue(a.iModel === undefined, "static WorldDecoration test 12 failed");

    /** Test static WorldOverlay function */
    a = GraphicBuilderCreateParams.WorldOverlay(vp);
    assert.isTrue(a.viewport === vp, "static WorldOverlay test 1 failed");
    assert.isTrue(a.placement.isIdentity(), "static WorldOverlay test 2 failed");
    assert.isTrue(a.type === GraphicType.WorldOverlay, "static WorldOverlay test 3 failed");
    assert.isTrue(a.iModel === undefined, "static WorldOverlay test 4 failed");
    a = GraphicBuilderCreateParams.WorldOverlay(vp2);
    assert.isTrue(a.viewport === vp2, "static WorldOverlay test 5 failed");
    assert.isTrue(a.placement.isIdentity(), "static WorldOverlay test 6 failed");
    assert.isTrue(a.type === GraphicType.WorldOverlay, "static WorldOverlay test 7 failed");
    assert.isTrue(a.iModel === undefined, "static WorldOverlay test 8 failed");
    a = GraphicBuilderCreateParams.WorldOverlay(vp, tf2);
    assert.isTrue(a.viewport === vp, "static WorldOverlay test 9 failed");
    assert.isTrue(a.placement === tf2, "static WorldOverlay test 10 failed");
    assert.isTrue(a.type === GraphicType.WorldOverlay, "static WorldOverlay test 11 failed");
    assert.isTrue(a.iModel === undefined, "static WorldOverlay test 12 failed");

    /** Test static ViewOverlay function */
    a = GraphicBuilderCreateParams.ViewOverlay(vp);
    assert.isTrue(a.viewport === vp, "static ViewOverlay test 1 failed");
    assert.isTrue(a.placement.isIdentity(), "static ViewOverlay test 2 failed");
    assert.isTrue(a.type === GraphicType.ViewOverlay, "static ViewOverlay test 3 failed");
    assert.isTrue(a.iModel === undefined, "static ViewOverlay test 4 failed");
    a = GraphicBuilderCreateParams.ViewOverlay(vp2);
    assert.isTrue(a.viewport === vp2, "static ViewOverlay test 5 failed");
    assert.isTrue(a.placement.isIdentity(), "static ViewOverlay test 6 failed");
    assert.isTrue(a.type === GraphicType.ViewOverlay, "static ViewOverlay test 7 failed");
    assert.isTrue(a.iModel === undefined, "static ViewOverlay test 8 failed");
    a = GraphicBuilderCreateParams.ViewOverlay(vp, tf2);
    assert.isTrue(a.viewport === vp, "static ViewOverlay test 9 failed");
    assert.isTrue(a.placement === tf2, "static ViewOverlay test 10 failed");
    assert.isTrue(a.type === GraphicType.ViewOverlay, "static ViewOverlay test 11 failed");
    assert.isTrue(a.iModel === undefined, "static ViewOverlay test 12 failed");

    /** Test SubGraphic function */
    tf.multiplyXYZW(5, 4, 3, 2);
    a = GraphicBuilderCreateParams.Scene(vp, tf2, iModel);
    b = new GraphicBuilderCreateParams(tf, GraphicType.WorldOverlay);
    assert.isTrue(b.viewport === undefined, "SubGraphic test 1 failed");
    assert.isTrue(b.placement === tf, "SubGraphic test 2 failed");
    assert.isTrue(b.type === GraphicType.WorldOverlay, "SubGraphic test 3 failed");
    assert.isTrue(b.iModel === undefined, "SubGraphic test 4 failed");
    b = a.SubGraphic();
    assert.isTrue(b.viewport === vp, "SubGraphic test 5 failed");
    assert.isTrue(b.placement.isIdentity(), "SubGraphic test 6 failed");
    assert.isTrue(b.type === GraphicType.Scene, "SubGraphic test 7 failed");
    assert.isTrue(b.iModel === iModel, "SubGraphic test 8 failed");
    b = new GraphicBuilderCreateParams(tf2, GraphicType.WorldOverlay);
    assert.isTrue(b.viewport === undefined, "SubGraphic test 9 failed");
    assert.isTrue(b.placement === tf2, "SubGraphic test 10 failed");
    assert.isTrue(b.type === GraphicType.WorldOverlay, "SubGraphic test 11 failed");
    assert.isTrue(b.iModel === undefined, "SubGraphic test 12 failed");
    b = a.SubGraphic(tf);
    assert.isTrue(b.viewport === vp, "SubGraphic test 13 failed");
    assert.isTrue(b.placement === tf, "SubGraphic test 14 failed");
    assert.isTrue(b.type === GraphicType.Scene, "SubGraphic test 15 failed");
    assert.isTrue(b.iModel === iModel, "SubGraphic test 16 failed");

    /** Test get iModel function */
    a = GraphicBuilderCreateParams.Scene(vp, tf2, iModel);
    assert.exists(a.iModel, "get Imodel test 1 failed");
    assert.isTrue(a.iModel === iModel, "get Imodel test 2 failed");
    a = GraphicBuilderCreateParams.Scene(vp, tf2);
    assert.notExists(a.iModel, "get Imodel test 3 failed");
    assert.isTrue(a.iModel === undefined, "get Imodel test 4 failed");

    /** Test get placement function */
    a = GraphicBuilderCreateParams.Scene(vp, tf2, iModel);
    assert.exists(a.placement, "get placement test 1 failed");
    assert.isTrue(a.placement === tf2, "get placement test 2 failed");
    a = GraphicBuilderCreateParams.Scene(vp, tf);
    assert.exists(a.placement, "get placement test 3 failed");
    assert.isTrue(a.placement === tf, "get placement test 4 failed");

    /** Test get viewport function */
    a = GraphicBuilderCreateParams.Scene(vp, tf2, iModel);
    assert.exists(a.viewport, "get viewport test 1 failed");
    assert.isTrue(a.viewport === vp, "get viewport test 2 failed");
    a = GraphicBuilderCreateParams.Scene(vp2, tf);
    assert.exists(a.viewport, "get viewport test 3 failed");
    assert.isTrue(a.viewport === vp2, "get viewport test 4 failed");

    /** Test get type function */
    a = new GraphicBuilderCreateParams(tf, GraphicType.Scene);
    assert.exists(a.type, "get type test 1 failed");
    assert.isTrue(a.type === GraphicType.Scene, "get type test 2 failed");
    a = new GraphicBuilderCreateParams(tf, GraphicType.ViewBackground);
    assert.exists(a.type, "get type test 3 failed");
    assert.isTrue(a.type === GraphicType.ViewBackground, "get type test 4 failed");

    /** Test IsViewCoordinates function */
    a = new GraphicBuilderCreateParams(tf, GraphicType.ViewBackground);
    assert.isTrue(a.IsViewCoordinates(), "IsViewCoordinates test 1 failed");
    a = new GraphicBuilderCreateParams(tf, GraphicType.ViewOverlay);
    assert.isTrue(a.IsViewCoordinates(), "IsViewCoordinates test 2 failed");
    a = new GraphicBuilderCreateParams(tf, GraphicType.Scene);
    assert.isFalse(a.IsViewCoordinates(), "IsViewCoordinates test 3 failed");
    a = new GraphicBuilderCreateParams(tf, GraphicType.WorldDecoration);
    assert.isFalse(a.IsViewCoordinates(), "IsViewCoordinates test 4 failed");
    a = new GraphicBuilderCreateParams(tf, GraphicType.WorldOverlay);
    assert.isFalse(a.IsViewCoordinates(), "IsViewCoordinates test 5 failed");

    /** Test IsWorldCoordinates function */
    a = new GraphicBuilderCreateParams(tf, GraphicType.ViewBackground);
    assert.isFalse(a.IsWorldCoordinates(), "IsWorldCoordinates test 1 failed");
    a = new GraphicBuilderCreateParams(tf, GraphicType.ViewOverlay);
    assert.isFalse(a.IsWorldCoordinates(), "IsWorldCoordinates test 2 failed");
    a = new GraphicBuilderCreateParams(tf, GraphicType.Scene);
    assert.isTrue(a.IsWorldCoordinates(), "IsWorldCoordinates test 3 failed");
    a = new GraphicBuilderCreateParams(tf, GraphicType.WorldDecoration);
    assert.isTrue(a.IsWorldCoordinates(), "IsWorldCoordinates test 4 failed");
    a = new GraphicBuilderCreateParams(tf, GraphicType.WorldOverlay);
    assert.isTrue(a.IsWorldCoordinates(), "IsWorldCoordinates test 5 failed");

    /** Test IsSceneGraphic function */
    a = new GraphicBuilderCreateParams(tf, GraphicType.ViewBackground);
    assert.isFalse(a.IsSceneGraphic(), "IsSceneGraphic test 1 failed");
    a = new GraphicBuilderCreateParams(tf, GraphicType.ViewOverlay);
    assert.isFalse(a.IsSceneGraphic(), "IsSceneGraphic test 2 failed");
    a = new GraphicBuilderCreateParams(tf, GraphicType.Scene);
    assert.isTrue(a.IsSceneGraphic(), "IsSceneGraphic test 3 failed");
    a = new GraphicBuilderCreateParams(tf, GraphicType.WorldDecoration);
    assert.isFalse(a.IsSceneGraphic(), "IsSceneGraphic test 4 failed");
    a = new GraphicBuilderCreateParams(tf, GraphicType.WorldOverlay);
    assert.isFalse(a.IsSceneGraphic(), "IsSceneGraphic test 5 failed");

    /** Test IsViewBackground function */
    a = new GraphicBuilderCreateParams(tf, GraphicType.ViewBackground);
    assert.isTrue(a.IsViewBackground(), "IsViewBackground test 1 failed");
    a = new GraphicBuilderCreateParams(tf, GraphicType.ViewOverlay);
    assert.isFalse(a.IsViewBackground(), "IsViewBackground test 2 failed");
    a = new GraphicBuilderCreateParams(tf, GraphicType.Scene);
    assert.isFalse(a.IsViewBackground(), "IsViewBackground test 3 failed");
    a = new GraphicBuilderCreateParams(tf, GraphicType.WorldDecoration);
    assert.isFalse(a.IsViewBackground(), "IsViewBackground test 4 failed");
    a = new GraphicBuilderCreateParams(tf, GraphicType.WorldOverlay);
    assert.isFalse(a.IsViewBackground(), "IsViewBackground test 5 failed");

    /** Test IsOverlay function */
    a = new GraphicBuilderCreateParams(tf, GraphicType.ViewBackground);
    assert.isFalse(a.IsOverlay(), "IsOverlay test 1 failed");
    a = new GraphicBuilderCreateParams(tf, GraphicType.ViewOverlay);
    assert.isTrue(a.IsOverlay(), "IsOverlay test 2 failed");
    a = new GraphicBuilderCreateParams(tf, GraphicType.Scene);
    assert.isFalse(a.IsOverlay(), "IsOverlay test 3 failed");
    a = new GraphicBuilderCreateParams(tf, GraphicType.WorldDecoration);
    assert.isFalse(a.IsOverlay(), "IsOverlay test 4 failed");
    a = new GraphicBuilderCreateParams(tf, GraphicType.WorldOverlay);
    assert.isTrue(a.IsOverlay(), "IsOverlay test 5 failed");

    /** Test SetPlacement function */
    a = new GraphicBuilderCreateParams(tf, GraphicType.ViewBackground);
    assert.isTrue(a.placement === tf, "SetPlacement test 1 failed");
    a.SetPlacement(tf2);
    assert.isTrue(a.placement === tf2, "SetPlacement test 2 failed");
    a.SetPlacement(tf);
    assert.isTrue(a.placement === tf, "SetPlacement test 3 failed");
  });
});

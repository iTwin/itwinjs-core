/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as path from "path";
import { Point3d, Range3d } from "@bentley/geometry-core";
import { ColorByName, QParams3d, QPoint3dList } from "@bentley/imodeljs-common";
import { IModelConnection, IModelApp } from "@bentley/imodeljs-frontend";
import { RenderGraphic, MeshArgs } from "@bentley/imodeljs-frontend/lib/rendering";
import { CONSTANTS } from "../common/Testbed";
import { WebGLTestContext } from "./WebGLTestContext";

export class FakeGraphic extends RenderGraphic {
  public dispose(): void { }
}

const iModelLocation = path.join(CONSTANTS.IMODELJS_CORE_DIRNAME, "core/backend/lib/test/assets/test.bim");

describe("createTriMesh", () => {
  let imodel: IModelConnection;
  before(async () => {
    imodel = await IModelConnection.openStandalone(iModelLocation);
    WebGLTestContext.startup();
  });

  after(async () => {
    WebGLTestContext.shutdown();
    if (imodel) await imodel.closeStandalone();
  });

  it("should create a simple mesh graphic", () => {
    if (!WebGLTestContext.isInitialized)
      return;

    const args = new MeshArgs();

    const points = [new Point3d(0, 0, 0), new Point3d(10, 0, 0), new Point3d(0, 10, 0)];
    args.points = new QPoint3dList(QParams3d.fromRange(Range3d.createArray(points)));
    for (const point of points)
      args.points.add(point);

    args.vertIndices = [0, 1, 2];
    args.colors.initUniform(ColorByName.tan);

    const graphic = IModelApp.renderSystem.createTriMesh(args);
    expect(graphic).not.to.be.undefined;
  });
});

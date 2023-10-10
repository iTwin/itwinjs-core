/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Cartographic, DisplayStyle3dProps, EcefLocation, EmptyLocalization, GeoCoordinatesRequestProps, IModelConnectionProps, IModelCoordinatesRequestProps, PointWithStatus } from "@itwin/core-common";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon from "sinon";
import { IModelApp } from "../../../IModelApp";
import {
  ArcGisGraphicsRenderer,

} from "../../../tile/internal";
import { BlankConnection, IModelConnection } from "../../../IModelConnection";
import { GeoServices, GeoServicesOptions } from "../../../GeoServices";
import { Guid, Mutable } from "@itwin/core-bentley";
import { Loop, Point3d, Range3d, Transform, XYZProps } from "@itwin/core-geometry";
import { BackgroundMapGeometry, DisplayStyle3dState, GraphicLineString, ScreenViewport, ViewState3d } from "../../../core-frontend";

import * as moq from "typemoq";

chai.use(chaiAsPromised);

export class TestConnection extends BlankConnection {
  public toIModelCoordsCount = 0;
  public fromIModelCount = 0;
  private _noGcsDefined = true;
  public constructor(iModelProps: IModelConnectionProps, geoServicesOpts: Partial<GeoServicesOptions>, noGcsDefined?: boolean) {
    super(iModelProps);

    if (noGcsDefined !== undefined)
      this._noGcsDefined = noGcsDefined;

    // hack: remove readonlys, so we can override 'geoServices' with our own version
    const mutable = this as Mutable<TestConnection>;
    mutable.geoServices = new GeoServices({
      isIModelClosed: geoServicesOpts.isIModelClosed ?? (() => false),
      toIModelCoords: async (request: IModelCoordinatesRequestProps) => {
        this.toIModelCoordsCount++;
        if (geoServicesOpts.toIModelCoords)
          return geoServicesOpts.toIModelCoords(request);
        else {
          return Promise.resolve([]);
        }
      },
      fromIModelCoords: async (request: GeoCoordinatesRequestProps) => {
        this.fromIModelCount++;
        if (geoServicesOpts.fromIModelCoords)
          return geoServicesOpts.fromIModelCoords(request);
        else {
          return Promise.resolve([]);
        }
      },
    });

  }

  public override getEcefTransform(): Transform {
    return Transform.identity;
  }

  public override get noGcsDefined(): boolean { return this._noGcsDefined; }
  public override get isClosed(): boolean { return false; }

}

const createImodelProps = () => {
  return  {
    rootSubject: { name: "test-connection" },
    projectExtents: new Range3d(-10000, -10000, -10000, 10000, 10000, 100),
    ecefLocation:  EcefLocation.createFromCartographicOrigin(Cartographic.fromDegrees({ longitude: -75.152149, latitude: 39.9296167, height: 0 })),
    key: "",
    iTwinId: Guid.createValue(),
  };
};

const styleProps: DisplayStyle3dProps = {
  classFullName: "BisCore:DisplayStyle3d",
  model: "0",
  code: {
    spec: "0x1",
    scope: "0x1",
    value: "",
  },
};

export class ViewportMock {
  public viewportMock = moq.Mock.ofType<ScreenViewport>();
  public viewMock = moq.Mock.ofType<ViewState3d>();

  public imodel: IModelConnection = new TestConnection(createImodelProps(), {});

  public displayStyle = new DisplayStyle3dState(styleProps, this.imodel);

  public get object() {
    return this.viewportMock.object;
  }

  public setup() {
    //
    this.viewMock.setup((view) => view.iModel).returns(() => this.imodel);
    this.viewportMock.setup((viewport) => viewport.iModel).returns(() => this.viewMock.object.iModel);
    this.viewportMock.setup((viewport) => viewport.displayStyle).returns(() => this.displayStyle);
  }

  public reset() {
    this.viewMock.reset();
    this.viewportMock.reset();
  }
}

const cloneCoords = (coords: XYZProps[]) => {
  const result: PointWithStatus[] = [];
  for (const coord of coords)
    result.push({ p: coord, s: 0 });

  return result;
};

const sampleGeoServicesProps = {
  toIModelCoords: async ( request: IModelCoordinatesRequestProps) => cloneCoords(request.geoCoords),
  fromIModelCoords: async ( request: GeoCoordinatesRequestProps) => cloneCoords(request.iModelCoords),
};

const sampleiModelProps = {
  rootSubject: { name: "test-connection" },
  projectExtents: new Range3d(-10, 10, -10, -10, 10, 100),
  ecefLocation:  EcefLocation.createFromCartographicOrigin(Cartographic.fromDegrees({ longitude: -75.686694, latitude: 40.065757, height: 0 })),
  key: "",
  iTwinId: Guid.createValue(),
};

describe("ArcGisGraphicsRenderer", () => {
  const sandbox = sinon.createSandbox();
  let viewportMock: ViewportMock|undefined;
  beforeEach(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    viewportMock = new ViewportMock();
  });

  afterEach(async () => {
    sandbox.restore();
    if (IModelApp.initialized)
      await IModelApp.shutdown();
    viewportMock!.reset();
  });

  it("render non-filled paths correctly", async () => {
    const renderer = new ArcGisGraphicsRenderer({viewport: viewportMock!.object});
    const testLengths = [2,2];
    const testCoords = [
      -8368830.26, 4866490.12,
      -8368794.98, 4866483.84,
      -8368804.29, 4866426.86,
      -8368850.49, 4866434.57,
    ];

    // We stub 'ArcGisGraphicsRenderer.toSpatialFromEcf' to have the same input/output points, and simplify testing.  We make sure
    // 'toSpatialFromEcf' is being called.
    const toSpatialStub = sandbox.stub(ArcGisGraphicsRenderer.prototype, "toSpatial" as any).callsFake(function _(geoPoints: any): any {
      return geoPoints;
    });

    await renderer.renderPath(testLengths, testCoords, false, 2, false);

    let i = 0;
    const tolerance = 0.0000001;

    const graphics = renderer.moveGraphics();
    expect(graphics.length).to.equals(2);
    for (const graphic of graphics) {
      expect(graphic.type).to.equals("linestring");
      const linestring  = graphic as GraphicLineString;
      expect(linestring.points.length).to.equals(2);
      for (const pt of linestring.points) {
        expect(Math.abs(pt.x - testCoords[i++])).to.be.lessThan(tolerance);
        expect(Math.abs(pt.y - testCoords[i++])).to.be.lessThan(tolerance);
      }

    }
    expect(graphics[0].type).to.equals("linestring");
    expect((graphics[0] as any).points.length ).to.equals(2);
    expect(toSpatialStub.called).to.be.true;
  });

  it("render filled paths correctly", async () => {
    const renderer = new ArcGisGraphicsRenderer({viewport: viewportMock!.object});

    // We stub 'ArcGisGraphicsRenderer.toSpatialFromEcf' to have the same input/output points, and simplify testing.  We make sure
    // 'toSpatialFromEcf' is being called.
    const toSpatialStub = sandbox.stub(ArcGisGraphicsRenderer.prototype, "toSpatial" as any).callsFake(function _(geoPoints: any): any {
      return geoPoints;
    });

    const testCoords = [
      -8368830.26, 4866490.12,
      -8368794.98, 4866483.84,
      -8368804.29, 4866426.86,
      -8368850.49, 4866434.57,
      -8368853.17, 4866437.99,
      -8368844.2, 4866492.5,
      -8368830.26, 4866490.12,
    ];

    // Make sure each render call makes translate into a single call to 'toIModelCoords' (i.e. points should NOT be converted one by one)
    await renderer.renderPath([testCoords.length/2], testCoords, true, 2, false);
    const graphics = renderer.moveGraphics();
    expect(graphics.length).to.equals(1);
    expect(graphics[0].type).to.equals("loop");
    const loop: Loop = (graphics[0] as any).loop;
    expect(loop.children.length).to.equals(6);

    let i = 0;
    const tolerance = 0.0000001;
    for (const child of loop.children) {
      expect(Math.abs(child.startPoint().x -  testCoords[i++])).to.be.lessThan(tolerance);
      expect(Math.abs(child.startPoint().y -  testCoords[i++])).to.be.lessThan(tolerance);
      expect(Math.abs(child.endPoint().x -  testCoords[i])).to.be.lessThan(tolerance);
      expect(Math.abs(child.endPoint().y -  testCoords[i+1])).to.be.lessThan(tolerance);
    }

    expect(toSpatialStub.called).to.be.true;

  });

  it("render point correctly", async () => {
    const renderer = new ArcGisGraphicsRenderer({viewport: viewportMock!.object});

    // We stub 'ArcGisGraphicsRenderer.toSpatialFromEcf' to have the same input/output points, and simplify testing.  We make sure
    // 'toSpatialFromEcf' is being called.
    const toSpatialStub = sandbox.stub(ArcGisGraphicsRenderer.prototype, "toSpatial" as any).callsFake(function _(geoPoints: any): any {
      return geoPoints;
    });

    const testCoords = [
      -8368830.26, 4866490.12,
    ];

    // Make sure each render call makes translate into a single call to 'toIModelCoords' (i.e. points should NOT be converted one by one)
    await renderer.renderPoint([testCoords.length/2], testCoords, 2, false);
    const graphics = renderer.moveGraphics();
    expect(graphics.length).to.equals(1);
    expect(graphics[0].type).to.equals("pointstring");
    const points: Point3d[] = (graphics[0] as any).points;
    expect(points.length).to.equals(1);
    let i = 0;
    const tolerance = 0.0000001;
    expect(Math.abs(points[0].x -  testCoords[i++])).to.be.lessThan(tolerance);
    expect(Math.abs(points[0].y -  testCoords[i++])).to.be.lessThan(tolerance);

    expect(toSpatialStub.called).to.be.true;

  });

  it("coordinates reprojection RPC calls get batched if GCS defined", async () => {
    viewportMock?.reset();
    const connection = new TestConnection(sampleiModelProps, sampleGeoServicesProps, false);
    viewportMock!.imodel = connection;
    viewportMock!.displayStyle = new DisplayStyle3dState(styleProps, connection);
    viewportMock!.setup();
    const renderer = new ArcGisGraphicsRenderer({viewport: viewportMock!.object});

    const testLengths = [4,4];
    const testCoords = [
      -8425593.033762699, 4875527.516249214,
      -8425446.432177741, 4875531.597149869,
      -8425405.243966147,4875392.564639658,
      -8425582.24195651, 4875371.3119488945,
      // duplicate
      -8425593.033762699, 4875527.516249214,
      -8425446.432177741, 4875531.597149869,
      -8425405.243966147,4875392.564639658,
      -8425582.24195651, 4875371.3119488945,
    ];

    // Make sure each render call makes translate into a single call to 'toIModelCoords' (i.e. points should NOT be converted one by one)
    await renderer.renderPath(testLengths, testCoords, false, 2, false);
    expect(connection.toIModelCoordsCount).to.equals(1);

    // filled paths
    connection.toIModelCoordsCount = 0;
    await renderer.renderPath(testLengths, testCoords, true, 2, false);
    expect(connection.toIModelCoordsCount).to.equals(1);

    // filled paths
    connection.toIModelCoordsCount = 0;
    await renderer.renderPoint(testLengths, testCoords, 2, false);
    expect(connection.toIModelCoordsCount).to.equals(1);

  });

  it("coordinates reprojection RPC calls get batched if GCS defined", async () => {
    viewportMock?.reset();

    const connection = new TestConnection(sampleiModelProps, sampleGeoServicesProps, false);
    // !Important: tweak this value to ensure coordinates will fit outside cartesianRange,
    // and therefore make the reprojection code skip the reprojection backend.
    BackgroundMapGeometry.maxCartesianDistance = 0;
    viewportMock!.imodel = connection;
    viewportMock!.displayStyle = new DisplayStyle3dState(styleProps, connection);
    viewportMock!.setup();
    const renderer = new ArcGisGraphicsRenderer({viewport: viewportMock!.object});

    const testLengths = [4,4];
    const testCoords = [
      -8425593.033762699, 4875527.516249214,
      -8425446.432177741, 4875531.597149869,
      -8425405.243966147,4875392.564639658,
      -8425582.24195651, 4875371.3119488945,
      // duplicate
      -8425593.033762699, 4875527.516249214,
      -8425446.432177741, 4875531.597149869,
      -8425405.243966147,4875392.564639658,
      -8425582.24195651, 4875371.3119488945,
    ];

    await renderer.renderPath(testLengths, testCoords, false, 2, false);
    expect(connection.toIModelCoordsCount).to.equals(0);
  });
});

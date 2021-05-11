/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { Id64, Id64Set } from "@bentley/bentleyjs-core";
import { Matrix4d, Point3d, XYZProps, YawPitchRollAngles } from "@bentley/geometry-core";
import {
  EcefLocation, GeoCoordStatus, IModelCoordinatesResponseProps, IModelReadRpcInterface, MassPropertiesOperation,
  MassPropertiesRequestProps, ModelQueryParams, SnapResponseProps,
} from "@bentley/imodeljs-common";
import { CheckpointConnection, IModelApp, IModelConnection, SpatialModelState, ViewState } from "@bentley/imodeljs-frontend";
import { AccessToken } from "@bentley/itwin-client";
import { TestFrontendAuthorizationClient } from "@bentley/oidc-signin-tool/lib/frontend";
import { TestContext } from "./setup/TestContext";

/* eslint-disable deprecation/deprecation */

const expect = chai.expect;

// eslint-disable-next-line @typescript-eslint/no-var-requires
(global as any).btoa = (str: string) => {
  const buffer = Buffer.from(str, "binary");
  return buffer.toString("base64");
};

describe("IModel Connection", () => {
  let accessToken: AccessToken;
  let testContext: TestContext;

  before(async function () {
    testContext = await TestContext.instance();

    if (!testContext.settings.runiModelReadRpcTests)
      this.skip();

    accessToken = testContext.adminUserAccessToken;
    IModelApp.authorizationClient = new TestFrontendAuthorizationClient(accessToken);
  });

  it("should successfully open an IModelConnection for read", async () => {
    const contextId = testContext.iModelWithChangesets!.contextId;
    const iModelId = testContext.iModelWithChangesets!.iModelId;

    const iModel: IModelConnection = await CheckpointConnection.openRemote(contextId, iModelId);

    expect(iModel).to.exist.and.be.not.empty;

    const iModelRpcProps = iModel.getRpcProps();
    expect(iModelRpcProps).to.exist.and.be.not.empty;
  });

  it("should successfully close an open an IModelConnection", async () => {
    const iModelId = testContext.iModelWithChangesets!.iModelId;
    const contextId = testContext.iModelWithChangesets!.contextId;
    const iModel = await CheckpointConnection.openRemote(contextId, iModelId);

    expect(iModel).to.exist;
    return expect(iModel.close()).to.eventually.be.fulfilled;
  });
});

describe("IModelReadRpcInterface Methods requestable from an IModelConnection", () => {
  let iModel: IModelConnection;
  let contextId: string;
  let accessToken: AccessToken;
  let testContext: TestContext;

  before(async function () {
    testContext = await TestContext.instance();

    if (!testContext.settings.runiModelReadRpcTests) {
      this.skip();
    }

    const iModelId = testContext.iModelWithChangesets!.iModelId;
    contextId = testContext.iModelWithChangesets!.contextId;
    accessToken = testContext.adminUserAccessToken;
    IModelApp.authorizationClient = new TestFrontendAuthorizationClient(accessToken);
    iModel = await CheckpointConnection.openRemote(contextId, iModelId);
  });

  it("IModelReadRpcInterface method queryEntityIds should work as expected", async () => {
    const ids: Id64Set = await iModel.elements.queryIds({ limit: 10, from: "BisCore:Subject" });

    expect(ids).to.exist;
  });

  it("IModelReadRpcInterface method getToolTipMessage should work as expected", async () => {
    const ids: Id64Set = await iModel.elements.queryIds({ limit: 10, from: "BisCore:Subject" });
    const id = ids.values().next().value;

    const tooltip = await iModel.getToolTipMessage(id); // "0x338"

    expect(tooltip).to.not.be.undefined;
  });

  it("IModelReadRpcInterface method getDefaultViewId should work as expected", async () => {
    const result = await iModel.views.queryDefaultViewId();

    expect(result).to.not.be.undefined;
  });

  it("IModelReadRpcInterface method getGeometrySummary should work as expected", async () => {
    const ids: Id64Set = await iModel.elements.queryIds({ limit: 10, from: "BisCore:Subject" });
    const id = ids.values().next().value;
    const result = await IModelReadRpcInterface.getClient().getGeometrySummary(iModel.getRpcProps(), { elementIds: [id], options: {} });
    expect(result).to.not.be.undefined;
  });

  it("IModelReadRpcInterface method requestSnap should work as expected", async () => {
    const ids: Id64Set = await iModel.elements.queryIds({ limit: 10, from: "BisCore:PhysicalElement" });
    const id = ids.values().next().value;

    const worldToView = Matrix4d.createIdentity();
    const snap = await iModel.requestSnap({
      id,
      testPoint: { x: 1, y: 2, z: 3 },
      closePoint: { x: 1, y: 2, z: 3 },
      worldToView: worldToView.toJSON(),
    });

    expect(snap.status).to.not.be.undefined;
  });

  it("IModelReadRpcInterface method queryModelProps should work as expected", async () => {
    const modelQueryParams: ModelQueryParams = { limit: 10, from: SpatialModelState.classFullName, wantPrivate: false };
    const curModelProps = await iModel.models.queryProps(modelQueryParams);

    expect(curModelProps).to.not.be.undefined;
    expect(curModelProps.length).gt(0);
  });

  it("IModelReadRpcInterface method getModelProps should work as expected", async () => {
    const modelQueryParams: ModelQueryParams = { limit: 10, from: SpatialModelState.classFullName, wantPrivate: false };
    const curModelProps = await iModel.models.queryProps(modelQueryParams);
    const modelId = curModelProps[0].id!.toString();

    await iModel.models.load(modelId); // "0x1c"

    expect(iModel.models.loaded.size).to.equal(1);
    expect(iModel.models.loaded.get(modelId)).to.not.be.undefined;
  });

  it("IModelReadRpcInterface method getClassHierarchy should work as expected", async () => {
    const result = await iModel.findClassFor("BisCore:LineStyle", undefined);
    expect(result).undefined;
  });

  it("IModelReadRpcInterface method getViewThumbnail should work as expected", async () => {
    const modelQueryParams: ModelQueryParams = { limit: 10, from: ViewState.classFullName };
    const modelProps = await iModel.views.queryProps(modelQueryParams);
    const viewId = modelProps[0].id!.toString();
    const result = await iModel.views.getThumbnail(viewId);
    expect(result).to.not.be.undefined;
  });

  it("IModelReadRpcInterface method getIModelCoordinatesFromGeoCoordinates should work as expected", async () => {
    const wgs84Converter = iModel.geoServices.getConverter("WGS84");
    const nad27Converter = iModel.geoServices.getConverter("NAD27");

    const geoPointList: XYZProps[] = [];

    for (let iLatitude: number = 0; iLatitude < 10; iLatitude++) {
      for (let iLongitude: number = 0; iLongitude < 10; iLongitude++) {
        geoPointList.push({ x: (132.600 + 0.02 * iLongitude), y: (34.350 + 0.02 * iLatitude), z: 0.0 });
      }
    }

    const testPoints: XYZProps[] = [];
    for (let iGeoPoint: number = 1; iGeoPoint < geoPointList.length; iGeoPoint += 2)
      testPoints.push(geoPointList[iGeoPoint]);

    const wgs84Response: IModelCoordinatesResponseProps = await wgs84Converter!.getIModelCoordinatesFromGeoCoordinates(testPoints);

    // shouldn't have any from the cache.
    expect(wgs84Response.fromCache === 0).to.be.true;

    // shouldn't have any failures.
    for (const result of wgs84Response.iModelCoords) {
      expect(GeoCoordStatus.Success === result.s);
    }

    const nad27Response = await nad27Converter!.getIModelCoordinatesFromGeoCoordinates(testPoints);

    // shouldn't have any from the cache.
    expect(nad27Response.fromCache).eq(0);
  });

  it("IModelReadRpcInterface method getGeoCoordinatesFromIModelCoordinates should work as expected", async () => {
    const ecefProps: EcefLocation = new EcefLocation({ orientation: YawPitchRollAngles.createDegrees(0, 0, 0), origin: Point3d.create(0, 0, 0) });
    iModel.setEcefLocation(ecefProps);

    try {
      await iModel.spatialToCartographic({ x: 6378.137, y: 0, z: 0 });
    } catch (error) { }
  });

  /* NEEDSWORK queryPage no longer exists; you cannot specify a specific rows-per-page to query for (only a maximum via LIMIT).
  it("iModelReadRpcInterface method queryRowCount should work as expected", async () => {
    const getRowPerPage = (nPageSize: number, nRowCount: number) => {
      const nRowPerPage = nRowCount / nPageSize;
      const nPages = Math.ceil(nRowPerPage);
      const nRowOnLastPage = nRowCount - (Math.floor(nRowPerPage) * pageSize);
      const pages = new Array(nPages).fill(pageSize);
      if (nRowPerPage) {
        pages[nPages - 1] = nRowOnLastPage;
      }
      return pages;
    };

    const pageSize = 5;
    const query = "SELECT ECInstanceId as Id, Parent.Id as ParentId FROM BisCore.Element";
    const rowCount = await iModel.queryRowCount(query);

    // verify row per page
    const rowPerPage = getRowPerPage(pageSize, rowCount);
    for (let k = 0; k < rowPerPage.length; k++) {
      const row = await iModel.queryPage(query, undefined, { size: pageSize, start: k });
      expect(row.length).to.be.equal(rowPerPage[k]);
    }

    // verify with async iterator
    const resultSet = [];
    for await (const row of iModel.query(query, undefined, { size: pageSize })) {
      resultSet.push(row);
      expect(Reflect.has(row, "id")).to.be.true;
      if (Reflect.ownKeys(row).length > 1) {
        expect(Reflect.has(row, "parentId")).to.be.true;
        const parentId: string = row.parentId;
        expect(parentId.startsWith("0x")).to.be.true;
      }
      const id: string = row.id;
      expect(id.startsWith("0x"));
    }
    expect(rowCount).to.be.equal(resultSet.length);
  });
  */

  it("iModelReadRpcInterface method queryModelRanges should work as expected", async () => {
    const modelProps = await iModel.models.queryProps({ limit: 10, from: "BisCore.SpatialModel" });
    const modelId = modelProps[0].id!.toString();

    let idSet: Id64Set = Id64.toIdSet(modelId);

    let ranges = await iModel.models.queryModelRanges(idSet);

    expect(ranges).to.not.be.undefined;
    expect(ranges.length).to.be.equal(1);
    idSet = new Set<string>();
    for (const modelProp of modelProps) {
      idSet.add(modelProp.id!.toString());
    }
    ranges = await iModel.models.queryModelRanges(idSet);
    expect(ranges).to.not.be.undefined;
    expect(ranges.length).to.be.gte(1);

  });
  it("iModelReadRpcInterface method queryModelRanges should properly handle models that aren't geometric", async () => {
    // the below clause is created specifically for the test iModel, if that iModel were to be changed and it contained models that were geometricModels
    // but not PhysicalModels then the test may fail.
    let ranges;
    let modelProps = await iModel.models.queryProps({ limit: 10, from: "BisCore.Model", where: "ec_classname(ECClassId) <> 'BisCore:PhysicalModel'" });
    let idSet: Id64Set = new Set<string>();
    for (const modelProp of modelProps) {
      idSet.add(modelProp.id!.toString());
    }
    if (idSet.size === 1) { // queryModelRanges throws error if idSet size is 1 AND the id in the set returns some error for querying its extents
      await expect(iModel.models.queryModelRanges(idSet)).to.be.rejectedWith(Error);
    } else {
      ranges = await iModel.models.queryModelRanges(idSet);
      expect(ranges).to.not.be.undefined;
      expect(ranges.length).to.be.equal(0);
    }
    const dictModelId = await iModel.models.getDictionaryModel();
    idSet = Id64.toIdSet(dictModelId);
    await expect(iModel.models.queryModelRanges(idSet)).to.be.rejectedWith(Error);

    modelProps = await iModel.models.queryProps({ limit: 10, from: "BisCore.SpatialModel" });
    idSet.add(modelProps[0].id!.toString());
    ranges = await iModel.models.queryModelRanges(idSet);
    expect(ranges).to.not.be.undefined;
    expect(ranges.length).to.be.equal(1);
  });
  it("iModelReadRpcInterface method getMassProperties should work as expected", async () => {
    const requestProps: MassPropertiesRequestProps = {
      operation: MassPropertiesOperation.AccumulateVolumes,
    };

    const result = await IModelReadRpcInterface.getClient().getMassProperties(iModel.getRpcProps(), requestProps);
    expect(result).to.not.be.null;
  });
});

describe("Snapping", () => {
  let iModel: IModelConnection;
  let contextId: string;
  let accessToken: AccessToken;
  let testContext: TestContext;

  before(async function () {
    testContext = await TestContext.instance();

    if (!testContext.settings.runiModelReadRpcTests)
      this.skip();

    const iModelId = testContext.iModelWithChangesets!.iModelId;
    contextId = testContext.iModelWithChangesets!.contextId;
    accessToken = testContext.adminUserAccessToken;
    IModelApp.authorizationClient = new TestFrontendAuthorizationClient(accessToken);
    iModel = await CheckpointConnection.openRemote(contextId, iModelId);
  });

  it("should be able to request a snap", async () => {
    const ids: Id64Set = await iModel.elements.queryIds({ limit: 10, from: "BisCore:PhysicalElement" });
    const id = ids.values().next().value;

    const worldToView = Matrix4d.createIdentity();
    const snapProps = {
      id,
      testPoint: { x: 1, y: 2, z: 3 },
      closePoint: { x: 1, y: 2, z: 3 },
      worldToView: worldToView.toJSON(),
    };

    const snap = await IModelReadRpcInterface.getClient().requestSnap(iModel.getRpcProps(), id, snapProps);

    expect(snap.status).to.not.be.undefined;
  });

  it("should be able to cancel a snap", async () => {
    const ids: Id64Set = await iModel.elements.queryIds({ limit: 10, from: "BisCore:PhysicalElement" });
    const id = ids.values().next().value;

    const worldToView = Matrix4d.createIdentity();
    const snapProps = {
      id,
      testPoint: { x: 1, y: 2, z: 3 },
      closePoint: { x: 1, y: 2, z: 3 },
      worldToView: worldToView.toJSON(),
    };

    const requestSnapPromises: Array<Promise<SnapResponseProps>> = [];
    requestSnapPromises.push(IModelReadRpcInterface.getClient().requestSnap(iModel.getRpcProps(), id, snapProps));
    await IModelReadRpcInterface.getClient().cancelSnap(iModel.getRpcProps(), id);

    try {
      const snaps = await Promise.all(requestSnapPromises);
      expect(snaps[0].status).to.not.be.undefined; // This is what we expect if the snap is completed before the cancellation is processed.
    } catch (err) {
      // This is what we expect if the cancellation occurs in time to really cancel the snap.
    }
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { CheckpointConnection, IModelApp, IModelConnection, RealityDataSource, SpatialModelState, ThreeDTileFormatInterpreter, TileAdmin } from "@itwin/core-frontend";
import { TestUsers } from "@itwin/oidc-signin-tool/lib/cjs/frontend";
import { TestUtility } from "../TestUtility";
import { EcefLocation, RealityDataFormat, RealityDataProvider, RealityDataSourceKey } from "@itwin/core-common";
import { Id64String } from "@itwin/core-bentley";
import { ITwinRealityData, RealityDataAccessClient, RealityDataClientOptions, RealityDataQueryCriteria, RealityDataResponse } from "@itwin/reality-data-client";

export interface IRealityDataModelInfo {
  key: RealityDataSourceKey;
  // The id of the reality data model in the iModel
  modelId: Id64String;
  // The realityData model url on ContextShare
  attachmentUrl: string;
  // The name of the reality data in the model name
  attachmentName: string;
}

describe("RealityDataAccess (#integration)", () => {
  let allProjectRealityDatas: ITwinRealityData[] | undefined;
  let imodel: IModelConnection;
  let iTwinId: string;
  const realityDataClientOptions: RealityDataClientOptions = {
    /** API Version. v1 by default */
    // version?: ApiVersion;
    /** API Url. Used to select environment. Defaults to "https://api.bentley.com/reality-management/reality-data */
    baseUrl: `https://${process.env.IMJS_URL_PREFIX ?? ""}api.bentley.com`,
  };
  let realityDataAccess: RealityDataAccessClient;
  before(async () => {
    await TestUtility.shutdownFrontend();
    realityDataAccess = new RealityDataAccessClient(realityDataClientOptions);
    const options = TestUtility.iModelAppOptions;
    options.realityDataAccess = realityDataAccess;
    const tileAdmin: TileAdmin.Props = {};
    tileAdmin.cesiumIonKey = process.env.IMJS_CESIUM_ION_KEY;
    options.tileAdmin = tileAdmin;
    await TestUtility.startFrontend({
      ...options,
    });
    await TestUtility.initialize(TestUsers.regular);
    iTwinId = await TestUtility.queryITwinIdByName(TestUtility.testITwinName);
    const iModelId = await TestUtility.queryIModelIdByName(iTwinId, TestUtility.testIModelNames.realityDataAccess);
    imodel = await CheckpointConnection.openRemote(iTwinId, iModelId);
  });

  after(async () => {
    if (imodel)
      await imodel.close();

    await TestUtility.shutdownFrontend();
  });

  function getAttachmentURLFromModelProps(modelProps: any): {rdsUrl: string | undefined, blobFilename: string | undefined} {
    // Special case for OPC file
    if (modelProps.tilesetUrl !== undefined && modelProps.tilesetUrl.orbitGtBlob !== undefined ) {
      return {rdsUrl: modelProps.tilesetUrl.orbitGtBlob.rdsUrl, blobFilename: modelProps.tilesetUrl.orbitGtBlob.blobFileName};
    } else if (modelProps.orbitGtBlob !== undefined && modelProps.orbitGtBlob.rdsUrl ) {
      return {rdsUrl: modelProps.orbitGtBlob.rdsUrl, blobFilename: modelProps.orbitGtBlob.blobFileName };
    }
    return {rdsUrl: modelProps.tilesetUrl, blobFilename: undefined };
  }

  async function getAttachedRealityDataModelInfoSet(iModel: IModelConnection): Promise<Set<IRealityDataModelInfo> > {
    // Get set of RealityDataModelInfo that are directly attached to the model.
    const modelRealityDataInfos = new Set<IRealityDataModelInfo>();
    if (iModel) {
      const query = { from: SpatialModelState.classFullName, wantPrivate: false };
      const iModelProps = await iModel.models.queryProps(query);
      for (const prop of iModelProps) {
        if (prop.jsonProperties !== undefined && (prop.jsonProperties.tilesetUrl || prop.jsonProperties.orbitGtBlob) && prop.id !== undefined && prop.name) {
          const attachmentUrl = getAttachmentURLFromModelProps(prop.jsonProperties);
          if (attachmentUrl !== undefined && attachmentUrl.rdsUrl !== undefined) {
            let fileFormat = RealityDataFormat.ThreeDTile;
            if (prop.jsonProperties.orbitGtBlob)
              fileFormat = RealityDataFormat.OPC;
            const key = RealityDataSource.createKeyFromUrl(attachmentUrl.rdsUrl, undefined, fileFormat);
            modelRealityDataInfos.add({key, modelId: prop.id, attachmentUrl: attachmentUrl.rdsUrl, attachmentName: prop.name});
          }
        }
      }
    }
    return modelRealityDataInfos;
  }

  enum RealityDataType {
    REALITYMESH3DTILES  = "REALITYMESH3DTILES",
    OSMBUILDINGS = "OSMBUILDINGS",
    OPC = "OPC",
    TERRAIN3DTILES = "TERRAIN3DTILES", // Terrain3DTiles
    OMR = "OMR", // Mapping Resource,
    CESIUM3DTILES = "CESIUM3DTILES",
    UNKNOWN = "UNKNOWN",
  }

  function isSupportedType(type: string | undefined): boolean {
    if (type === undefined)
      return false;

    switch (type.toUpperCase()) {
      case RealityDataType.REALITYMESH3DTILES:
        return true;
      case RealityDataType.CESIUM3DTILES:
        return true;
      case RealityDataType.OPC:
        return true;
      case RealityDataType.OSMBUILDINGS:
        return true;
      case RealityDataType.TERRAIN3DTILES:
        return true;
      case RealityDataType.OMR:
        return true;
    }
    return false;
  }

  function isSupportedDisplayType(type: string | undefined): boolean {
    if (type === undefined)
      return false;
    if (isSupportedType(type)) {
      switch (type.toUpperCase()) {
        case RealityDataType.OMR:
          return false; // this type is supported from Context Share but can only be displayed by Orbit Photo Navigation (not publicly available)
        default:
          return true;
      }
    }
    return false;
  }

  function createRealityDataListKeyFromITwinRealityData(iTwinRealityData: ITwinRealityData): RealityDataSourceKey {
    return {
      provider: RealityDataProvider.ContextShare,
      format: iTwinRealityData.type === RealityDataType.OPC ? RealityDataFormat.OPC : RealityDataFormat.ThreeDTile,
      id: iTwinRealityData.id,
    };
  }
  function  getOSMBuildingsKey(): RealityDataSourceKey {
    // We don't always have access to url (which is internal) for OSMBuildings, create a special key for it
    return {provider: RealityDataProvider.CesiumIonAsset, format: RealityDataFormat.ThreeDTile, id: "OSMBuildings"};
  }

  async function getAllRealityDataFromProject(): Promise<ITwinRealityData[]> {
    // Initialize on first call and then keep the result for other calls
    if (allProjectRealityDatas === undefined) {
      allProjectRealityDatas = [];
      let projectRealityDatas: RealityDataResponse = {realityDatas: []};
      let continuationToken: string | undefined;
      const top=100;
      const criteria: RealityDataQueryCriteria = {
        getFullRepresentation: true,
        top,
        continuationToken,
      };
      do {
        criteria.continuationToken = projectRealityDatas.continuationToken;
        const accessToken = await IModelApp.getAccessToken();
        projectRealityDatas = await realityDataAccess.getRealityDatas(accessToken, iTwinId, criteria);
        for (const rd of projectRealityDatas.realityDatas) {
          allProjectRealityDatas.push(rd);
        }
      } while (projectRealityDatas.continuationToken);
    }
    return allProjectRealityDatas;
  }

  it("should get RealityDataSource for all supported reality data in itwin project", async () => {
    const realityDatas = await getAllRealityDataFromProject();
    for (const rd of realityDatas) {
      if (isSupportedType(rd.type)){
        const keyFromInput: RealityDataSourceKey = createRealityDataListKeyFromITwinRealityData(rd);
        const rdSource = await RealityDataSource.fromKey(keyFromInput, iTwinId);
        expect(rdSource).not.undefined;
        expect(rdSource?.isContextShare).to.be.true;
      }
    }
  });

  it("should be able to call getPublisherProductInfo on RealityDataSource for all supported displayable reality data in itwin project", async () => {
    const realityDatas = await getAllRealityDataFromProject();
    for (const rd of realityDatas) {
      // Some types are supported and return by Context Share but required extension to be displayed (e.g: OMR)
      if (isSupportedDisplayType(rd.type)){
        const keyFromInput: RealityDataSourceKey = createRealityDataListKeyFromITwinRealityData(rd);
        const rdSource = await RealityDataSource.fromKey(keyFromInput, iTwinId);
        expect(rdSource).not.undefined;
        expect(rdSource?.isContextShare).to.be.true;
        const pInfo = await rdSource?.getPublisherProductInfo();
        // We expect to be able to return this info for all 3dTile, but it may contain empty string
        if (keyFromInput.format === RealityDataFormat.ThreeDTile)
          expect(pInfo).not.undefined;
      }
    }
  });

  it("should be able to call getFileInfo when RealityDataSource is a 3dTile reality data", async () => {
    const realityDatas = await getAllRealityDataFromProject();
    for (const rd of realityDatas) {
      // Some types are supported and return by Context Share but required extension to be displayed (e.g: OMR)
      if (isSupportedDisplayType(rd.type)){
        const keyFromInput: RealityDataSourceKey = createRealityDataListKeyFromITwinRealityData(rd);
        const rdSource = await RealityDataSource.fromKey(keyFromInput, iTwinId);
        expect(rdSource).not.undefined;
        expect(rdSource?.isContextShare).to.be.true;
        // We expect to be able to return this info for all 3dTile
        if (rdSource && keyFromInput.format === RealityDataFormat.ThreeDTile) {
          const rootDocument = await rdSource.getRootDocument(undefined);
          const fileInfo = ThreeDTileFormatInterpreter.getFileInfo(rootDocument);
          expect(fileInfo).not.undefined;
        }
      }
    }
  });

  it("should be able to call getSpatialLocationAndExtents on RealityDataSource for all supported displayable reality data in itwin project", async () => {
    const realityDatas = await getAllRealityDataFromProject();
    for (const rd of realityDatas) {
      // Some types are supported and return by Context Share but required extension to be displayed (e.g: OMR)
      if (isSupportedDisplayType(rd.type)){
        const keyFromInput: RealityDataSourceKey = createRealityDataListKeyFromITwinRealityData(rd);
        const rdSource = await RealityDataSource.fromKey(keyFromInput, iTwinId);
        expect(rdSource).not.undefined;
        expect(rdSource?.isContextShare).to.be.true;
        const spatialLocation = await rdSource?.getSpatialLocationAndExtents();
        expect(spatialLocation).not.undefined;
        if (rdSource && keyFromInput.format === RealityDataFormat.ThreeDTile) {
          // special check to ensure that position are computed the same way as in other Bentley product
          // using the transform matrix in the reality data 3dTile root file that is used to set ECEFLocation
          // when creating a blankIModelConnection
          const rootDocument = await rdSource.getRootDocument(undefined);
          const worldToEcefTransformInput = ThreeDTileFormatInterpreter.transformFromJson(rootDocument.root.transform);
          const ecefLocation = spatialLocation?.location as EcefLocation;
          const worldToEcefTransformComputed = ecefLocation?.getTransform();
          // when defined and not identity, the computed transform should be almost equal to rd transform
          if (worldToEcefTransformInput && !worldToEcefTransformInput.isIdentity)
            expect(worldToEcefTransformInput.isAlmostEqual(worldToEcefTransformComputed));
        }
      }
    }
  });

  it("should get RealityDataSource for reality data attachment in iModel", async () => {
    assert.isTrue(imodel !== undefined);
    const modelRealityDataInfos = await getAttachedRealityDataModelInfoSet(imodel);
    expect(modelRealityDataInfos.size).to.equal(3);
    for (const entry of modelRealityDataInfos) {
      const rdSource = await RealityDataSource.fromKey(entry.key, iTwinId);
      expect(rdSource).not.undefined;
      expect(rdSource?.isContextShare).to.be.true;
    }
  });

  it("should get RealityDataSource for Open Street Map Building (OSM)", async () => {
    assert.isTrue(imodel !== undefined);
    const rdSourceKey = getOSMBuildingsKey();
    const rdSource = await RealityDataSource.fromKey(rdSourceKey, iTwinId);
    // NOTE: This test will fail if IMJS_CESIUM_ION_KEY is not defined in your .env file;
    const cesiumIonKey = process.env.IMJS_CESIUM_ION_KEY;
    assert.isDefined(cesiumIonKey, "This test will fail if IMJS_CESIUM_ION_KEY is not defined in your .env file");
    if (cesiumIonKey !== undefined) {
      expect(rdSource).not.undefined;
      expect(rdSource?.isContextShare).to.be.false;
    } else {
      expect(rdSource).to.be.undefined;
    }
  });
});

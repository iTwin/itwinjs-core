/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { Guid } from "@itwin/core-bentley";
import { GeoCoordStatus, GeographicCRSProps, IModelProps } from "@itwin/core-common";
import { Point3d } from "@itwin/core-geometry";
import { GcsDbProps, GeoCoordConfig } from "../../GeoCoordConfig";
import { IModelHost } from "../../IModelHost";
import { IModelNative } from "../../internal/NativePlatform";
import { _nativeDb } from "../../internal/Symbols";
import { SnapshotDb } from "../../core-backend";
import { SettingsPriority } from "../../workspace/Settings";
import { IModelTestUtils } from "../IModelTestUtils";
import { TestUtils } from "../TestUtils";

const runDevAcceptance = process.env.IMODELJS_VERTICAL_CRS_DEV_TEST === "1" ? describe : describe.skip;

const baseDbProps: GcsDbProps = {
  dbName: "base",
  version: "1.0.19",
  baseUri: "https://dev-geocoord-workspace.itwinjs.org",
  containerId: "gcs",
  storageType: "azure",
  isPublic: true,
  priority: 10000,
  prefetch: true,
};

const allEarthDbProps: GcsDbProps = {
  dbName: "allEarth",
  version: "1.0.19",
  baseUri: "https://dev-geocoord-workspace.itwinjs.org",
  containerId: "gcs",
  storageType: "azure",
  isPublic: true,
  priority: 100,
};

runDevAcceptance("Vertical CRS DEV workspace acceptance", function () {
  this.timeout(120_000);

  const iModelFileName = IModelTestUtils.prepareOutputFile("VerticalCrsDev", "VerticalCrsDev.bim");
  const cacheDir = path.join(path.dirname(iModelFileName), "cache");
  let iModel: SnapshotDb | undefined;

  before(async () => {
    await TestUtils.shutdownBackend();
    fs.rmSync(cacheDir, { recursive: true, force: true });
    await TestUtils.startBackend({ cacheDir, loadGcsWorkspaces: true });

    IModelHost.appWorkspace.settings.addDictionary(
      { name: "vertical-crs-dev-acceptance", priority: SettingsPriority.application },
      {
        [GeoCoordConfig.settingName.defaultDatabases]: [baseDbProps, allEarthDbProps],
      },
    );

    GeoCoordConfig.loadDefaultDatabases();
    IModelNative.platform.enableLocalGcsFiles(false);
    iModel = SnapshotDb.createEmpty(
      iModelFileName,
      { rootSubject: { name: "Vertical CRS DEV acceptance" }, guid: Guid.createValue() },
    );
  });

  after(async () => {
    iModel?.close();
    IModelNative.platform.enableLocalGcsFiles(true);
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend();
  });

  it("enumerates every definition in the DEV Vertical Datum dictionary", async () => {
    const baseDb = await IModelHost.appWorkspace.getWorkspaceDb(baseDbProps);
    const dictionaryBlob = baseDb.getBlob("VerticalDatumDefinitions.json");
    if (!dictionaryBlob)
      throw new Error("VerticalDatumDefinitions.json is missing from the DEV base workspace");

    const dictionary = JSON.parse(new TextDecoder().decode(dictionaryBlob)) as {
      definitions: Array<{ verticalCRS: { crsName: string } }>;
    };
    const expectedNames = dictionary.definitions.map((entry) => entry.verticalCRS.crsName).sort();
    const actualNames = IModelNative.platform.GeoServices.getListOfVerticalCRS().map((entry) => entry.crsName).sort();

    expect(actualNames).to.deep.equal(expectedNames);
  });

  it("enumerates and converts EGM96 using DEV resources", async () => {
    const verticalSystems = IModelNative.platform.GeoServices.getListOfVerticalCRS({
      point: { longitude: 23.700523, latitude: 37.944210 },
    });
    const egm96 = verticalSystems.find((entry) => entry.crsName === "EGM96 height");

    expect(egm96).not.to.be.undefined;
    expect(egm96!.id).to.equal("GEOID");
    expect(egm96!.unit).to.equal("meter");

    const modelCrs = {
      horizontalCRS: { id: "LL84" },
      verticalCRS: { id: "GEOID", crsName: "EGM96 height" },
    } as GeographicCRSProps;
    iModel![_nativeDb].updateIModelProps({ geographicCoordinateSystem: modelCrs } as IModelProps);

    const response = await iModel!.getGeoCoordinatesFromIModelCoordinates({
      target: JSON.stringify({
        horizontalCRS: { id: "LL84" },
        verticalCRS: { id: "ELLIPSOID" },
      }),
      iModelCoords: [{ x: 23.700523, y: 37.944210, z: 0 }],
    });

    expect(response.geoCoords[0].s).to.equal(GeoCoordStatus.Success);
    const result = Point3d.fromJSON(response.geoCoords[0].p);
    expect(result.x).to.be.closeTo(23.700523, 0.000001);
    expect(result.y).to.be.closeTo(37.944210, 0.000001);
    expect(result.z).to.be.closeTo(38.3, 0.5);
  });
});

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
import { IModelHost } from "../../IModelHost";
import { GcsDbProps, GeoCoordConfig } from "../../GeoCoordConfig";
import { getAvailableVerticalCoordinateReferenceSystems } from "../../GeographicCRSServices";
import { IModelNative } from "../../internal/NativePlatform";
import { _nativeDb } from "../../internal/Symbols";
import { SnapshotDb } from "../../core-backend";
import { SettingsPriority } from "../../workspace/Settings";
import { IModelTestUtils } from "../IModelTestUtils";
import { TestUtils } from "../TestUtils";

const runDevAcceptance = process.env.IMODELJS_VERTICAL_CRS_DEV_TEST === "1" ? describe : describe.skip;
const runProductionAcceptance = ["1", "true", "yes"].includes(process.env.ITWIN_INCLUDE_VERTICAL_CRS_PRODUCTION_TESTS ?? "") ? describe : describe.skip;

runProductionAcceptance("Vertical CRS production workspace acceptance", function () {
  this.timeout(120_000);
  const iModelFileName = IModelTestUtils.prepareOutputFile("VerticalCrsProduction", "VerticalCrsProduction.bim");
  const cacheDir = path.join(path.dirname(iModelFileName), "cache");
  let iModel: SnapshotDb | undefined;

  before(async () => {
    await TestUtils.shutdownBackend();
    fs.rmSync(cacheDir, { recursive: true, force: true });
    await TestUtils.startBackend({ cacheDir, loadGcsWorkspaces: true });
    IModelNative.platform.enableLocalGcsFiles(false);
  });

  after(async () => {
    iModel?.close();
    IModelNative.platform.enableLocalGcsFiles(true);
    await TestUtils.shutdownBackend();
    await TestUtils.startBackend();
  });

  it("enumerates every definition in the production Vertical Datum dictionary", async () => {
    const defaults = IModelHost.appWorkspace.settings.getArray<GcsDbProps>(GeoCoordConfig.settingName.defaultDatabases);
    const baseProps = defaults?.find((entry) => entry.dbName === "base");
    expect(baseProps, "shipped defaults must include the base workspace").not.to.be.undefined;
    const baseDb = await IModelHost.appWorkspace.getWorkspaceDb(baseProps!);
    const dictionaryBlob = baseDb.getBlob("VerticalDatumDefinitions.json");
    expect(dictionaryBlob, "VerticalDatumDefinitions.json is missing from the PROD base workspace").not.to.be.undefined;

    const dictionary = JSON.parse(new TextDecoder().decode(dictionaryBlob)) as {
      definitions: Array<{ verticalCRS: { crsName: string } }>;
    };
    expect(dictionary.definitions).not.to.be.empty;
    const expectedNames = dictionary.definitions.map((entry) => entry.verticalCRS.crsName).sort();
    const actualNames = getAvailableVerticalCoordinateReferenceSystems().map((entry) => entry.crsName).sort();
    expect(actualNames).to.deep.equal(expectedNames);
  });

  it("enumerates and filters vertical systems using production resources", () => {
    const verticalSystems = getAvailableVerticalCoordinateReferenceSystems();
    expect(verticalSystems).not.to.be.empty;
    expect(verticalSystems.some((entry) => entry.crsName === "EGM96 height")).to.be.true;

    const meters = getAvailableVerticalCoordinateReferenceSystems({ unit: "mEtEr" });
    expect(meters).not.to.be.empty;
    expect(meters.every((entry) => entry.unit === "Meter")).to.be.true;
  });

  it("converts EGM96 height to ellipsoid height using production resources", async () => {
    iModel = SnapshotDb.createEmpty(
      iModelFileName,
      { rootSubject: { name: "Vertical CRS PROD acceptance" }, guid: Guid.createValue() },
    );
    const modelCrs = {
      horizontalCRS: { id: "LL84" },
      verticalCRS: { id: "GEOID", crsName: "EGM96 height" },
    } as GeographicCRSProps;
    iModel[_nativeDb].updateIModelProps({ geographicCoordinateSystem: modelCrs } as IModelProps);

    const response = await iModel.getGeoCoordinatesFromIModelCoordinates({
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
    const actualNames = getAvailableVerticalCoordinateReferenceSystems().map((entry) => entry.crsName).sort();

    expect(actualNames).to.deep.equal(expectedNames);
  });

  it("enumerates and converts EGM96 using DEV resources", async () => {
    const verticalSystems = getAvailableVerticalCoordinateReferenceSystems({
      point: { x: 23.700523, y: 37.944210 },
    });
    const egm96 = verticalSystems.find((entry) => entry.crsName === "EGM96 height");

    expect(egm96).not.to.be.undefined;
    expect(egm96!.id).to.equal("GEOID");
    expect(egm96!.epsg).to.equal(5773);
    expect(egm96!.unit).to.equal("Meter");

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

  it("filters by canonical unit name case-insensitively", () => {
    const verticalSystems = getAvailableVerticalCoordinateReferenceSystems({ unit: "mEtEr" });

    expect(verticalSystems).not.to.be.empty;
    expect(verticalSystems.every((entry) => entry.unit === "Meter")).to.be.true;
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as path from "node:path";
import { Guid } from "@itwin/core-bentley";
import { GeoCoordStatus, GeographicCRSProps, IModelProps } from "@itwin/core-common";
import { Point3d } from "@itwin/core-geometry";
import { _nativeDb, GcsDbProps, GeoCoordConfig, getAvailableVerticalCoordinateReferenceSystems, IModelHost, IModelNative, SettingsPriority, SnapshotDb } from "@itwin/core-backend";
import { startupForIntegration } from "./StartupShutdown";

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
  let iModel: SnapshotDb | undefined;

  before(async () => {
    await IModelHost.shutdown();
    await startupForIntegration();
    IModelHost.appWorkspace.settings.addDictionary(
      { name: "vertical-crs-dev-acceptance", priority: SettingsPriority.application },
      {
        [GeoCoordConfig.settingName.defaultDatabases]: [baseDbProps, allEarthDbProps],
      },
    );

    IModelNative.platform.enableLocalGcsFiles(false);
    GeoCoordConfig.loadDefaultDatabases();
    iModel = SnapshotDb.createEmpty(
      path.join(IModelHost.cacheDir, "VerticalCrsDev.bim"),
      { rootSubject: { name: "Vertical CRS DEV acceptance" }, guid: Guid.createValue() },
    );
  });

  after(async () => {
    iModel?.close();
    IModelNative.platform.enableLocalGcsFiles(true);
    await IModelHost.shutdown();
    await startupForIntegration();
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
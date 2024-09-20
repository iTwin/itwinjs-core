/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { OrbitGtBlobProps, RealityDataFormat, RealityDataProvider, RealityDataSourceKey } from "@itwin/core-common";
import { describe, expect, it } from "vitest";
import { CesiumIonAssetProvider, getCesiumAssetUrl } from "../core-frontend";
import { RealityDataSource } from "../RealityDataSource";

describe("RealityDataSource", () => {
  it("should handle creation from empty url", () => {
    const tilesetUrl = "";
    const rdSourceKey = RealityDataSource.createKeyFromUrl(tilesetUrl);
    expect(rdSourceKey.provider).toEqual(RealityDataProvider.TilesetUrl);
    expect(rdSourceKey.format).toEqual(RealityDataFormat.ThreeDTile);
    expect(rdSourceKey.id).toEqual(tilesetUrl);
    expect(rdSourceKey.iTwinId).toBeUndefined();
    const rdSourceKeyStr = RealityDataSourceKey.convertToString(rdSourceKey);
    expect(rdSourceKeyStr).toEqual("TilesetUrl:ThreeDTile::undefined");
  });
  it("should handle creation from CesiumIonAsset url", () => {
    const tilesetUrl = "$CesiumIonAsset=";
    const rdSourceKey = RealityDataSource.createKeyFromUrl(tilesetUrl);
    expect(rdSourceKey.provider).toEqual(RealityDataProvider.CesiumIonAsset);
    expect(rdSourceKey.format).toEqual(RealityDataFormat.ThreeDTile);
    // dummy id for CesiumIonAsset, we want to hide the url and key
    expect(rdSourceKey.id).toEqual(CesiumIonAssetProvider.osmBuildingId);
    expect(rdSourceKey.iTwinId).toBeUndefined();
    const rdSourceKeyStr = RealityDataSourceKey.convertToString(rdSourceKey);
    expect(rdSourceKeyStr).toEqual("CesiumIonAsset:ThreeDTile:OSMBuildings:undefined");
  });
  it("should handle creation from any CesiumIonAsset url (not OSM Building)", () => {
    const rdSourceKey = RealityDataSource.createCesiumIonAssetKey(75343, "ThisIsADummyCesiumIonKey");
    expect(rdSourceKey.provider).toEqual(RealityDataProvider.CesiumIonAsset);
    expect(rdSourceKey.format).toEqual(RealityDataFormat.ThreeDTile);
    const tilesetUrl = getCesiumAssetUrl(75343, "ThisIsADummyCesiumIonKey");
    expect(rdSourceKey.id).toEqual(tilesetUrl);
    expect(rdSourceKey.iTwinId).toBeUndefined();
    const rdSourceKeyStr = RealityDataSourceKey.convertToString(rdSourceKey);
    expect(rdSourceKeyStr).toEqual(`CesiumIonAsset:ThreeDTile:${tilesetUrl}:undefined`);
    // Key createdFromUrl should be equal to key created from call to createCesiumIonAssetKey
    const rdSourceKeyFromURL = RealityDataSource.createKeyFromUrl(tilesetUrl);
    expect(rdSourceKeyFromURL.id).toEqual(rdSourceKey.id);
    expect(rdSourceKeyFromURL.iTwinId).toEqual(rdSourceKey.iTwinId);
    expect(rdSourceKeyFromURL.format).toEqual(rdSourceKey.format);
    expect(rdSourceKeyFromURL.provider).toEqual(rdSourceKey.provider);
    const rdSourceKeyFromURLStr = RealityDataSourceKey.convertToString(rdSourceKeyFromURL);
    expect(rdSourceKeyFromURLStr).toEqual(`CesiumIonAsset:ThreeDTile:${tilesetUrl}:undefined`);
  });
  it("should handle creation from Context Share url", () => {
    const tilesetUrl = "https://connect-realitydataservices.bentley.com/v2.9/Repositories/S3MXECPlugin--5b4ebd22-d94b-456b-8bd8-d59563de9acd/S3MX/RealityData/994fc408-401f-4ee1-91f0-3d7bfba50136";
    const rdSourceKey = RealityDataSource.createKeyFromUrl(tilesetUrl);
    expect(rdSourceKey.provider).toEqual(RealityDataProvider.ContextShare);
    expect(rdSourceKey.format).toEqual(RealityDataFormat.ThreeDTile);
    expect(rdSourceKey.id).toEqual("994fc408-401f-4ee1-91f0-3d7bfba50136");
    expect(rdSourceKey.iTwinId).toEqual("5b4ebd22-d94b-456b-8bd8-d59563de9acd");
    const rdSourceKeyStr = RealityDataSourceKey.convertToString(rdSourceKey);
    expect(rdSourceKeyStr).toEqual("ContextShare:ThreeDTile:994fc408-401f-4ee1-91f0-3d7bfba50136:5b4ebd22-d94b-456b-8bd8-d59563de9acd");
  });
  it("should handle creation from Context Share url with server context", () => {
    const tilesetUrl = "https://connect-realitydataservices.bentley.com/v2.9/Repositories/S3MXECPlugin--server/S3MX/RealityData/994fc408-401f-4ee1-91f0-3d7bfba50136";
    const rdSourceKey = RealityDataSource.createKeyFromUrl(tilesetUrl);
    expect(rdSourceKey.provider).toEqual(RealityDataProvider.ContextShare);
    expect(rdSourceKey.format).toEqual(RealityDataFormat.ThreeDTile);
    expect(rdSourceKey.id).toEqual("994fc408-401f-4ee1-91f0-3d7bfba50136");
    expect(rdSourceKey.iTwinId).toEqual("server");
    const rdSourceKeyStr = RealityDataSourceKey.convertToString(rdSourceKey);
    expect(rdSourceKeyStr).toEqual("ContextShare:ThreeDTile:994fc408-401f-4ee1-91f0-3d7bfba50136:server");
  });
  it("should handle creation from Context Share url with empty guid context", () => {
    const tilesetUrl = "https://connect-realitydataservices.bentley.com/v2.9/Repositories/S3MXECPlugin--00000000-0000-0000-0000-000000000000/S3MX/RealityData/994fc408-401f-4ee1-91f0-3d7bfba50136";
    const rdSourceKey = RealityDataSource.createKeyFromUrl(tilesetUrl);
    expect(rdSourceKey.provider).toEqual(RealityDataProvider.ContextShare);
    expect(rdSourceKey.format).toEqual(RealityDataFormat.ThreeDTile);
    expect(rdSourceKey.id).toEqual("994fc408-401f-4ee1-91f0-3d7bfba50136");
    expect(rdSourceKey.iTwinId).toEqual("00000000-0000-0000-0000-000000000000");
    const rdSourceKeyStr = RealityDataSourceKey.convertToString(rdSourceKey);
    expect(rdSourceKeyStr).toEqual("ContextShare:ThreeDTile:994fc408-401f-4ee1-91f0-3d7bfba50136:00000000-0000-0000-0000-000000000000");
  });
  it("should handle creation from Context Share url using Reality Data apim in QA (qa-api.bentley.com)", () => {
    const tilesetUrl = "https://qa-api.bentley.com/realitydata/c9fddf2c-e519-468b-b6fa-6d0e39f198a7?projectId=a57f6b1c-747d-4253-b0ce-9900c4dd7c1c";
    const rdSourceKey = RealityDataSource.createKeyFromUrl(tilesetUrl);
    expect(rdSourceKey.provider).toEqual(RealityDataProvider.ContextShare);
    expect(rdSourceKey.format).toEqual(RealityDataFormat.ThreeDTile);
    expect(rdSourceKey.id).toEqual("c9fddf2c-e519-468b-b6fa-6d0e39f198a7");
    expect(rdSourceKey.iTwinId).toEqual("a57f6b1c-747d-4253-b0ce-9900c4dd7c1c");
    const rdSourceKeyStr = RealityDataSourceKey.convertToString(rdSourceKey);
    expect(rdSourceKeyStr).toEqual("ContextShare:ThreeDTile:c9fddf2c-e519-468b-b6fa-6d0e39f198a7:a57f6b1c-747d-4253-b0ce-9900c4dd7c1c");
  });
  it("should handle creation from Context Share url using Reality Data apim in PROD (api.bentley.com)", () => {
    const tilesetUrl = "https://api.bentley.com/realitydata/c9fddf2c-e519-468b-b6fa-6d0e39f198a7?projectId=a57f6b1c-747d-4253-b0ce-9900c4dd7c1c";
    const rdSourceKey = RealityDataSource.createKeyFromUrl(tilesetUrl);
    expect(rdSourceKey.provider).toEqual(RealityDataProvider.ContextShare);
    expect(rdSourceKey.format).toEqual(RealityDataFormat.ThreeDTile);
    expect(rdSourceKey.id).toEqual("c9fddf2c-e519-468b-b6fa-6d0e39f198a7");
    expect(rdSourceKey.iTwinId).toEqual("a57f6b1c-747d-4253-b0ce-9900c4dd7c1c");
    const rdSourceKeyStr = RealityDataSourceKey.convertToString(rdSourceKey);
    expect(rdSourceKeyStr).toEqual("ContextShare:ThreeDTile:c9fddf2c-e519-468b-b6fa-6d0e39f198a7:a57f6b1c-747d-4253-b0ce-9900c4dd7c1c");
  });
  it("should handle creation from Context Share url using Reality Management apim in QA (qa-api.bentley.com)", () => {
    const tilesetUrl = "https://qa-api.bentley.com/reality-management/reality-data/c9fddf2c-e519-468b-b6fa-6d0e39f198a7?iTwinId=a57f6b1c-747d-4253-b0ce-9900c4dd7c1c";
    const rdSourceKey = RealityDataSource.createKeyFromUrl(tilesetUrl);
    expect(rdSourceKey.provider).toEqual(RealityDataProvider.ContextShare);
    expect(rdSourceKey.format).toEqual(RealityDataFormat.ThreeDTile);
    expect(rdSourceKey.id).toEqual("c9fddf2c-e519-468b-b6fa-6d0e39f198a7");
    expect(rdSourceKey.iTwinId).toEqual("a57f6b1c-747d-4253-b0ce-9900c4dd7c1c");
    const rdSourceKeyStr = RealityDataSourceKey.convertToString(rdSourceKey);
    expect(rdSourceKeyStr).toEqual("ContextShare:ThreeDTile:c9fddf2c-e519-468b-b6fa-6d0e39f198a7:a57f6b1c-747d-4253-b0ce-9900c4dd7c1c");
  });
  it("should handle creation from Context Share url using Reality Management apim in PROD (api.bentley.com)", () => {
    const tilesetUrl = "https://api.bentley.com/reality-management/reality-data/c9fddf2c-e519-468b-b6fa-6d0e39f198a7?iTwinId=a57f6b1c-747d-4253-b0ce-9900c4dd7c1c";
    const rdSourceKey = RealityDataSource.createKeyFromUrl(tilesetUrl);
    expect(rdSourceKey.provider).toEqual(RealityDataProvider.ContextShare);
    expect(rdSourceKey.format).toEqual(RealityDataFormat.ThreeDTile);
    expect(rdSourceKey.id).toEqual("c9fddf2c-e519-468b-b6fa-6d0e39f198a7");
    expect(rdSourceKey.iTwinId).toEqual("a57f6b1c-747d-4253-b0ce-9900c4dd7c1c");
    const rdSourceKeyStr = RealityDataSourceKey.convertToString(rdSourceKey);
    expect(rdSourceKeyStr).toEqual("ContextShare:ThreeDTile:c9fddf2c-e519-468b-b6fa-6d0e39f198a7:a57f6b1c-747d-4253-b0ce-9900c4dd7c1c");
  });
  it("should handle creation from url to an .opc file on an azure blob", () => {
    const tilesetUrl = "https://realityblobqaeussa01.blob.core.windows.net/fe8d32a5-f6ab-4157-b3ec-a9b53db923e3/Tuxford.opc?sv=2020-08-04&se=2021-08-26T05%3A11%3A31Z&sr=c&sp=rl&sig=J9wGT1f3nyKePPj%2FI%2BJdx086GylEfM0P4ZXBQL%2FaRD4%3D";
    const rdSourceKey = RealityDataSource.createKeyFromBlobUrl(tilesetUrl);
    expect(rdSourceKey.provider).toEqual(RealityDataProvider.ContextShare);
    expect(rdSourceKey.format).toEqual(RealityDataFormat.OPC);
    expect(rdSourceKey.id).toEqual("fe8d32a5-f6ab-4157-b3ec-a9b53db923e3");
    expect(rdSourceKey.iTwinId).toBeUndefined();
    const rdSourceKeyStr = RealityDataSourceKey.convertToString(rdSourceKey);
    expect(rdSourceKeyStr).toEqual("ContextShare:OPC:fe8d32a5-f6ab-4157-b3ec-a9b53db923e3:undefined");
  });
  it("should handle creation from url to any http server", () => {
    const tilesetUrl = "https://customserver/myFile.json";
    const rdSourceKey = RealityDataSource.createKeyFromUrl(tilesetUrl);
    expect(rdSourceKey.provider).toEqual(RealityDataProvider.TilesetUrl);
    expect(rdSourceKey.format).toEqual(RealityDataFormat.ThreeDTile);
    expect(rdSourceKey.id).toEqual(tilesetUrl);
    expect(rdSourceKey.iTwinId).toBeUndefined();
    const rdSourceKeyStr = RealityDataSourceKey.convertToString(rdSourceKey);
    expect(rdSourceKeyStr).toEqual("TilesetUrl:ThreeDTile:https://customserver/myFile.json:undefined");
  });
  it("should handle creation from url to any local file", () => {
    const tilesetUrl = "c:\\customserver\\myFile.json";
    const rdSourceKey = RealityDataSource.createKeyFromUrl(tilesetUrl);
    expect(rdSourceKey.provider).toEqual(RealityDataProvider.TilesetUrl);
    expect(rdSourceKey.format).toEqual(RealityDataFormat.ThreeDTile);
    expect(rdSourceKey.id).toEqual(tilesetUrl);
    expect(rdSourceKey.iTwinId).toBeUndefined();
    const rdSourceKeyStr = RealityDataSourceKey.convertToString(rdSourceKey);
    expect(rdSourceKeyStr).toEqual("TilesetUrl:ThreeDTile:c:\\customserver\\myFile.json:undefined");
  });
  it("should handle creation from url to an OPC local file", () => {
    // we detect format based on extension-> .opc -> OPC format, otherwise 3dTile
    const tilesetUrl = "c:\\customserver\\myFile.opc";
    const rdSourceKey = RealityDataSource.createKeyFromUrl(tilesetUrl);
    expect(rdSourceKey.provider).toEqual(RealityDataProvider.TilesetUrl);
    expect(rdSourceKey.format).toEqual(RealityDataFormat.OPC);
    expect(rdSourceKey.id).toEqual(tilesetUrl);
    expect(rdSourceKey.iTwinId).toBeUndefined();
    const rdSourceKeyStr = RealityDataSourceKey.convertToString(rdSourceKey);
    expect(rdSourceKeyStr).toEqual("TilesetUrl:OPC:c:\\customserver\\myFile.opc:undefined");
  });
  it("should handle invalid url and fallback to simply returns it in id as tileset url", () => {
    const tilesetUrl = "Anything that is not a valid url";
    const rdSourceKey = RealityDataSource.createKeyFromUrl(tilesetUrl);
    expect(rdSourceKey.provider).toEqual(RealityDataProvider.TilesetUrl);
    expect(rdSourceKey.format).toEqual(RealityDataFormat.ThreeDTile);
    expect(rdSourceKey.id).toEqual(tilesetUrl);
    expect(rdSourceKey.iTwinId).toBeUndefined();
    const rdSourceKeyStr = RealityDataSourceKey.convertToString(rdSourceKey);
    expect(rdSourceKeyStr).toEqual("TilesetUrl:ThreeDTile:Anything that is not a valid url:undefined");
  });
  it("should handle creation from Context Share url with provider override", () => {
    const tilesetUrl = "https://connect-realitydataservices.bentley.com/v2.9/Repositories/S3MXECPlugin--5b4ebd22-d94b-456b-8bd8-d59563de9acd/S3MX/RealityData/994fc408-401f-4ee1-91f0-3d7bfba50136";
    const forceProvider = RealityDataProvider.TilesetUrl;
    const rdSourceKey = RealityDataSource.createKeyFromUrl(tilesetUrl, forceProvider);
    expect(rdSourceKey.provider).toEqual(forceProvider);
    expect(rdSourceKey.format).toEqual(RealityDataFormat.ThreeDTile);
    expect(rdSourceKey.id).toEqual("994fc408-401f-4ee1-91f0-3d7bfba50136");
    expect(rdSourceKey.iTwinId).toEqual("5b4ebd22-d94b-456b-8bd8-d59563de9acd");
    const rdSourceKeyStr = RealityDataSourceKey.convertToString(rdSourceKey);
    expect(rdSourceKeyStr).toEqual("TilesetUrl:ThreeDTile:994fc408-401f-4ee1-91f0-3d7bfba50136:5b4ebd22-d94b-456b-8bd8-d59563de9acd");
  });
  it("should handle creation from Context Share url with format override", () => {
    const tilesetUrl = "https://connect-realitydataservices.bentley.com/v2.9/Repositories/S3MXECPlugin--5b4ebd22-d94b-456b-8bd8-d59563de9acd/S3MX/RealityData/994fc408-401f-4ee1-91f0-3d7bfba50136";
    const forceFormat = RealityDataFormat.OPC;
    const rdSourceKey = RealityDataSource.createKeyFromUrl(tilesetUrl, undefined, forceFormat);
    expect(rdSourceKey.provider).toEqual(RealityDataProvider.ContextShare);
    expect(rdSourceKey.format).toEqual(forceFormat);
    expect(rdSourceKey.id).toEqual("994fc408-401f-4ee1-91f0-3d7bfba50136");
    expect(rdSourceKey.iTwinId).toEqual("5b4ebd22-d94b-456b-8bd8-d59563de9acd");
    const rdSourceKeyStr = RealityDataSourceKey.convertToString(rdSourceKey);
    expect(rdSourceKeyStr).toEqual("ContextShare:OPC:994fc408-401f-4ee1-91f0-3d7bfba50136:5b4ebd22-d94b-456b-8bd8-d59563de9acd");
  });

  it("should handle creation from a blob url to an .opc file on an azure blob", () => {
    const blobUrl = "https://realityblobqaeussa01.blob.core.windows.net/fe8d32a5-f6ab-4157-b3ec-a9b53db923e3/Tuxford.opc?sv=2020-08-04&se=2021-08-26T05%3A11%3A31Z&sr=c&sp=rl&sig=J9wGT1f3nyKePPj%2FI%2BJdx086GylEfM0P4ZXBQL%2FaRD4%3D";
    const rdSourceKey = RealityDataSource.createKeyFromBlobUrl(blobUrl);
    expect(rdSourceKey.provider).toEqual(RealityDataProvider.ContextShare);
    expect(rdSourceKey.format).toEqual(RealityDataFormat.OPC);
    expect(rdSourceKey.id).toEqual("fe8d32a5-f6ab-4157-b3ec-a9b53db923e3");
    expect(rdSourceKey.iTwinId).toBeUndefined();
    const rdSourceKeyStr = RealityDataSourceKey.convertToString(rdSourceKey);
    expect(rdSourceKeyStr).toEqual("ContextShare:OPC:fe8d32a5-f6ab-4157-b3ec-a9b53db923e3:undefined");
  });
  it("should handle creation from blob url with provider override", () => {
    const blobUrl = "https://realityblobqaeussa01.blob.core.windows.net/fe8d32a5-f6ab-4157-b3ec-a9b53db923e3/Tuxford.opc?sv=2020-08-04&se=2021-08-26T05%3A11%3A31Z&sr=c&sp=rl&sig=J9wGT1f3nyKePPj%2FI%2BJdx086GylEfM0P4ZXBQL%2FaRD4%3D";
    const forceProvider = RealityDataProvider.TilesetUrl;
    const rdSourceKey = RealityDataSource.createKeyFromBlobUrl(blobUrl, forceProvider);
    expect(rdSourceKey.provider).toEqual(forceProvider);
    expect(rdSourceKey.format).toEqual(RealityDataFormat.OPC);
    expect(rdSourceKey.id).toEqual("fe8d32a5-f6ab-4157-b3ec-a9b53db923e3");
    expect(rdSourceKey.iTwinId).toBeUndefined();
    const rdSourceKeyStr = RealityDataSourceKey.convertToString(rdSourceKey);
    expect(rdSourceKeyStr).toEqual("TilesetUrl:OPC:fe8d32a5-f6ab-4157-b3ec-a9b53db923e3:undefined");
  });
  it("should handle creation from blob url with format override", () => {
    const blobUrl = "https://realityblobqaeussa01.blob.core.windows.net/fe8d32a5-f6ab-4157-b3ec-a9b53db923e3/Tuxford.opc?sv=2020-08-04&se=2021-08-26T05%3A11%3A31Z&sr=c&sp=rl&sig=J9wGT1f3nyKePPj%2FI%2BJdx086GylEfM0P4ZXBQL%2FaRD4%3D";
    const forceFormat = RealityDataFormat.ThreeDTile;
    const rdSourceKey = RealityDataSource.createKeyFromBlobUrl(blobUrl, undefined, forceFormat);
    expect(rdSourceKey.provider).toEqual(RealityDataProvider.ContextShare);
    expect(rdSourceKey.format).toEqual(forceFormat);
    expect(rdSourceKey.id).toEqual("fe8d32a5-f6ab-4157-b3ec-a9b53db923e3");
    expect(rdSourceKey.iTwinId).toBeUndefined();
    const rdSourceKeyStr = RealityDataSourceKey.convertToString(rdSourceKey);
    expect(rdSourceKeyStr).toEqual("ContextShare:ThreeDTile:fe8d32a5-f6ab-4157-b3ec-a9b53db923e3:undefined");
  });
  it("should handle creation from orbitGtBlobProps", () => {
    const orbitGtBlob: OrbitGtBlobProps = {
      accountName: "ocpalphaeudata001",
      containerName: "a5932aa8-2fde-470d-b5ab-637412ec4e49",
      blobFileName: "/datasources/0b2ad731-ec01-4b8b-8f0f-c99a593f1ff3/Seinajoki_Trees_utm.opc",
      sasToken: "sig=EaHCCCSX6bWw%2FOHgad%2Fn3VCgUs2gPbDn%2BE2p5osMYIg%3D&se=2022-01-11T12%3A01%3A20Z&sv=2019-02-02&sp=r&sr=b",
    };
    const rdSourceKey = RealityDataSource.createKeyFromOrbitGtBlobProps(orbitGtBlob);
    expect(rdSourceKey.provider).toEqual(RealityDataProvider.OrbitGtBlob);
    expect(rdSourceKey.format).toEqual(RealityDataFormat.OPC);
    expect(rdSourceKey.id).toEqual(
      "ocpalphaeudata001:a5932aa8-2fde-470d-b5ab-637412ec4e49:/datasources/0b2ad731-ec01-4b8b-8f0f-c99a593f1ff3/Seinajoki_Trees_utm.opc:?sig=EaHCCCSX6bWw%2FOHgad%2Fn3VCgUs2gPbDn%2BE2p5osMYIg%3D&se=2022-01-11T12%3A01%3A20Z&sv=2019-02-02&sp=r&sr=b",
    );
    expect(rdSourceKey.iTwinId).toBeUndefined();
    const rdSourceKeyStr = RealityDataSourceKey.convertToString(rdSourceKey);
    expect(rdSourceKeyStr).toEqual(
      "OrbitGtBlob:OPC:ocpalphaeudata001:a5932aa8-2fde-470d-b5ab-637412ec4e49:/datasources/0b2ad731-ec01-4b8b-8f0f-c99a593f1ff3/Seinajoki_Trees_utm.opc:?sig=EaHCCCSX6bWw%2FOHgad%2Fn3VCgUs2gPbDn%2BE2p5osMYIg%3D&se=2022-01-11T12%3A01%3A20Z&sv=2019-02-02&sp=r&sr=b:undefined",
    );
    const orbitGtBlobFromKey = RealityDataSource.createOrbitGtBlobPropsFromKey(rdSourceKey);
    expect(orbitGtBlobFromKey).toBeDefined();
    if (orbitGtBlobFromKey !== undefined) {
      expect(orbitGtBlob.accountName).toEqual(orbitGtBlobFromKey.accountName);
      expect(orbitGtBlob.containerName).toEqual(orbitGtBlobFromKey.containerName);
      expect(orbitGtBlob.blobFileName).toEqual(orbitGtBlobFromKey.blobFileName);
      expect(orbitGtBlob.sasToken).toEqual(orbitGtBlobFromKey.sasToken);
    }
  });
  it("should handle creation from orbitGtBlobProps when blobFilename is http or https", () => {
    const orbitGtBlob: OrbitGtBlobProps = {
      accountName: "",
      containerName: "fe8d32a5-f6ab-4157-b3ec-a9b53db923e3",
      blobFileName: "https://realityblobqaeussa01.blob.core.windows.net/fe8d32a5-f6ab-4157-b3ec-a9b53db923e3/Tuxford.opc?sv=2020-08-04&se=2021-08-26T05%3A11%3A31Z&sr=c&sp=rl&sig=J9wGT1f3nyKePPj%2FI%2BJdx086GylEfM0P4ZXBQL%2FaRD4%3D",
      sasToken: "",
    };
    const rdSourceKey = RealityDataSource.createKeyFromOrbitGtBlobProps(orbitGtBlob);
    expect(rdSourceKey.provider).toEqual(RealityDataProvider.ContextShare);
    expect(rdSourceKey.format).toEqual(RealityDataFormat.OPC);
    expect(rdSourceKey.id).toEqual("fe8d32a5-f6ab-4157-b3ec-a9b53db923e3");
    expect(rdSourceKey.iTwinId).toBeUndefined();
    const orbitGtBlobFromKey = RealityDataSource.createOrbitGtBlobPropsFromKey(rdSourceKey);
    expect(orbitGtBlobFromKey).toBeUndefined();
    const rdSourceKeyStr = RealityDataSourceKey.convertToString(rdSourceKey);
    expect(rdSourceKeyStr).toEqual("ContextShare:OPC:fe8d32a5-f6ab-4157-b3ec-a9b53db923e3:undefined");
  });
  it("should handle creation from orbitGtBlobProps when rdsUrl is defined", () => {
    const orbitGtBlob: OrbitGtBlobProps = {
      rdsUrl: "https://connect-realitydataservices.bentley.com/v2.9/Repositories/S3MXECPlugin--5b4ebd22-d94b-456b-8bd8-d59563de9acd/S3MX/RealityData/994fc408-401f-4ee1-91f0-3d7bfba50136",
      accountName: "",
      containerName: "",
      blobFileName: "",
      sasToken: "",
    };
    const rdSourceKey = RealityDataSource.createKeyFromOrbitGtBlobProps(orbitGtBlob);
    expect(rdSourceKey.provider).toEqual(RealityDataProvider.ContextShare);
    expect(rdSourceKey.format).toEqual(RealityDataFormat.OPC);
    expect(rdSourceKey.id).toEqual("994fc408-401f-4ee1-91f0-3d7bfba50136");
    expect(rdSourceKey.iTwinId).toEqual("5b4ebd22-d94b-456b-8bd8-d59563de9acd");
    const orbitGtBlobFromKey = RealityDataSource.createOrbitGtBlobPropsFromKey(rdSourceKey);
    expect(orbitGtBlobFromKey).toBeUndefined();
    const rdSourceKeyStr = RealityDataSourceKey.convertToString(rdSourceKey);
    expect(rdSourceKeyStr).toEqual("ContextShare:OPC:994fc408-401f-4ee1-91f0-3d7bfba50136:5b4ebd22-d94b-456b-8bd8-d59563de9acd");
  });
});

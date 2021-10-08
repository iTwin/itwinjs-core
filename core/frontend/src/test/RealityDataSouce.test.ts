/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { RealityDataFormat, RealityDataProvider } from "@itwin/core-common";
import { expect } from "chai";
import { RealityDataSource } from "../RealityDataSource";

describe("RealityDataSource", () => {
  it("should handle creation from empty url", () => {
    const tilesetUrl = "";
    const rdSourceKey = RealityDataSource.createRealityDataSourceKeyFromUrl(tilesetUrl);
    expect(rdSourceKey.provider).to.equal(RealityDataProvider.TilesetUrl);
    expect(rdSourceKey.format).to.equal(RealityDataFormat.ThreeDTile);
    expect(rdSourceKey.id).to.be.equal(tilesetUrl);
    expect(rdSourceKey.iTwinId).to.be.undefined;
  });
  it("should handle creation from CesiumIonAsset url", () => {
    const tilesetUrl = "$CesiumIonAsset=";
    const rdSourceKey = RealityDataSource.createRealityDataSourceKeyFromUrl(tilesetUrl);
    expect(rdSourceKey.provider).to.equal(RealityDataProvider.CesiumIonAsset);
    expect(rdSourceKey.format).to.equal(RealityDataFormat.ThreeDTile);
    expect(rdSourceKey.id).to.be.equal(tilesetUrl);
    expect(rdSourceKey.iTwinId).to.be.undefined;
  });
  it("should handle creation from Context Share url", () => {
    const tilesetUrl = "https://connect-realitydataservices.bentley.com/v2.9/Repositories/S3MXECPlugin--5b4ebd22-d94b-456b-8bd8-d59563de9acd/S3MX/RealityData/994fc408-401f-4ee1-91f0-3d7bfba50136";
    const rdSourceKey = RealityDataSource.createRealityDataSourceKeyFromUrl(tilesetUrl);
    expect(rdSourceKey.provider).to.equal(RealityDataProvider.ContextShare);
    expect(rdSourceKey.format).to.equal(RealityDataFormat.ThreeDTile);
    expect(rdSourceKey.id).to.be.equal("994fc408-401f-4ee1-91f0-3d7bfba50136");
    expect(rdSourceKey.iTwinId).to.equal("5b4ebd22-d94b-456b-8bd8-d59563de9acd");
  });
  it("should handle creation from Context Share url with server context", () => {
    const tilesetUrl = "https://connect-realitydataservices.bentley.com/v2.9/Repositories/S3MXECPlugin--server/S3MX/RealityData/994fc408-401f-4ee1-91f0-3d7bfba50136";
    const rdSourceKey = RealityDataSource.createRealityDataSourceKeyFromUrl(tilesetUrl);
    expect(rdSourceKey.provider).to.equal(RealityDataProvider.ContextShare);
    expect(rdSourceKey.format).to.equal(RealityDataFormat.ThreeDTile);
    expect(rdSourceKey.id).to.be.equal("994fc408-401f-4ee1-91f0-3d7bfba50136");
    expect(rdSourceKey.iTwinId).to.equal("server");
  });
  it("should handle creation from Context Share url with empty guid context", () => {
    const tilesetUrl = "https://connect-realitydataservices.bentley.com/v2.9/Repositories/S3MXECPlugin--00000000-0000-0000-0000-000000000000/S3MX/RealityData/994fc408-401f-4ee1-91f0-3d7bfba50136";
    const rdSourceKey = RealityDataSource.createRealityDataSourceKeyFromUrl(tilesetUrl);
    expect(rdSourceKey.provider).to.equal(RealityDataProvider.ContextShare);
    expect(rdSourceKey.format).to.equal(RealityDataFormat.ThreeDTile);
    expect(rdSourceKey.id).to.be.equal("994fc408-401f-4ee1-91f0-3d7bfba50136");
    expect(rdSourceKey.iTwinId).to.equal("00000000-0000-0000-0000-000000000000");
  });
  it("should handle creation from url to an .opc file on an azure blob", () => {
    const tilesetUrl = "https://realityblobqaeussa01.blob.core.windows.net/fe8d32a5-f6ab-4157-b3ec-a9b53db923e3/Tuxford.opc?sv=2020-08-04&se=2021-08-26T05%3A11%3A31Z&sr=c&sp=rl&sig=J9wGT1f3nyKePPj%2FI%2BJdx086GylEfM0P4ZXBQL%2FaRD4%3D";
    const rdSourceKey = RealityDataSource.createRealityDataSourceKeyFromUrl(tilesetUrl);
    expect(rdSourceKey.provider).to.equal(RealityDataProvider.ContextShare);
    expect(rdSourceKey.format).to.equal(RealityDataFormat.OPC);
    expect(rdSourceKey.id).to.be.equal("fe8d32a5-f6ab-4157-b3ec-a9b53db923e3");
    expect(rdSourceKey.iTwinId).to.be.undefined;
  });
  it("should handle creation from url to any http server", () => {
    const tilesetUrl = "https://customserver/myFile.json";
    const rdSourceKey = RealityDataSource.createRealityDataSourceKeyFromUrl(tilesetUrl);
    expect(rdSourceKey.provider).to.equal(RealityDataProvider.TilesetUrl);
    expect(rdSourceKey.format).to.equal(RealityDataFormat.ThreeDTile);
    expect(rdSourceKey.id).to.be.equal(tilesetUrl);
    expect(rdSourceKey.iTwinId).to.be.undefined;
  });
  it("should handle creation from url to any local file", () => {
    const tilesetUrl = "c:\\customserver\\myFile.json";
    const rdSourceKey = RealityDataSource.createRealityDataSourceKeyFromUrl(tilesetUrl);
    expect(rdSourceKey.provider).to.equal(RealityDataProvider.TilesetUrl);
    expect(rdSourceKey.format).to.equal(RealityDataFormat.ThreeDTile);
    expect(rdSourceKey.id).to.be.equal(tilesetUrl);
    expect(rdSourceKey.iTwinId).to.be.undefined;
  });
  it("should handle invalid url and fallback to simply returns it in id as tileset url", () => {
    const tilesetUrl = "Anything that is not a valid url";
    const rdSourceKey = RealityDataSource.createRealityDataSourceKeyFromUrl(tilesetUrl);
    expect(rdSourceKey.provider).to.equal(RealityDataProvider.TilesetUrl);
    expect(rdSourceKey.format).to.equal(RealityDataFormat.ThreeDTile);
    expect(rdSourceKey.id).to.be.equal(tilesetUrl);
    expect(rdSourceKey.iTwinId).to.be.undefined;
  });
  it("should handle creation from Context Share url with provider override", () => {
    const tilesetUrl = "https://connect-realitydataservices.bentley.com/v2.9/Repositories/S3MXECPlugin--5b4ebd22-d94b-456b-8bd8-d59563de9acd/S3MX/RealityData/994fc408-401f-4ee1-91f0-3d7bfba50136";
    const forceProvider = RealityDataProvider.TilesetUrl;
    const rdSourceKey = RealityDataSource.createRealityDataSourceKeyFromUrl(tilesetUrl, forceProvider);
    expect(rdSourceKey.provider).to.equal(forceProvider);
    expect(rdSourceKey.format).to.equal(RealityDataFormat.ThreeDTile);
    expect(rdSourceKey.id).to.be.equal("994fc408-401f-4ee1-91f0-3d7bfba50136");
    expect(rdSourceKey.iTwinId).to.equal("5b4ebd22-d94b-456b-8bd8-d59563de9acd");
  });
  it("should handle creation from Context Share url with format override", () => {
    const tilesetUrl = "https://connect-realitydataservices.bentley.com/v2.9/Repositories/S3MXECPlugin--5b4ebd22-d94b-456b-8bd8-d59563de9acd/S3MX/RealityData/994fc408-401f-4ee1-91f0-3d7bfba50136";
    const forceFormat = RealityDataFormat.OPC;
    const rdSourceKey = RealityDataSource.createRealityDataSourceKeyFromUrl(tilesetUrl, undefined, forceFormat);
    expect(rdSourceKey.provider).to.equal(RealityDataProvider.ContextShare);
    expect(rdSourceKey.format).to.equal(forceFormat);
    expect(rdSourceKey.id).to.be.equal("994fc408-401f-4ee1-91f0-3d7bfba50136");
    expect(rdSourceKey.iTwinId).to.equal("5b4ebd22-d94b-456b-8bd8-d59563de9acd");
  });

  it("should handle creation from a blob url to an .opc file on an azure blob", () => {
    const blobUrl = "https://realityblobqaeussa01.blob.core.windows.net/fe8d32a5-f6ab-4157-b3ec-a9b53db923e3/Tuxford.opc?sv=2020-08-04&se=2021-08-26T05%3A11%3A31Z&sr=c&sp=rl&sig=J9wGT1f3nyKePPj%2FI%2BJdx086GylEfM0P4ZXBQL%2FaRD4%3D";
    const rdSourceKey = RealityDataSource.createFromBlobUrl(blobUrl);
    expect(rdSourceKey.provider).to.equal(RealityDataProvider.ContextShare);
    expect(rdSourceKey.format).to.equal(RealityDataFormat.OPC);
    expect(rdSourceKey.id).to.be.equal("fe8d32a5-f6ab-4157-b3ec-a9b53db923e3");
    expect(rdSourceKey.iTwinId).to.be.undefined;
  });
  it("should handle creation from blob url with provider override", () => {
    const blobUrl = "https://realityblobqaeussa01.blob.core.windows.net/fe8d32a5-f6ab-4157-b3ec-a9b53db923e3/Tuxford.opc?sv=2020-08-04&se=2021-08-26T05%3A11%3A31Z&sr=c&sp=rl&sig=J9wGT1f3nyKePPj%2FI%2BJdx086GylEfM0P4ZXBQL%2FaRD4%3D";
    const forceProvider = RealityDataProvider.TilesetUrl;
    const rdSourceKey = RealityDataSource.createFromBlobUrl(blobUrl, forceProvider);
    expect(rdSourceKey.provider).to.equal(forceProvider);
    expect(rdSourceKey.format).to.equal(RealityDataFormat.OPC);
    expect(rdSourceKey.id).to.be.equal("fe8d32a5-f6ab-4157-b3ec-a9b53db923e3");
    expect(rdSourceKey.iTwinId).to.be.undefined;
  });
  it("should handle creation from blob url with format override", () => {
    const blobUrl = "https://realityblobqaeussa01.blob.core.windows.net/fe8d32a5-f6ab-4157-b3ec-a9b53db923e3/Tuxford.opc?sv=2020-08-04&se=2021-08-26T05%3A11%3A31Z&sr=c&sp=rl&sig=J9wGT1f3nyKePPj%2FI%2BJdx086GylEfM0P4ZXBQL%2FaRD4%3D";
    const forceFormat = RealityDataFormat.ThreeDTile;
    const rdSourceKey = RealityDataSource.createFromBlobUrl(blobUrl, undefined, forceFormat);
    expect(rdSourceKey.provider).to.equal(RealityDataProvider.ContextShare);
    expect(rdSourceKey.format).to.equal(forceFormat);
    expect(rdSourceKey.id).to.be.equal("fe8d32a5-f6ab-4157-b3ec-a9b53db923e3");
    expect(rdSourceKey.iTwinId).to.be.undefined;
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ByteStream } from "@itwin/core-bentley";
import { Base64EncodedString } from "@itwin/core-common";
import { expect } from "chai";
import * as sinon from "sinon";
import { ArcGisFeatureResponse } from "../../ArcGisFeature/ArcGisFeatureResponse";
import { esriPBuffer } from "../../ArcGisFeature/esriPBuffer.gen";
import { PhillyLandmarksDataset } from "./PhillyLandmarksDataset";

describe("ArcGisFeatureResponse", () => {

  const sandbox = sinon.createSandbox();

  afterEach(async () => {
    sandbox.restore();
  });

  it("should return undefined if http error", async () => {
    const response = new ArcGisFeatureResponse("PBF", Promise.resolve({status: 404} as Response));
    const data = await response.getResponseData();
    expect(data).to.be.undefined;
  });

  it("should return undefined if invalid PBF data", async () => {
    const response = new ArcGisFeatureResponse("PBF", Promise.resolve({
      status: 404,
      arrayBuffer: async () => {
        return Promise.resolve(undefined);
      },
    } as unknown as Response));
    const data = await response.getResponseData();
    expect(data).to.be.undefined;
  });

  it("should create FeatureCollectionPBuffer from PBF data", async () => {

    const fakeResponse  = {
      headers: { "content-type" : "pbf"},
      arrayBuffer: async () => {
        const byteArray = Base64EncodedString.toUint8Array(PhillyLandmarksDataset.phillyTransportationGetFeatureInfoQueryEncodedPbf);
        return Promise.resolve(byteArray ? ByteStream.fromUint8Array(byteArray).arrayBuffer : undefined);
      },
      status: 200,
    } as unknown;

    const response = new ArcGisFeatureResponse("PBF", Promise.resolve(fakeResponse as Response));
    const data = await response.getResponseData();
    expect(data?.exceedTransferLimit).to.be.false;
    expect(data?.data instanceof esriPBuffer.FeatureCollectionPBuffer).to.be.true;
  });

  it("should report exceededTransferLimit from PBF object", async () => {

    const collection = esriPBuffer.FeatureCollectionPBuffer.fromObject(PhillyLandmarksDataset.phillyExceededTransferLimitPbf);

    const fakeResponse  = {
      headers: { "content-type" : "pbf"},
      arrayBuffer: async () => {
        const byteArray = collection.serialize();
        return Promise.resolve(byteArray ? ByteStream.fromUint8Array(byteArray).arrayBuffer : undefined);
      },
      status: 200,
    } as unknown;

    const response = new ArcGisFeatureResponse("PBF", Promise.resolve(fakeResponse as Response));
    const data = await response.getResponseData();
    expect(data?.exceedTransferLimit).to.be.true;
    expect(data?.data instanceof esriPBuffer.FeatureCollectionPBuffer).to.be.true;
  });

  it("should return undefined if invalid JSON", async () => {
    const response = new ArcGisFeatureResponse("JSON", Promise.resolve({
      status: 404,
      json: async () => {
        return undefined;
      },
    } as unknown as Response));
    const data = await response.getResponseData();
    expect(data).to.be.undefined;
  });

  it("should return JSON data", async () => {
    const response = new ArcGisFeatureResponse("JSON", Promise.resolve({
      status: 200,
      json: async () => {
        return {exceededTransferLimit: false};
      },
    } as unknown as Response));
    const data = await response.getResponseData();
    expect(data?.data).not.to.be.undefined;
    expect(data?.exceedTransferLimit).to.be.false;
  });

  it("should report exceededTransferLimit from JSON object", async () => {
    const response = new ArcGisFeatureResponse("JSON", Promise.resolve({
      status: 200,
      json: async () => {
        return {exceededTransferLimit: true};
      },
    } as unknown as Response));
    const data = await response.getResponseData();
    expect(data?.exceedTransferLimit).to.be.true;
  });

});

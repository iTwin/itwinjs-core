/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ImageSource, ImageSourceFormat, RenderTexture } from "@itwin/core-common";
import { CheckpointConnection, imageElementFromImageSource, IModelApp, IModelConnection } from "@itwin/core-frontend";
import { ExternalTextureLoader, ExternalTextureRequest, GL, Texture2DHandle } from "@itwin/core-frontend/lib/cjs/webgl";
import { TestUsers } from "@itwin/oidc-signin-tool/lib/cjs/frontend";
import { TestUtility } from "../TestUtility";

describe("external texture requests (#integration)", () => {

  let imodel: IModelConnection;
  const texNames = [
    "0x48", "0x4b", "0x52", "0x54", "0x56", "0x59",
    "0x01", // bad request
    "0x5e", "0x60", "0x64", "0x66", "0x69", "0x6d",
    "0x6f", "0x71", "0x73", "0x75", "0x7c", "0x7f",
    "0x02", // bad request
    "0x82", "0x85", "0x8a", "0x8c", "0x8f", "0x91",
    "0x94", "0x97", "0x99", "0x9b", "0x9d", "0x9f",
    "0x03", // bad request
    "0xa1", "0xa3", "0xa5"];
  const goodTexNames = [
    "0x48", "0x4b", "0x52", "0x54", "0x56", "0x59",
    "0x5e", "0x60", "0x64", "0x66", "0x69", "0x6d",
    "0x6f", "0x71", "0x73", "0x75", "0x7c", "0x7f",
    "0x82", "0x85", "0x8a", "0x8c", "0x8f", "0x91",
    "0x94", "0x97", "0x99", "0x9b", "0x9d", "0x9f",
    "0xa1", "0xa3", "0xa5"];
  const numExpectedBadRequests = 3;
  const finishedTexRequests: Array<ExternalTextureRequest> = [];
  const extTexLoader = ExternalTextureLoader.instance;
  let totalLoadTextureCalls = 0;

  before(async () => {
    await TestUtility.shutdownFrontend();
    await TestUtility.startFrontend(TestUtility.iModelAppOptions);
    await TestUtility.initialize(TestUsers.regular);
    const contextId = await TestUtility.queryITwinIdByName(TestUtility.testITwinName);
    const iModelId = await TestUtility.queryIModelIdByName(contextId, TestUtility.testIModelNames.smallTex);
    imodel = await CheckpointConnection.openRemote(contextId, iModelId);
  });

  after(async () => {
    if (imodel)
      await imodel.close();

    await TestUtility.shutdownFrontend();
  });

  function onExternalTextureLoaded(req: ExternalTextureRequest) {
    expect(extTexLoader.numActiveRequests).lessThan(extTexLoader.maxActiveRequests + 1);
    finishedTexRequests.push(req);
    totalLoadTextureCalls++;
  }

  function expectNoDuplicates(reqToCheck: ExternalTextureRequest) {
    let numMatches = 0;
    finishedTexRequests.forEach((req: ExternalTextureRequest) => {
      if (reqToCheck.name === req.name)
        numMatches++;
    });
    expect(numMatches).to.equal(1);
  }

  async function testExternalTextures() {
    const placeHolderTextureData = new Uint8Array([255, 0, 0]);
    const loadTextures = () => {
      texNames.forEach((texName: string) => {
        const handle = Texture2DHandle.createForData(1, 1, placeHolderTextureData, undefined, undefined, GL.Texture.Format.Rgb);
        expect(handle).to.not.be.undefined;
        if (undefined !== handle) {
          for (let i = 0; i < 2; i++) // attempt to load the same texture twice quickly in a row - only one should finish
            extTexLoader.loadTexture(handle, texName, imodel, RenderTexture.Type.Normal, ImageSourceFormat.Jpeg, onExternalTextureLoaded);
        }
      });

      // Load a texture with a bad texture name (not a string). ExternalTextureLoader will throw an exception and should handle it properly.
      const handleB = Texture2DHandle.createForData(1, 1, placeHolderTextureData, undefined, undefined, GL.Texture.Format.Rgb);
      expect(handleB).to.not.be.undefined;
      if (undefined !== handleB)
        extTexLoader.loadTexture(handleB, 0 as unknown as string, imodel, RenderTexture.Type.Normal, ImageSourceFormat.Jpeg, onExternalTextureLoaded);
    };

    loadTextures();

    await IModelApp.renderSystem.waitForAllExternalTextures();
    expect(extTexLoader.numActiveRequests).to.equal(0);
    expect(extTexLoader.numPendingRequests).to.equal(0);
    await IModelApp.renderSystem.waitForAllExternalTextures(); // check that the wait method works properly when no requests exist.

    const numExpectedGoodRequests = texNames.length - numExpectedBadRequests;
    expect(finishedTexRequests.length).to.equal(numExpectedGoodRequests);
    expect(numExpectedGoodRequests).to.equal(totalLoadTextureCalls);
    expect(extTexLoader.numActiveRequests).to.equal(0);
    expect(extTexLoader.numPendingRequests).to.equal(0);

    finishedTexRequests.forEach((texReq: ExternalTextureRequest) => {
      expectNoDuplicates(texReq);
      const texHandle = texReq.handle;
      expect(texHandle.format).to.equal(GL.Texture.Format.Rgb);
      expect(texHandle.width === 1024 || texHandle.width === 512 || texHandle.width === 256).to.be.true;
      expect(texHandle.height === 1024 || texHandle.height === 512 || texHandle.height === 256).to.be.true;
    });
  }

  async function testDownsamplingTextures() {
    const maxTextureSize = 8;
    for (const name of goodTexNames) {
      // check that requested textures are downsampled to maxTexturesize when requested.
      let texData = await imodel.queryTextureData({ name, maxTextureSize });
      expect(texData).to.not.be.undefined;
      let texBytes = texData?.bytes;
      expect(texBytes).to.not.be.undefined;
      let imageSource = new ImageSource(texBytes!, ImageSourceFormat.Jpeg);
      let image = await imageElementFromImageSource(imageSource);
      expect(image.width).to.be.lessThanOrEqual(maxTextureSize);
      expect(image.height).to.be.lessThanOrEqual(maxTextureSize);
      expect(image.width === maxTextureSize || image.height === maxTextureSize).to.be.true;

      // check that requests textures are not downsampled when not requested.
      texData = await imodel.queryTextureData({ name });
      expect(texData).to.not.be.undefined;
      texBytes = texData?.bytes;
      expect(texBytes).to.not.be.undefined;
      imageSource = new ImageSource(texBytes!, ImageSourceFormat.Jpeg);
      image = await imageElementFromImageSource(imageSource);
      expect(image.width).to.be.greaterThan(maxTextureSize);
      expect(image.height).to.be.greaterThan(maxTextureSize);
    }
  }

  it("should process all external texture requests", async () => {
    await testExternalTextures();
  });

  it("should downsample external textures as needed", async () => {
    await testDownsamplingTextures();
  });
});

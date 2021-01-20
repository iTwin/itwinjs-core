/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ImageSourceFormat, RenderTexture } from "@bentley/imodeljs-common";
import { IModelApp, IModelConnection, RemoteBriefcaseConnection } from "@bentley/imodeljs-frontend";
import { ExternalTextureLoader, GL, Texture2DHandle } from "@bentley/imodeljs-frontend/lib/webgl";
import { TestUtility } from "./TestUtility";
import { TestUsers } from "@bentley/oidc-signin-tool/lib/frontend";

describe.only("external texture requests", () => {
  const projectName = "iModelJsIntegrationTest";
  let imodel: IModelConnection;
  const origLoadTexture = ExternalTextureLoader.instance.loadTexture; // eslint-disable-line @typescript-eslint/unbound-method
  const texNames = ["0x48", "0x4b", "0x52", "0x54", "0x56", "0x59", "0x5e", "0x60", "0x64", "0x66", "0x69", "0x6d", "0x6f", "0x71", "0x73", "0x75", "0x7c", "0x7f", "0x82", "0x85", "0x8a", "0x8c", "0x8f", "0x91", "0x94", "0x97", "0x99", "0x9b", "0x9d", "0x9f", "0xa1", "0xa3", "0xa5"];
  const texHandles: Array<Texture2DHandle> = [];

  before(async () => {
    await IModelApp.startup({
      authorizationClient: await TestUtility.initializeTestProject(projectName, TestUsers.regular),
      imodelClient: TestUtility.imodelCloudEnv.imodelClient,
      applicationVersion: "1.2.1.1",
    });
    const projectId = await TestUtility.getTestProjectId(projectName);
    const iModelId = await TestUtility.getTestIModelId(projectId, "SmallTex");
    imodel = await RemoteBriefcaseConnection.open(projectId, iModelId);
  });

  after(async () => {
    ExternalTextureLoader.instance.loadTexture = origLoadTexture; // eslint-disable-line @typescript-eslint/unbound-method

    if (imodel)
      await imodel.close();

    await IModelApp.shutdown();
  });

  async function testExternalTextures() {
    const extTexLoader = ExternalTextureLoader.instance;
    let totalTexturesLoaded = 0;

    extTexLoader.loadTexture = // eslint-disable-line @typescript-eslint/unbound-method
      (handle: Texture2DHandle, name: string, imdl: IModelConnection, type: RenderTexture.Type, format: ImageSourceFormat) => {
        expect(extTexLoader.numActiveRequests).lessThan(extTexLoader.maxActiveRequests + 1);
        origLoadTexture.apply(ExternalTextureLoader.instance, [handle, name, imdl, type, format]);
        totalTexturesLoaded++;
      };

    const placeHolderTextureData = new Uint8Array([255, 0, 0]);
    const loadTextures = () => {
      texNames.forEach((texName: string) => {
        const handle = Texture2DHandle.createForData(1, 1, placeHolderTextureData, undefined, undefined, GL.Texture.Format.Rgb);
        expect(handle).to.not.be.undefined;
        if (undefined !== handle) {
          extTexLoader.loadTexture(handle, texName, imodel, RenderTexture.Type.Normal, ImageSourceFormat.Jpeg);
          texHandles.push(handle);
        }
      });
    };

    loadTextures();

    await waitUntil(() => {
      return extTexLoader.numActiveRequests === 0 && extTexLoader.numPendingRequests === 0;
    });

    expect(texHandles.length).to.equal(texNames.length);
    expect(texNames.length).to.equal(totalTexturesLoaded);
    expect(extTexLoader.numActiveRequests).to.equal(0);
    expect(extTexLoader.numPendingRequests).to.equal(0);

    texHandles.forEach((texHandle: Texture2DHandle) => {
      expect(texHandle.format).to.equal(GL.Texture.Format.Rgb);
      expect(texHandle.width === 1024 || texHandle.width === 512 || texHandle.width === 256).to.be.true;
      expect(texHandle.height === 1024 || texHandle.height === 512 || texHandle.height === 256).to.be.true;
    });
  }

  it("should process all external texture requests", async () => {
    await testExternalTextures();
  });
});

async function waitUntil(condition: () => boolean): Promise<void> {
  if (condition())
    return;

  await new Promise<void>((resolve: any) => setTimeout(resolve, 100));
  return waitUntil(condition);
}

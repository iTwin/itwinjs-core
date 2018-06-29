/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { WebGLTestContext } from "./WebGLTestContext";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { ColorDef, ImageBuffer, ImageBufferFormat, ImageSource, ImageSourceFormat, RenderTexture } from "@bentley/imodeljs-common";
import { CONSTANTS } from "../common/Testbed";
import * as path from "path";

/* tslint:disable:no-console */

const iModelLocation = path.join(CONSTANTS.IMODELJS_CORE_DIRNAME, "testbed/node_modules/@bentley/imodeljs-backend/src/test/assets/test.bim");
let imodel: IModelConnection;

function getImageBufferData(): Uint8Array {
  const gradientPixelCount = 1024;
  const sizeOfColorDef = 4;

  const buffer = new Uint8Array(gradientPixelCount * sizeOfColorDef);
  let currentBufferIdx = 0;
  let color = ColorDef.from(54, 117, 255);

  for (let i = 0; i < gradientPixelCount; i++ , currentBufferIdx += 4) {
    buffer[currentBufferIdx] = color.colors.r;
    buffer[currentBufferIdx + 1] = color.colors.g;
    buffer[currentBufferIdx + 2] = color.colors.b;
    buffer[currentBufferIdx + 3] = color.getAlpha();
  }
  return buffer;
}

describe("Disposal of WebGL Resources", () => {
  before(async () => {
    imodel = await IModelConnection.openStandalone(iModelLocation);
    WebGLTestContext.startup();
  });
  after(async () => {
    await imodel.closeStandalone();
    WebGLTestContext.shutdown();
  });

  it("disposal of 'high-level' classes should trigger disposal of all owned resources", () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }
    const system = IModelApp.renderSystem;

    const imageBuff = ImageBuffer.create(getImageBufferData(), ImageBufferFormat.Rgba, 1);
    assert.isDefined(imageBuff);
    const imageSrcData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 3, 0, 0, 0, 3, 8, 2, 0, 0, 0, 217, 74, 34, 232, 0, 0, 0, 1, 115, 82, 71, 66, 0, 174, 206, 28, 233, 0, 0, 0, 4, 103, 65, 77, 65, 0, 0, 177, 143, 11, 252, 97, 5, 0, 0, 0, 9, 112, 72, 89, 115, 0, 0, 14, 195, 0, 0, 14, 195, 1, 199, 111, 168, 100, 0, 0, 0, 24, 73, 68, 65, 84, 24, 87, 99, 248, 15, 4, 12, 12, 64, 4, 198, 64, 46, 132, 5, 162, 254, 51, 0, 0, 195, 90, 10, 246, 127, 175, 154, 145, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
    const imageSrc = new ImageSource(imageSrcData, ImageSourceFormat.Png);

    const textureParams0 = new RenderTexture.Params("-192837465");
    const texture0 = system.createTextureFromImageBuffer(imageBuff!, imodel, textureParams0);
    assert.isDefined(texture0);

    const textureParams1 = new RenderTexture.Params("-918273645");
    const texture1 = system.createTextureFromImageSource(imageSrc, 256, 256, imodel, textureParams1);
    assert.isDefined(texture1);

    // Textures are created and stored on IdMap, holding WebGL resources
    assert.isFalse(texture0!.isDisposed);
    assert.isFalse(texture1!.isDisposed);

    // Dispose of ALL contained WebGL resources
    system.dispose();

    assert.isTrue(texture0!.isDisposed);
    assert.isTrue(texture1!.isDisposed);

    // ###TODO - Add more sample cases, starting at various heights of the class hierarchy
  });
});

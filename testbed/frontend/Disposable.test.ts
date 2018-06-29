/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { WebGLTestContext } from "./WebGLTestContext";
import { IModelApp } from "@bentley/imodeljs-frontend";
// import { ImageBuffer, ImageBufferFormat } from "../../core/common/lib/Image";
// import { ColorDef } from "../../core/common/lib/ColorDef";

/* tslint:disable:no-console */

// const imageSrcData: Uint8Array = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 3, 0, 0, 0, 3, 8, 2, 0, 0, 0, 217, 74, 34, 232, 0, 0, 0, 1, 115, 82, 71, 66, 0, 174, 206, 28, 233, 0, 0, 0, 4, 103, 65, 77, 65, 0, 0, 177, 143, 11, 252, 97, 5, 0, 0, 0, 9, 112, 72, 89, 115, 0, 0, 14, 195, 0, 0, 14, 195, 1, 199, 111, 168, 100, 0, 0, 0, 24, 73, 68, 65, 84, 24, 87, 99, 248, 15, 4, 12, 12, 64, 4, 198, 64, 46, 132, 5, 162, 254, 51, 0, 0, 195, 90, 10, 246, 127, 175, 154, 145, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
/*
function getImageBufferData(): Uint8Array {
  const gradientPixelCount = 1024;
  const sizeOfColorDef = 4;

  const buffer = new Uint8Array(gradientPixelCount * sizeOfColorDef);
  let currentBufferIdx = 0;
  let color1 = ColorDef.from(54, 117, 255);
  let color2 = ColorDef.from(40, 15, 0);

  for (let i = 0; i < gradientPixelCount; i++ , currentBufferIdx += 4) {
    let frac = i / gradientPixelCount;

    color1.lerp(color2, frac, color1);
    color1.setAlpha(color1.getAlpha() + frac * (color2.getAlpha() - color1.getAlpha()));
    buffer[currentBufferIdx] = color1.colors.r;
    buffer[currentBufferIdx + 1] = color1.colors.g;
    buffer[currentBufferIdx + 2] = color1.colors.b;
    buffer[currentBufferIdx + 3] = color1.getAlpha();
  }
  return buffer;
}
*/
describe("Disposal of WebGL Resources", () => {
  before(() => WebGLTestContext.startup());
  after(() => WebGLTestContext.shutdown());

  it("manual disposal of 'high-level' classes should trigger disposal of all owned items", () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }
    console.log("hit");
    // const system = IModelApp.renderSystem;

    // const imageBuff = ImageBuffer.create(getImageBufferData(), ImageBufferFormat.Rgba, 1);
  });
});

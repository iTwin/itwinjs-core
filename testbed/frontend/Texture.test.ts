/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { expect, assert } from "chai";
import { WebGLTestContext } from "./WebGLTestContext";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { TextureHandle, GL } from "@bentley/imodeljs-frontend/lib/rendering";

describe("Texture tests", () => {
  before(() => WebGLTestContext.startup());
  after(() => WebGLTestContext.shutdown());

  it("should produce an image texture", () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }

    const pixels: Uint8Array = new Uint8Array(3);  pixels[0] = pixels[1] = pixels[2] = 0;
    const texture: TextureHandle | undefined = TextureHandle.createForImage(1, pixels, false, false, false, false);
    assert(undefined !== texture);
    if (undefined === texture) {
      return;
    }

    expect(texture.getHandle()).to.not.be.undefined;
  });

  it("should produce a color texture", () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }

    const texture: TextureHandle | undefined = TextureHandle.createForColor(1, 1, GL.Texture.Format.Rgb, GL.Texture.DataType.UnsignedByte);
    assert(undefined !== texture);
    if (undefined === texture) {
      return;
    }

    expect(texture.getHandle()).to.not.be.undefined;
  });
});

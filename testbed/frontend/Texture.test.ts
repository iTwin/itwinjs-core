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
    // create texture with wantPreserveData=true
    const texture: TextureHandle | undefined = TextureHandle.createForImage(1, pixels, false, false, false, false, true);
    assert(undefined !== texture);
    if (undefined === texture) {
      return;
    }

    expect(texture.getHandle()).to.not.be.undefined;
    expect(texture.resizedCanvas).to.be.undefined; // should not be resized!
  });

  it("should produce an attachment texture", () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }

    const texture: TextureHandle | undefined = TextureHandle.createForAttachment(1, 1, GL.Texture.Format.Rgb, GL.Texture.DataType.UnsignedByte);
    assert(undefined !== texture);
    if (undefined === texture) {
      return;
    }

    expect(texture.getHandle()).to.not.be.undefined;
  });

  it("should produce a glyph texture resized to power of two", () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }

    const pixels: Uint8Array = new Uint8Array(3 * 3 * 3);
    for (let i = 0; i < 3 * 3 * 3; i += 3) { // image is all red
      pixels[i] = 255;
      pixels[i + 1] = pixels[i + 2] = 0;
    }
    // create texture with isGlyph=true, wantPreserveData=true
    const texture: TextureHandle | undefined = TextureHandle.createForImage(3, pixels, false, false, true, false, true);
    assert(undefined !== texture);
    if (undefined === texture) {
      return;
    }

    expect(texture.getHandle()).to.not.be.undefined;

    // test the resizing of the image - was it succesful?
    expect(texture.resizedCanvas).to.not.be.undefined;
    if (texture.resizedCanvas !== undefined) {
      expect(texture.resizedCanvas.width).to.equal(4);
      expect(texture.resizedCanvas.height).to.equal(4);

      const ctx = texture.resizedCanvas.getContext("2d");
      expect(ctx).to.be.not.null;
      if (ctx !== null) {
        const pixel: Uint8ClampedArray = ctx.getImageData(0, 0, 1, 1).data; // get 0,0 pixel
        // should be red pixel:
        expect(pixel[0] > 0).to.be.true;
        expect(pixel[1] > 0).to.be.false;
        expect(pixel[2] > 0).to.be.false;
      }
    }
  });
});

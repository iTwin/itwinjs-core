/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { expect, assert } from "chai";
import { WebGLTestContext } from "./WebGLTestContext";
import { IModelApp, ImageUtil } from "@bentley/imodeljs-frontend";
import { TextureHandle, GL } from "@bentley/imodeljs-frontend/lib/webgl";
import { ImageBuffer, ImageBufferFormat, ImageSource, ImageSourceFormat, RenderTexture } from "@bentley/imodeljs-common";

// This is an encoded png containing a 3x3 square with white in top left pixel, blue in middle pixel, and green in
// bottom right pixel.  The rest of the square is red.
const pngData: Uint8Array = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 3, 0, 0, 0, 3, 8, 2, 0, 0, 0, 217, 74, 34, 232, 0, 0, 0, 1, 115, 82, 71, 66, 0, 174, 206, 28, 233, 0, 0, 0, 4, 103, 65, 77, 65, 0, 0, 177, 143, 11, 252, 97, 5, 0, 0, 0, 9, 112, 72, 89, 115, 0, 0, 14, 195, 0, 0, 14, 195, 1, 199, 111, 168, 100, 0, 0, 0, 24, 73, 68, 65, 84, 24, 87, 99, 248, 15, 4, 12, 12, 64, 4, 198, 64, 46, 132, 5, 162, 254, 51, 0, 0, 195, 90, 10, 246, 127, 175, 154, 145, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);

// This is a 4x2 RGB bitmap:
// red green blue white
// yellow cyan purple black
const bitmapData = new Uint8Array([
  0xff, 0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff,
  0xff, 0xff, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0xff, 0x00, 0x00, 0x00,
]);

describe("Texture tests", () => {
  before(() => WebGLTestContext.startup());
  after(() => WebGLTestContext.shutdown());

  it("should produce an attachment texture (rgb, unsigned byte)", () => {
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

  it("should produce an attachment texture (depth, unsigned int)", () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }

    const texture: TextureHandle | undefined = TextureHandle.createForAttachment(1, 1, GL.Texture.Format.DepthComponent, GL.Texture.DataType.UnsignedInt);
    assert(undefined !== texture);
    if (undefined === texture) {
      return;
    }

    expect(texture.getHandle()).to.not.be.undefined;
  });

  it("should produce a data texture (implied RGBA, unsigned byte) with preserved data", () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }

    const data: Uint8Array = new Uint8Array([255, 255, 0, 255]);
    const texture: TextureHandle | undefined = TextureHandle.createForData(1, 1, data, true);
    assert(undefined !== texture);
    if (undefined === texture) {
      return;
    }

    expect(texture.getHandle()).to.not.be.undefined;
    expect(texture.dataBytes).to.not.be.undefined; // data should be preserved
  });

  it("should produce an image (png) texture with unpreserved data", () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }

    // create texture with default parameters
    const imageBuffer = ImageBuffer.create(bitmapData, ImageBufferFormat.Rgb, 4)!;
    assert(undefined !== imageBuffer);
    const texture = TextureHandle.createForImageBuffer(imageBuffer, RenderTexture.Type.Normal)!;
    assert(undefined !== texture);

    expect(texture.getHandle()).to.not.be.undefined;
    expect(texture.dataBytes).to.be.undefined;
    expect(texture.width).to.equal(4);
    expect(texture.height).to.equal(2);
  });

  it("should produce a texture from an html image and resize to power of two", async () => {
    if (!WebGLTestContext.isInitialized)
      return;

    const imageSource = new ImageSource(pngData, ImageSourceFormat.Png);
    const image = await ImageUtil.extractImage(imageSource);
    assert(undefined !== image);
    const imageTexture = TextureHandle.createForImage(image!, true, RenderTexture.Type.Normal);
    assert(undefined !== imageTexture);
    expect(imageTexture!.width).to.equal(4);
    expect(imageTexture!.height).to.equal(4);
  });
});

describe("ImageUtil", () => {
  const imageSource = new ImageSource(pngData, ImageSourceFormat.Png);

  it("should extract image dimensions from ImageSource", async () => {
    const size = await ImageUtil.extractImageDimensions(imageSource);
    assert(undefined !== size);
    expect(size!.x).to.equal(3);
    expect(size!.y).to.equal(3);
  });

  it("should extract image from ImageSource", async () => {
    const image = await ImageUtil.extractImage(imageSource);
    assert(undefined !== image);
    expect(image!.naturalWidth).to.equal(3);
    expect(image!.naturalHeight).to.equal(3);
  });
});

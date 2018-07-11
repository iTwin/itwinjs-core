/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { expect, assert } from "chai";
import { WebGLTestContext } from "./WebGLTestContext";
import { IModelApp, ImageUtil } from "@bentley/imodeljs-frontend";
import { TextureHandle, TextureLoadCallback, GL } from "@bentley/imodeljs-frontend/lib/rendering";
import { ImageSource, ImageSourceFormat, RenderTexture } from "@bentley/imodeljs-common";

// This is an encoded png containing a 3x3 square with white in top left pixel, blue in middle pixel, and green in
// bottom right pixel.  The rest of the square is red.
const pixels: Uint8Array = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 3, 0, 0, 0, 3, 8, 2, 0, 0, 0, 217, 74, 34, 232, 0, 0, 0, 1, 115, 82, 71, 66, 0, 174, 206, 28, 233, 0, 0, 0, 4, 103, 65, 77, 65, 0, 0, 177, 143, 11, 252, 97, 5, 0, 0, 0, 9, 112, 72, 89, 115, 0, 0, 14, 195, 0, 0, 14, 195, 1, 199, 111, 168, 100, 0, 0, 0, 24, 73, 68, 65, 84, 24, 87, 99, 248, 15, 4, 12, 12, 64, 4, 198, 64, 46, 132, 5, 162, 254, 51, 0, 0, 195, 90, 10, 246, 127, 175, 154, 145, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);

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

  it.skip("should produce an image (png) texture with unpreserved data", () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }

    // create texture with default parameters
    const texture = TextureHandle.createForImageSource(3, 3, new ImageSource(pixels, ImageSourceFormat.Png), RenderTexture.Type.Normal);
    assert(undefined !== texture);
    if (undefined === texture) {
      return;
    }

    expect(texture.getHandle()).to.not.be.undefined;
    expect(texture.dataBytes).to.be.undefined;
  });
});

describe.skip("Test pixel values of resized texture in callback (async texture loading)", () => {
  let texture: TextureHandle | undefined; // tslint:disable-line:prefer-const
  let loaded = false;                     // tslint:disable-line:prefer-const
  let canvas: HTMLCanvasElement | null;   // tslint:disable-line:prefer-const

  before(async () => {
    WebGLTestContext.startup();
    if (WebGLTestContext.isInitialized) {
      const texLoadCallback: TextureLoadCallback = (_t: TextureHandle, c: HTMLCanvasElement): void => {
        loaded = true;
        canvas = c;
      };
      texture = TextureHandle.createForImageSource(3, 3, new ImageSource(pixels, ImageSourceFormat.Png), RenderTexture.Type.Normal, texLoadCallback);
    }
  });

  after(() => WebGLTestContext.shutdown());

  it("should produce a image texture (png, glyph) resized to power of two with valid pixel values", () => {
    if (!WebGLTestContext.isInitialized) {
      return;
    }

    assert(undefined !== texture);
    assert(loaded);
    assert(canvas);
    if (undefined === texture) {
      return;
    }

    expect(texture.getHandle()).to.not.be.undefined;

    expect(canvas).to.not.be.null;
    if (null !== canvas) {
      expect(canvas.width).to.equal(4); // should be resized to next power of two (3 becomes 4)
      expect(canvas.height).to.equal(4);

      const ctx = canvas.getContext("2d");
      expect(ctx).to.be.not.null;
      if (ctx !== null) {
        // ###TODO: Why does the resizing result in slightly different RGB values on different machines?
        // ###TODO: It appears that different canvas resizing algorithms are used different places / runs.
        /*
        let pixel: Uint8ClampedArray = ctx.getImageData(0, 0, 1, 1).data; // get 0,0 pixel (should be white)
        expect(pixel[0] > 0).to.be.true;
        expect(pixel[1] > 0).to.be.true;
        expect(pixel[2] > 0).to.be.true;
        pixel = ctx.getImageData(3, 3, 1, 1).data; // get 3,3 pixel (should be green)
        expect(pixel[0] > 0).to.be.false;
        expect(pixel[1] > 0).to.be.true;
        expect(pixel[2] > 0).to.be.false;
        pixel = ctx.getImageData(3, 0, 1, 1).data; // get 3,0 pixel (should be red)
        expect(pixel[0] > 0).to.be.true;
        expect(pixel[1] > 0).to.be.false;
        expect(pixel[2] > 0).to.be.false;
        */
      }
    }
  });
});

describe("ImageUtil", () => {
  const imageSource = new ImageSource(pixels, ImageSourceFormat.Png);

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

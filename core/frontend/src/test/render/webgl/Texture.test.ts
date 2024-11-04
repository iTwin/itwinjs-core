/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assert as bAssert } from "@itwin/core-bentley";
import { EmptyLocalization, ImageBuffer, ImageBufferFormat, ImageSource, ImageSourceFormat, RenderTexture } from "@itwin/core-common";
import { extractImageSourceDimensions, imageBufferToPngDataUrl, imageElementFromImageSource, imageElementFromUrl } from "../../../common/ImageUtil";
import { IModelApp } from "../../../IModelApp";
import { GL } from "../../../render/webgl/GL";
import { TextureHandle } from "../../../render/webgl/Texture";

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
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());

  it("should produce an attachment texture (rgb, unsigned byte)", () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }

    const texture: TextureHandle | undefined = TextureHandle.createForAttachment(1, 1, GL.Texture.Format.Rgb, GL.Texture.DataType.UnsignedByte);
    expect(texture).toBeDefined();
    if (undefined === texture) {
      return;
    }

    expect(texture.getHandle()).toBeDefined();
  });

  it("should produce an attachment texture (depth, unsigned int)", () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }

    const texture: TextureHandle | undefined = TextureHandle.createForAttachment(1, 1, GL.Texture.Format.DepthComponent, GL.Texture.DataType.UnsignedInt);
    expect(texture).toBeDefined();
    if (undefined === texture) {
      return;
    }

    expect(texture.getHandle()).toBeDefined();
  });

  it("should produce a data texture (implied RGBA, unsigned byte) with preserved data", () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }

    const data: Uint8Array = new Uint8Array([255, 255, 0, 255]);
    const texture: TextureHandle | undefined = TextureHandle.createForData(1, 1, data, true);
    expect(texture).toBeDefined();
    if (undefined === texture) {
      return;
    }

    expect(texture.getHandle()).toBeDefined();
    expect(texture.dataBytes).toBeDefined(); // data should be preserved
  });

  it("should produce an image (png) texture with unpreserved data", () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }

    // create texture with default parameters
    const imageBuffer = ImageBuffer.create(bitmapData, ImageBufferFormat.Rgb, 4);
    expect(imageBuffer).toBeDefined();
    const texture = TextureHandle.createForImageBuffer(imageBuffer, RenderTexture.Type.Normal)!;
    expect(texture).toBeDefined();

    expect(texture.getHandle()).toBeDefined();
    expect(texture.dataBytes).toBeUndefined();
    expect(texture.width).toEqual(4);
    expect(texture.height).toEqual(2);
  });

  it("should produce a texture from an html image and resize to power of two", async () => {
    const imageSource = new ImageSource(pngData, ImageSourceFormat.Png);
    const image = await imageElementFromImageSource(imageSource);
    bAssert(undefined !== image);
    const imageTexture = TextureHandle.createForImage(image, RenderTexture.Type.Normal);
    bAssert(undefined !== imageTexture);
    expect(imageTexture.width).toEqual(4);
    expect(imageTexture.height).toEqual(4);
  });
});

// NB: get/putImageData() are weird when alpha is involved...apparently the alpha is premultiplied, but
// getImageData() is required to return a RGBA value with *un*-premultiplied alpha. That conversion is lossy.
// e.g. if you put (7f,7f,7f,7f) you will get back (7e,7e,7e,7f).
// The tests avoid problematic alpha values.
async function testImageBufferUrl(buffer: ImageBuffer, expectedPixels: number[]) {
  // Create a URL from the image buffer
  const url = imageBufferToPngDataUrl(buffer);
  expect(url).toBeDefined();
  const urlPrefix = "data:image/png;base64,";
  expect(url!.startsWith(urlPrefix)).toBe(true);

  // Create an HTML image from the URL
  const image = await imageElementFromUrl(url!);
  expect(image).toBeDefined();

  // Draw the image onto a canvas
  const canvas = document.createElement("canvas");
  expect(canvas).not.toBeNull();
  canvas.width = buffer.width;
  canvas.height = buffer.height;

  const context = canvas.getContext("2d")!;
  expect(context).not.toBeNull();
  context.drawImage(image, 0, 0);

  // Extract the image pixels
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

  // Compare
  const actualPixels = imageData.data;
  expect(actualPixels.length).toEqual(expectedPixels.length);

  for (let i = 0; i < actualPixels.length; i++) {
    expect(actualPixels[i]).toEqual(expectedPixels[i]);
  }
}

describe("ImageUtil", () => {
  const imageSource = new ImageSource(pngData, ImageSourceFormat.Png);

  it("should extract image dimensions from ImageSource", async () => {
    const size = await extractImageSourceDimensions(imageSource);
    expect(size).toBeDefined();
    expect(size.x).toEqual(3);
    expect(size.y).toEqual(3);
  });

  it("should extract image from ImageSource", async () => {
    const image = await imageElementFromImageSource(imageSource);
    expect(image).toBeDefined();
    expect(image.naturalWidth).toEqual(3);
    expect(image.naturalHeight).toEqual(3);
  });

  it("should produce a data URL from an alpha ImageBuffer", async () => {
    const alphaBitmap = new Uint8Array([0x00, 0x10, 0x20, 0xdf, 0xef, 0xff]);
    const alphaBuffer = ImageBuffer.create(alphaBitmap, ImageBufferFormat.Alpha, 3);

    const expectedPixels = [
      0x00, 0x00, 0x00, 0x00, 0x10, 0x10, 0x10, 0x10, 0x20, 0x20, 0x20, 0x20,
      0xdf, 0xdf, 0xdf, 0xdf, 0xef, 0xef, 0xef, 0xef, 0xff, 0xff, 0xff, 0xff,
    ];
    await testImageBufferUrl(alphaBuffer, expectedPixels);
  });

  it("should produce a data URL from an rgb ImageBuffer", async () => {
    const rgbBitmap = new Uint8Array([
      0xff, 0x00, 0x00, 0x00, 0xff, 0x00,
      0x00, 0x00, 0xff, 0x7f, 0x7f, 0x7f,
    ]);
    const rgbBuffer = ImageBuffer.create(rgbBitmap, ImageBufferFormat.Rgb, 2);

    const expectedPixels = [
      0xff, 0x00, 0x00, 0xff, 0x00, 0xff, 0x00, 0xff,
      0x00, 0x00, 0xff, 0xff, 0x7f, 0x7f, 0x7f, 0xff,
    ];
    await testImageBufferUrl(rgbBuffer, expectedPixels);
  });

  it("should produce a data URL from an rgba ImageBuffer", async () => {
    const rgbaBitmap = [
      0xff, 0x00, 0x00, 0xff, 0x00, 0xff, 0x00, 0x00,
      0x00, 0x00, 0xff, 0xdf, 0xef, 0xef, 0xef, 0xef,
    ];
    const rgbaBuffer = ImageBuffer.create(new Uint8Array(rgbaBitmap), ImageBufferFormat.Rgba, 2);

    const rgbaResult = [
      0xff, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0x00, // NB: premultiplied alpha: 0xff*0x00 => 0x00
      0x00, 0x00, 0xff, 0xdf, 0xef, 0xef, 0xef, 0xef,
    ];
    await testImageBufferUrl(rgbaBuffer, rgbaResult);
  });
});

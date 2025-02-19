/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { imageBufferFromImageSource, imageSourceFromImageBuffer } from "../ImageSourceConversion";
import { samplePngTexture } from "./imageData";
import { BinaryImageSource, ImageBuffer, ImageBufferFormat, ImageSourceFormat } from "@itwin/core-common";

// samplePngTexture encodes this image:
// White Red  Red
// Red   Blue Red
// Red   Red  Green
const red = 0x000000ff;
const green = 0x0000ff00;
const blue = 0x00ff0000;
const white = 0x00ffffff;
const top = [white, red, red];
const middle = [red, blue, red];
const bottom = [red, red, green];

const samplePng: BinaryImageSource = {
  data: new Uint8Array(samplePngTexture.data),
  format: ImageSourceFormat.Png,
};

function getPixel(img: ImageBuffer, x: number, y: number): number {
  const pixelSize = img.numBytesPerPixel;
  const start = y * pixelSize * img.width + x * pixelSize;
  let pixel = 0;
  for (let offset = 0; offset < pixelSize; offset++) {
    let val = img.data[start + offset];
    val = (val << (offset * 8)) >>> 0;
    pixel = (pixel | val) >>> 0;
  }

  return pixel;
}

function expectImagePixels(img: ImageBuffer, expected: number[]): void {
  expect(img.width * img.height).to.equal(expected.length);
  const actual = [];
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      actual.push(getPixel(img, x, y));
    }
  }

  expect(actual).to.deep.equal(expected);
}

// Make an ImageBuffer as
// White Red  Red
// Red   Blue Red
// Red   Red  Green
// If an alpha channel is requested, alpha will be 0x7f
function makeImage(wantAlpha: boolean): ImageBuffer {
  const format = wantAlpha ? ImageBufferFormat.Rgba : ImageBufferFormat.Rgb;
  const pixelSize = wantAlpha ? 4 : 3;
  const data = new Uint8Array(pixelSize * 9);
  const lut = [white, red, red, red, blue, red, red, red, green];
  for (let i = 0; i < 9; i++) {
    const value = lut[i];
    const s = i * pixelSize;
    data[s + 0] = value & 0xff;
    data[s + 1] = (value >> 8) & 0xff;
    data[s + 2] = (value >> 16) & 0xff;
    if (wantAlpha) {
      data[s + 3] = 0x7f;
    }
  }

  const img = ImageBuffer.create(data, format, 3);
  return img;
}

function expectEqualImageBuffers(a: ImageBuffer, b: ImageBuffer, pixelTolerance = 0): void {
  expect(a.format).to.equal(b.format);
  expect(a.width).to.equal(b.width);
  expect(a.height).to.equal(b.height);
  expect(a.data.length).to.equal(b.data.length);
  for (let i = 0; i < a.data.length; i++) {
    const x = a.data[i];
    const y = b.data[i];
    expect(Math.abs(x - y)).most(pixelTolerance);
  }
}

function computeMaxCompressionError(compressed: ImageBuffer, original: ImageBuffer): number {
  expect(compressed.data.length).to.equal(original.data.length);
  let max = 0;
  for (let i = 0; i < compressed.data.length; i++) {
    max = Math.max(max, Math.abs(compressed.data[i] - original.data[i]));
  }

  return max;
}

describe("ImageSource conversion", () => {
  describe("imageBufferFromImageSource", () => {
    it("decodes PNG", () => {
      const buf = imageBufferFromImageSource({ source: samplePng })!;
      expect(buf).not.to.be.undefined;
      expect(buf.width).to.equal(3);
      expect(buf.height).to.equal(3);
      expect(buf.format).to.equal(ImageBufferFormat.Rgb);
      expectImagePixels(buf, [...top, ...middle, ...bottom]);
    });

    it("preserves alpha channel if RGBA requested", () => {
      const image = makeImage(true);
      const source = imageSourceFromImageBuffer({ image })!;
      const result = imageBufferFromImageSource({ source, targetFormat: ImageBufferFormat.Rgba })!;
      expect(result.format).to.equal(ImageBufferFormat.Rgba);
      expectImagePixels(result, [...top, ...middle, ...bottom].map((x) => (x | 0x7f000000) >>> 0));
    });

    it("strips alpha channel if RGB requested", () => {
      const image = makeImage(true);
      const source = imageSourceFromImageBuffer({ image })!;
      const result = imageBufferFromImageSource({ source, targetFormat: ImageBufferFormat.Rgb })!;
      expect(result.format).to.equal(ImageBufferFormat.Rgb);
      expectImagePixels(result, [...top, ...middle, ...bottom]);
    });

    it("sets alpha to 255 if RGBA requested for ImageSource lacking transparency", () => {
      const img = imageBufferFromImageSource({ source: samplePng, targetFormat: ImageBufferFormat.Rgba })!;
      expect(img.format).to.equal(ImageBufferFormat.Rgba);
      expectImagePixels(img, [...top, ...middle, ...bottom].map((x) => ((x | 0xff000000) >>> 0)));
    });
    
    it("defaults to RGBA IFF alpha channel is present", () => {
      const transparent = imageSourceFromImageBuffer({ image: makeImage(true), targetFormat: ImageSourceFormat.Png })!;
      expect(imageBufferFromImageSource({ source: transparent })!.format).to.equal(ImageBufferFormat.Rgba);
      const opaque = imageSourceFromImageBuffer({ image: makeImage(false), targetFormat: ImageSourceFormat.Png })!;
      expect(imageBufferFromImageSource({ source: opaque })!.format).to.equal(ImageBufferFormat.Rgb);
    });
  });

  describe("imageSourceFromImageBuffer", () => {
    it("encodes to specified format", () => {
      const image = makeImage(false);
      const png = imageSourceFromImageBuffer({ image, targetFormat: ImageSourceFormat.Png })!;
      expect(png.format).to.equal(ImageSourceFormat.Png);
      const jpeg = imageSourceFromImageBuffer({ image, targetFormat: ImageSourceFormat.Jpeg })!;
      expect(jpeg.format).to.equal(ImageSourceFormat.Jpeg);

      // PNG is lossless
      expectEqualImageBuffers(imageBufferFromImageSource({ source: png })!, image);

      // JPEG is lossy
      expectEqualImageBuffers(imageBufferFromImageSource({ source: jpeg })!, image, 2);
    });

    it("defaults to PNG IFF alpha channel is present", () => {
      const transparent = makeImage(true);
      expect(imageSourceFromImageBuffer({ image: transparent })!.format).to.equal(ImageSourceFormat.Png);

      const opaque = makeImage(false);
      expect(imageSourceFromImageBuffer({ image: opaque })!.format).to.equal(ImageSourceFormat.Jpeg);
    });

    it("flips vertically IFF specified", () => {
      const image = makeImage(false);
      let source = imageSourceFromImageBuffer({ image, targetFormat: ImageSourceFormat.Png })!;
      let output = imageBufferFromImageSource({ source })!;
      expectImagePixels(output, [...top, ...middle, ...bottom ]);

      source = imageSourceFromImageBuffer({ image, targetFormat: ImageSourceFormat.Png, flipVertically: true })!;
      output = imageBufferFromImageSource({ source })!;
      expectImagePixels(output, [...bottom, ...middle, ...top ]);
    });

    it("trades quality for size when encoding JPEG", () => {
      const image = makeImage(false);
      const low = imageSourceFromImageBuffer({ image, targetFormat: ImageSourceFormat.Jpeg, jpegQuality: 50 })!;
      const medium = imageSourceFromImageBuffer({ image, targetFormat: ImageSourceFormat.Jpeg, jpegQuality: 75 })!;
      const high = imageSourceFromImageBuffer({ image, targetFormat: ImageSourceFormat.Jpeg, jpegQuality: 100 })!;
      expect(low.data.length).lessThan(medium.data.length);
      expect(medium.data.length).lessThan(high.data.length);

      const highImg = imageBufferFromImageSource({ source: high })!;
      const lowImg = imageBufferFromImageSource({ source: low })!;
      const mediumImg = imageBufferFromImageSource({ source: medium })!;

      expect(computeMaxCompressionError(highImg, image)).to.equal(2);
      const mediumError = computeMaxCompressionError(mediumImg, image);
      expect(mediumError).greaterThan(2);
      expect(computeMaxCompressionError(lowImg, image)).greaterThan(mediumError);
    });

    it("throws if image is in alpha format", () => {
      const image = ImageBuffer.create(new Uint8Array([1, 2, 3, 4, 5]), ImageBufferFormat.Alpha, 5);
      expect(() => imageSourceFromImageBuffer({ image })).to.throw("imageSourceFromImageBuffer cannot be used with alpha-only images");
    });
  });
});


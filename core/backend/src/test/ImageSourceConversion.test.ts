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
  for (let x = 0; x < img.width; x++) {
    for (let y = 0; y < img.height; y++) {
      actual.push(getPixel(img, x, y));
    }
  }

  expect(actual).to.deep.equal(expected);
}

// Make an ImageBuffer as
// White Red  Red
// Red   Blue Red
// Red   Red  Green
// If an alpha channel is requested, alpha will start at 0 and increase by 1 per subsequent pixel.
function makeImage(wantAlpha: boolean): ImageBuffer {
  const format = wantAlpha ? ImageBufferFormat.Rgba : ImageBufferFormat.Rgb;
  const pixelSize = wantAlpha ? 4 : 3;
  const data = new Uint8Array(pixelSize * 9);
  const lut = [white, red, red, red, blue, red, red, red, green];
  for (let i = 0; i < 9; i++) {
    let value = lut[i];
    const s = i * pixelSize;
    data[s + 0] = value & 0xff;
    data[s + 1] = (value >> 8) & 0xff;
    data[s + 2] = (value >> 16) & 0xff;
    if (wantAlpha) {
      data[s + 3] = i;
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

describe.only("ImageSource conversion", () => {
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
      
    });

    it("strips alpha channel if RGB requested", () => {
      
    });

    it("sets alpha to 255 if RGBA requested for ImageSource lacking transparency", () => {
      const img = imageBufferFromImageSource({ source: samplePng, targetFormat: ImageBufferFormat.Rgba })!;
      expect(img.format).to.equal(ImageBufferFormat.Rgba);
      expectImagePixels(img, [...top, ...middle, ...bottom].map((x) => ((x | 0xff000000) >>> 0)));
    });
    
    it("defaults to RGBA IFF alpha channel is present", () => {
      
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
      const image = makeImage(true);
      const source = imageSourceFromImageBuffer({ image, flipVertically: true })!;
      const output = imageBufferFromImageSource({ source })!;
      expectImagePixels(output, [...bottom, ...middle, ...top ]);
    });

    it("compresses JPEG losslessly unless quality < 100 is specified", () => {
      
    });
  });
});


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
    pixel |= val;
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

describe.only("ImageSource conversion", () => {
  describe("imageBufferFromImageSource", () => {
    it("decodes PNG", () => {
      let buf = imageBufferFromImageSource({ source: samplePng })!;
      expect(buf).not.to.be.undefined;
      expect(buf.width).to.equal(3);
      expect(buf.height).to.equal(3);
      expect(buf.format).to.equal(ImageBufferFormat.Rgb);
      expectImagePixels(buf, [...top, ...middle, ...bottom]);
    });

    it("preserves alpha channel if specified if RGBA requested", () => {
      
    });

    it("strips alpha channel if RGB requested", () => {
      
    });

    it("defaults to RGBA IFF alpha channel is present", () => {
      
    });
  });

  describe("imageSourceFromImageBuffer", () => {
    it("flips vertically IFF specified", () => {
      
    });

    it("encodes to specified format", () => {
      
    });

    it("defaults to PNG IFF alpha channel is present", () => {
      
    });

    it("compresses JPEG losslessly unless quality < 100 is specified", () => {
      
    });
  });
});


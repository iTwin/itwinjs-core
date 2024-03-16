/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Guid, Id64 } from "@itwin/core-bentley";
import { Base64EncodedString, ImageSourceFormat, IModel, TextureTransparency } from "@itwin/core-common";
import { SnapshotDb, Texture } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

describe("Texture", () => {
  let imodel: SnapshotDb;

  before(async () => {
    imodel = IModelTestUtils.createSnapshotFromSeed(IModelTestUtils.prepareOutputFile("IModel", "CompatibilityTestSeed.bim"), IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim"));
  });

  after(() => {
    imodel.close();
  });

  it("should accept image as Uint8Array or base-64-encoded string", () => {
    // This is an encoded png containing a 3x3 square with white in top left pixel, blue in middle pixel, and green in
    // bottom right pixel.  The rest of the square is red.
    const pngData = [
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 3, 0, 0, 0, 3, 8, 2, 0, 0, 0, 217,
      74, 34, 232, 0, 0, 0, 1, 115, 82, 71, 66, 0, 174, 206, 28, 233, 0, 0, 0, 4, 103, 65, 77, 65, 0, 0, 177, 143, 11, 252,
      97, 5, 0, 0, 0, 9, 112, 72, 89, 115, 0, 0, 14, 195, 0, 0, 14, 195, 1, 199, 111, 168, 100, 0, 0, 0, 24, 73, 68, 65,
      84, 24, 87, 99, 248, 15, 4, 12, 12, 64, 4, 198, 64, 46, 132, 5, 162, 254, 51, 0, 0, 195, 90, 10, 246, 127, 175, 154, 145, 0,
      0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ];

    function test(name: string, base64Encode: boolean) {
      const png = new Uint8Array(pngData);
      const data = base64Encode ? Base64EncodedString.fromUint8Array(png) : png;
      const textureId = Texture.insertTexture(imodel, IModel.dictionaryId, name, ImageSourceFormat.Png, data, `A texture named ${name}`);
      expect(Id64.isValidId64(textureId)).to.be.true;

      const texture = imodel.elements.getElement<Texture>(textureId);
      expect(texture).not.to.be.undefined;
      expect(texture).instanceof(Texture);

      expect(texture.format).to.equal(ImageSourceFormat.Png);
      expect(texture.data.length).to.equal(pngData.length);
      expect(Array.from(texture.data)).to.deep.equal(pngData);
      expect(texture.code.value).to.equal(name);
      expect(texture.description).to.equal(`A texture named ${name}`);
    }

    test("bytes", false);
    test("base64", true);
  });

  it("base-64 encodes image data in JSON", () => {
    const props = Texture.createTexture(imodel, IModel.dictionaryId, "update", ImageSourceFormat.Png, new Uint8Array([1, 2, 3]), "").toJSON();
    expect(typeof props.data).to.equal("string");
    expect(Array.from(Base64EncodedString.toUint8Array(props.data))).to.deep.equal([1, 2, 3]);
  });

  it("should update image", () => {
    const textureId = Texture.insertTexture(imodel, IModel.dictionaryId, "update", ImageSourceFormat.Jpeg, new Uint8Array([1, 2, 3]), "");
    const texture = imodel.elements.getElement<Texture>(textureId);
    texture.data = new Uint8Array([4, 5, 6, 7]);
    texture.update();

    const texture2 = imodel.elements.getElement<Texture>(textureId);
    expect(texture2.format).to.equal(ImageSourceFormat.Jpeg);
    expect(Array.from(texture2.data)).to.deep.equal([4, 5, 6, 7]);
  });

  describe("queryTextureData", () => {
    it("reports transparency", async () => {
      // Each test case provides the bytes of a PNG image containing any combination of opaque, transparent, and translucent pixels, where:
      //  opaque has alpha of 241
      //  translucent has alpha of 240
      //  transparent has alpha of 0
      type TestCase = [TextureTransparency, number[]];
      const testCases: TestCase[] = [
        // Opaque
        [TextureTransparency.Opaque, [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 8, 153, 99, 248, 207, 192, 240, 17, 0, 4, 242, 1, 241, 120, 128, 186, 37, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]],
        // Translucent
        [TextureTransparency.Translucent, [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 8, 153, 99, 248, 207, 192, 240, 1, 0, 4, 241, 1, 240, 14, 23, 54, 113, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]],
        // Transparent
        [TextureTransparency.Translucent, [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 8, 153, 99, 248, 207, 192, 192, 0, 0, 4, 1, 1, 0, 101, 81, 193, 74, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]],
        // Opaque+translucent
        [TextureTransparency.Mixed, [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 2, 0, 0, 0, 1, 8, 6, 0, 0, 0, 244, 34, 127, 138, 0, 0, 0, 17, 73, 68, 65, 84, 8, 153, 99, 252, 207, 192, 240, 145, 241, 63, 195, 127, 0, 16, 191, 3, 241, 136, 91, 64, 58, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]],
        // Opaque+transparent
        [TextureTransparency.Mixed, [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 2, 0, 0, 0, 1, 8, 6, 0, 0, 0, 244, 34, 127, 138, 0, 0, 0, 17, 73, 68, 65, 84, 8, 153, 99, 248, 207, 192, 240, 145, 225, 63, 3, 3, 0, 15, 179, 2, 240, 226, 182, 96, 27, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]],
        // Translucent+transparent
        [TextureTransparency.Translucent, [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 2, 0, 0, 0, 1, 8, 6, 0, 0, 0, 244, 34, 127, 138, 0, 0, 0, 17, 73, 68, 65, 84, 8, 153, 99, 248, 207, 192, 240, 129, 225, 63, 3, 3, 0, 15, 174, 2, 239, 92, 238, 220, 37, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]],
        // Opaque+translucent+transparent
        [TextureTransparency.Mixed, [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 3, 0, 0, 0, 1, 8, 6, 0, 0, 0, 27, 224, 20, 180, 0, 0, 0, 21, 73, 68, 65, 84, 8, 153, 99, 248, 207, 192, 240, 145, 225, 63, 195, 7, 6, 134, 255, 12, 0, 34, 33, 4, 223, 53, 29, 74, 186, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]],
        // No alpha channel
        [TextureTransparency.Opaque, [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 144, 119, 83, 222, 0, 0, 0, 12, 73, 68, 65, 84, 8, 153, 99, 248, 207, 192, 0, 0, 3, 1, 1, 0, 156, 227, 191, 89, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]],
      ];

      for (const test of testCases) {
        const textureId = Texture.insertTexture(imodel, IModel.dictionaryId, Guid.createValue(), ImageSourceFormat.Png, new Uint8Array(test[1]));
        expect(Id64.isValidId64(textureId)).to.be.true;

        const data = (await imodel.queryTextureData({ name: textureId }))!;
        expect(data).not.to.be.undefined;
        expect(data.transparency).not.to.be.undefined;
        expect(data.transparency).to.equal(test[0]);
      }
    });
  });
});

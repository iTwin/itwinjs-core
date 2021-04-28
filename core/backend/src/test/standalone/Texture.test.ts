/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64 } from "@bentley/bentleyjs-core";
import { Base64EncodedString, ImageSourceFormat, IModel } from "@bentley/imodeljs-common";
import { SnapshotDb, Texture } from "../../imodeljs-backend";
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
      const textureId = Texture.insert(imodel, IModel.dictionaryId, name, ImageSourceFormat.Png, data, 100, 50, `A texture named ${name}`, 0);
      expect(Id64.isValidId64(textureId)).to.be.true;

      const texture = imodel.elements.getElement<Texture>(textureId);
      expect(texture).not.to.be.undefined;
      expect(texture).instanceof(Texture);

      expect(texture.format).to.equal(ImageSourceFormat.Png);
      expect(texture.data.length).to.equal(pngData.length);
      expect(Array.from(texture.data)).to.deep.equal(pngData);
      expect(texture.width).to.equal(100);
      expect(texture.height).to.equal(50);
      expect(texture.code.value).to.equal(name);
      expect(texture.description).to.equal(`A texture named ${name}`);
      expect(texture.flags).to.equal(0);
    }

    test("bytes", false);
    test("base64", true);
  });

  it("base-64 encodes image data in JSON", () => {
    const props = Texture.create(imodel, IModel.dictionaryId, "update", ImageSourceFormat.Png, new Uint8Array([1, 2, 3]), 10, 20, "", 0).toJSON();
    expect(typeof props.data).to.equal("string");
    expect(Array.from(Base64EncodedString.toUint8Array(props.data))).to.deep.equal([1, 2, 3]);
  });

  it("should update image", () => {
    const textureId = Texture.insert(imodel, IModel.dictionaryId, "update", ImageSourceFormat.Jpeg, new Uint8Array([1, 2, 3]), 10, 20, "", 0);
    const texture = imodel.elements.getElement<Texture>(textureId);
    texture.data = new Uint8Array([4, 5, 6, 7]);
    texture.update();

    const texture2 = imodel.elements.getElement<Texture>(textureId);
    expect(texture2.format).to.equal(ImageSourceFormat.Jpeg);
    expect(Array.from(texture2.data)).to.deep.equal([4, 5, 6, 7]);
  });
});

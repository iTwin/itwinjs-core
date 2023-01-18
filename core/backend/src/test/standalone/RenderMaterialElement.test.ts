/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Id64, Id64String } from "@itwin/core-bentley";
import { ImageSourceFormat, IModel, RenderMaterialAssetProps } from "@itwin/core-common";
import { RenderMaterialElement, SnapshotDb, Texture } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

function removeUndefined(assetProps: RenderMaterialAssetProps): RenderMaterialAssetProps {
  const input = assetProps as any;
  for (const key of Object.keys(input))
    if (input[key] === undefined)
      delete input[key];

  const maps = assetProps.Map as any;
  if (maps) {
    for (const mapsKey of Object.keys(maps)) {
      const map = maps[mapsKey];
      for (const mapKey of Object.keys(map))
        if (map[mapKey] === undefined)
          delete map[mapKey];
    }
  }

  return assetProps;
}

function defaultBooleans(assetProps: RenderMaterialAssetProps): RenderMaterialAssetProps {
  const boolKeys = ["HasBaseColor", "HasDiffuse", "HasFinish", "HasReflect", "HasReflectColor", "HasSpecular", "HasSpecularColor", "HasTransmit"] as const;
  for (const boolKey of boolKeys)
    if (undefined === assetProps[boolKey])
      assetProps[boolKey] = false;

  return assetProps;
}

describe.only("RenderMaterialElement", () => {
  let imodel: SnapshotDb;
  let materialNumber = 0;
  let textureNumber = 0;

  before(() => {
    const seedFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("ExportGraphics", "ExportGraphicsTest.bim");
    imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
  });

  after(() => imodel.close());

  describe("insert", () => {
    function test(params: Omit<RenderMaterialElement.Params, "paletteName">, expected: RenderMaterialAssetProps): RenderMaterialElement {
      const name = `material${++materialNumber}`;
      const paletteName = "palette";
      const id = RenderMaterialElement.insert(imodel, IModel.dictionaryId, name, { ...params, paletteName });
      expect(Id64.isValidId64(id)).to.be.true;

      const mat = imodel.elements.getElement<RenderMaterialElement>(id);
      const json = mat.toJSON();
      expect(json.jsonProperties?.materialAssets?.renderMaterial).not.to.be.undefined;
      const actual = removeUndefined(json.jsonProperties!.materialAssets!.renderMaterial!);

      expected = defaultBooleans(expected);
      expect(actual).to.deep.equal(expected);
      return mat;
    }

    it("with default values", () => {
      test({ }, { });
    });

    it("with custom values", () => {
      const params: Omit<RenderMaterialElement.Params, "paletteName"> = {
        color: [1, 0, 0],
        specularColor: [0, 1, 0],
        finish: 21,
        transmit: 0.5,
        diffuse: 0.2,
        specular: 0.8,
        reflect: 0.5,
        reflectColor: [0, 0, 1],
      };

      test(params, {
        HasBaseColor: true, color: params.color,
        HasSpecularColor: true, specular_color: params.specularColor,
        HasFinish: true, finish: params.finish,
        HasTransmit: true, transmit: params.transmit,
        HasDiffuse: true, diffuse: params.diffuse,
        HasSpecular: true, specular: params.specular,
        HasReflect: true, reflect: params.reflect,
        HasReflectColor: true, reflect_color: params.reflectColor,
      });
    });

    function insertTexture(): Id64String {
      // This is an encoded png containing a 3x3 square with white in top left pixel, blue in middle pixel, and green in
      // bottom right pixel.  The rest of the square is red.
      const pngData = new Uint8Array([
        137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 3, 0, 0, 0, 3, 8, 2, 0, 0, 0, 217,
        74, 34, 232, 0, 0, 0, 1, 115, 82, 71, 66, 0, 174, 206, 28, 233, 0, 0, 0, 4, 103, 65, 77, 65, 0, 0, 177, 143, 11, 252,
        97, 5, 0, 0, 0, 9, 112, 72, 89, 115, 0, 0, 14, 195, 0, 0, 14, 195, 1, 199, 111, 168, 100, 0, 0, 0, 24, 73, 68, 65,
        84, 24, 87, 99, 248, 15, 4, 12, 12, 64, 4, 198, 64, 46, 132, 5, 162, 254, 51, 0, 0, 195, 90, 10, 246, 127, 175, 154, 145, 0,
        0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
      ]);

      const name = `texture${++textureNumber}`;
      const textureId = Texture.insertTexture(imodel, IModel.dictionaryId, name, ImageSourceFormat.Png, pngData);
      expect(Id64.isValidId64(textureId)).to.be.true;
      return textureId;
    }

    it("with pattern map", () => {
      const textureId = insertTexture();
      test({
        patternMap: {
          TextureId: textureId,
        },
      }, {
        Map: {
          Pattern: {
            TextureId: textureId,
          },
        },
      });
    });

    it("with normal and pattern maps", () => {
    });

    it("with normal map", () => {
    });
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { Id64, Id64String } from "@itwin/core-bentley";
import { ImageSourceFormat, IModel, NormalMapFlags, NormalMapProps, RenderMaterialAssetMapsProps, RenderMaterialAssetProps, RenderMaterialProps, TextureMapProps } from "@itwin/core-common";
import { IModelElementCloneContext, RenderMaterialElement, RenderMaterialElementParams, SnapshotDb, Texture } from "../../core-backend";
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

describe("RenderMaterialElement", () => {
  let imodel: SnapshotDb;
  let materialNumber = 0;
  let textureNumber = 0;

  before(() => {
    const seedFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("ExportGraphics", "ExportGraphicsTest.bim");
    imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
  });

  after(() => imodel.close());

  function test(params: Omit<RenderMaterialElementParams, "paletteName">, expected?: RenderMaterialAssetProps): RenderMaterialElement {
    const name = `material${++materialNumber}`;
    const paletteName = "palette";
    const id = RenderMaterialElement.insert(imodel, IModel.dictionaryId, name, { ...params, paletteName });
    expect(Id64.isValidId64(id)).to.be.true;

    const mat = imodel.elements.getElement<RenderMaterialElement>(id);
    const json = mat.toJSON();
    expect(json.jsonProperties?.materialAssets?.renderMaterial).not.to.be.undefined;
    const actual = removeUndefined(json.jsonProperties!.materialAssets!.renderMaterial!);

    if (expected !== undefined) {
      expected = defaultBooleans(expected);
      expect(actual).to.deep.equal(expected);
    }

    return mat;
  }

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

  describe("insert", () => {
    it("with default values", () => {
      test({}, {});
    });

    it("with custom values", () => {
      const params: Omit<RenderMaterialElementParams, "paletteName"> = {
        color: [1, 0, 0],
        specularColor: [0, 1, 0],
        finish: 21,
        transmit: 0.5,
        diffuse: 0.2,
        specular: 0.8,
        reflect: 0.5,
        reflectColor: [0, 0, 1],
      };

      /* eslint-disable @typescript-eslint/naming-convention */
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

    it("pattern map with default values", () => {
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

    it("pattern map with custom values", () => {
      const patternMap: TextureMapProps = {
        TextureId: insertTexture(),
        pattern_angle: 1,
        pattern_u_flip: true,
        pattern_flip: true,
        pattern_scale: [-1, 2],
        pattern_offset: [-2, 1],
        pattern_scalemode: 3,
        pattern_mapping: 4,
        pattern_weight: 0.5,
      };

      test({ patternMap }, { Map: { Pattern: patternMap } });
    });

    it("pattern map with constant lod parameters", () => {
      const patternMap: TextureMapProps = {
        TextureId: insertTexture(),
        pattern_angle: 1,
        pattern_u_flip: true,
        pattern_flip: true,
        pattern_scale: [-1, 2],
        pattern_offset: [-2, 1],
        pattern_scalemode: 3,
        pattern_mapping: 4,
        pattern_weight: 0.5,
        pattern_useconstantlod: true,
        pattern_constantlod_repetitions: 0.333,
        pattern_constantlod_offset: [1000, 2000],
        pattern_constantlod_mindistanceclamp: 4,
        pattern_constantlod_maxdistanceclamp: 256,
      };

      test({ patternMap }, { Map: { Pattern: patternMap } });
    });

    it("normal and pattern maps with default values", () => {
      const normalId = insertTexture();
      const patternId = insertTexture();
      expect(normalId).not.to.equal(patternId);

      test({
        patternMap: { TextureId: patternId },
        normalMap: { TextureId: normalId },
      }, {
        Map: {
          Pattern: { TextureId: patternId },
          Normal: {
            TextureId: normalId,
          },
        },
      });
    });

    it("merges mapping params from normal and pattern maps", () => {
      const normalId = insertTexture();
      const patternId = insertTexture();
      expect(normalId).not.to.equal(patternId);

      const patternMap: TextureMapProps = {
        TextureId: patternId,
        pattern_scale: [-1, 2],
        pattern_weight: 0.5,
      };

      const normalMap: NormalMapProps = {
        TextureId: normalId,
        pattern_angle: 0.8,
        pattern_flip: true,
        pattern_weight: 1.5,
      };

      const sharedProps: Omit<TextureMapProps, "TextureId"> = {
        pattern_scale: patternMap.pattern_scale,
        pattern_weight: patternMap.pattern_weight,
        pattern_angle: normalMap.pattern_angle,
        pattern_flip: normalMap.pattern_flip,
      };

      test({ patternMap, normalMap }, {
        Map: {
          Pattern: {
            ...sharedProps,
            TextureId: patternId,
          },
          Normal: {
            ...sharedProps,
            TextureId: normalId,
          },
        },
      });
    });

    it("normal map with default values", () => {
      const id = insertTexture();
      test({ normalMap: { TextureId: id } }, { Map: { Normal: { TextureId: id } } });
    });

    it("normal map with inverted green channel", () => {
      const id = insertTexture();
      test({
        normalMap: {
          TextureId: id,
          NormalFlags: 1,
        },
      }, {
        Map: {
          Normal: {
            NormalFlags: 1,
            TextureId: id,
          },
        },
      });
    });

    it("normal map with scale", () => {
      const id = insertTexture();
      const scale = 2.5;
      test({
        normalMap: {
          TextureId: id,
          scale,
        },
      }, {
        pbr_normal: 2.5,
        Map: {
          Normal: {
            TextureId: id,
          },
        },
      });
    });

    it("normal map with flags", () => {
      const id = insertTexture();
      test({
        normalMap: {
          TextureId: id,
          NormalFlags: 0xff00 as NormalMapFlags,
        },
      }, {
        Map: {
          Normal: {
            TextureId: id,
            NormalFlags: 0xff00 as NormalMapFlags,
          },
        },
      });
    });

    it("normal map with constant lod parameters", () => {
      const normalMap: NormalMapProps = {
        TextureId: insertTexture(),
        NormalFlags: 2,
        pattern_constantlod_repetitions: 0.333,
        pattern_constantlod_offset: [1000, 2000],
        pattern_constantlod_mindistanceclamp: 4,
        pattern_constantlod_maxdistanceclamp: 256,
      };
      test({ normalMap }, { Map: { Normal: normalMap } });
    });
  });

  describe("clone", () => {
    it("clone maps", () => {
      const textureId = insertTexture();
      const unknownTextureId = "0xffffff";

      expect(Id64.isValidId64(unknownTextureId)).to.be.true;
      expect(imodel.elements.tryGetElementProps(unknownTextureId)).to.be.undefined;

      const maps: RenderMaterialAssetMapsProps = {
        Pattern: { TextureId: textureId },
        Normal: { TextureId: textureId },
        Bump: { TextureId: textureId },
        Diffuse: { TextureId: textureId },
        Finish: { TextureId: textureId },
        GlowColor: { TextureId: textureId },
        Reflect: { TextureId: textureId },
        Specular: { TextureId: textureId },
        TranslucencyColor: { TextureId: textureId },
        TransparentColor: { TextureId: textureId },
        Displacement: { TextureId: textureId },
        ["Unknown" as any]: { TextureId: textureId },
        ["InvalidTexture" as any]: { TextureId: Id64.invalid },
        ["UnknownTexture" as any]: { TextureId: unknownTextureId },
        ["NoTextureId" as any]: { OtherProp: 1 },
      };

      const material = test({});
      const jsonProps = material.jsonProperties as RenderMaterialProps["jsonProperties"];
      assert(jsonProps?.materialAssets?.renderMaterial && jsonProps.materialAssets.renderMaterial.Map === undefined);
      jsonProps.materialAssets.renderMaterial.Map = maps;
      material.update();

      const context = {
        findTargetElementId: (sourceId: Id64String) => {
          expect(typeof sourceId, `bad id: ${sourceId}`).to.equal("string");
          expect(Id64.isId64(sourceId), `bad id: ${sourceId}`).to.be.true;
          return "CLONED";
        },
      } as any as IModelElementCloneContext;

      const sourceProps = material.toJSON();
      const targetProps = structuredClone(sourceProps);

      // eslint-disable-next-line @typescript-eslint/dot-notation
      RenderMaterialElement["onCloned"](context, sourceProps, targetProps);

      expect(targetProps.jsonProperties?.materialAssets?.renderMaterial?.Map).to.deep.equal({
        Pattern: { TextureId: "CLONED" },
        Normal: { TextureId: "CLONED" },
        Bump: { TextureId: "CLONED" },
        Diffuse: { TextureId: "CLONED" },
        Finish: { TextureId: "CLONED" },
        GlowColor: { TextureId: "CLONED" },
        Reflect: { TextureId: "CLONED" },
        Specular: { TextureId: "CLONED" },
        TranslucencyColor: { TextureId: "CLONED" },
        TransparentColor: { TextureId: "CLONED" },
        Displacement: { TextureId: "CLONED" },
        Unknown: { TextureId: "CLONED" },
        InvalidTexture: { TextureId: Id64.invalid },
        UnknownTexture: { TextureId: "CLONED" },
        NoTextureId: { OtherProp: 1 },
      });
    });
  });
});

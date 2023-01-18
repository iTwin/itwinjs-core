/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Id64 } from "@itwin/core-bentley";
import { IModel, RenderMaterialAssetProps } from "@itwin/core-common";
import { RenderMaterialElement, SnapshotDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

function removeUndefined(assetProps: RenderMaterialAssetProps): RenderMaterialAssetProps {
  const input = assetProps as any;
  for (const key of Object.keys(input))
    if (input[key] === undefined)
      delete input[key];

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

  before(() => {
    const seedFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("ExportGraphics", "ExportGraphicsTest.bim");
    imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
  });

  after(() => imodel.close());

  describe("insert", () => {
    function test(params: Omit<RenderMaterialElement.Params, "paletteName">, expected: RenderMaterialAssetProps): RenderMaterialElement {
      const name = (++materialNumber).toString(16);
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

    it("with pattern map", () => {
    });

    it("with normal and pattern maps", () => {
    });

    it("with normal map", () => {
    });
  });
});

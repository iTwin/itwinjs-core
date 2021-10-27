/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ColorDef, RenderMaterial } from "@itwin/core-common";
import { Material } from "../../render/webgl/Material";

// Equivalent to the glsl function used in glsl/Material.ts to unpack a vec3 material param from a packed float value.
function unpackMaterialParam(f: number): XY {
  const v = { x: 0, y: 0, z: 0 };
  v.y = Math.floor(f / 256.0);
  v.x = Math.floor(f - v.y * 256.0);
  return v;
}

// Equivalent to the glsl function used in glsl/Material.ts to unpack and normalize a vec3 material param from a packed float value.
function unpackAndNormalizeMaterialParam(f: number): XY {
  const v = unpackMaterialParam(f);
  v.x /= 255.0;
  v.y /= 255.0;
  return v;
}

interface XY {
  x: number;
  y: number;
}

interface XYZ extends XY {
  z: number;
}

interface PackedMaterialParams {
  x: number; // diffuse and specular weights
  y: number; // texture weight and specular red
  z: number; // specular green and blue
  w: number; // specular exponent
}

function colorFromVec(vec: XYZ): ColorDef {
  return ColorDef.from(vec.x * 255, vec.y * 255, vec.z * 255);
}

interface MaterialParams {
  diffuseColor?: ColorDef;
  diffuse: number;
  transparency: number;
  specular: number;
  specularExponent: number;
  specularColor?: ColorDef;
}

interface DecodedMaterialParams extends MaterialParams {
  rgbOverridden: boolean;
  alphaOverridden: boolean;
  textureWeight: number;
}

function decodeMaterialParams(params: PackedMaterialParams, rgba: Float32Array): DecodedMaterialParams {
  const matWeights = unpackAndNormalizeMaterialParam(params.x);
  const textureWeightAndSpecularR = unpackAndNormalizeMaterialParam(params.y);
  const specularGB = unpackAndNormalizeMaterialParam(params.z);
  const specularExponent = params.w;

  const matSpecular = { x: textureWeightAndSpecularR.y, y: specularGB.x, z: specularGB.y, w: specularExponent };

  const rgbOverridden = -1 !== rgba[0];
  const diffuseColor = rgbOverridden ? ColorDef.from(rgba[0] * 255 + 0.5, rgba[1] * 255 + 0.5, rgba[2] * 255 + 0.5) : undefined;
  const alphaOverridden = -1 !== rgba[3];
  const transparency = alphaOverridden ? 1 - rgba[3] : 0;

  return {
    diffuseColor,
    specularColor: colorFromVec(matSpecular),
    diffuse: matWeights.x,
    specular: matWeights.y,
    textureWeight: textureWeightAndSpecularR.x,
    specularExponent: matSpecular.w,
    transparency,
    rgbOverridden,
    alphaOverridden,
  };
}

function expectEqualFloats(expected: number, actual: number): void {
  const epsilon = 1.0 / 255.0;
  expect(Math.abs(expected - actual)).to.be.at.most(epsilon, `Expected: ${expected} Actual: ${actual}`);
}

function expectMaterialParams(expected: RenderMaterial.Params): void {
  const material = new Material(expected);
  const shaderParams = {
    x: material.fragUniforms[0],
    y: material.fragUniforms[1],
    z: material.fragUniforms[2],
    w: material.fragUniforms[3],
  };

  const actual = decodeMaterialParams(shaderParams, material.rgba);

  expectEqualFloats(expected.diffuse, actual.diffuse);
  expectEqualFloats(actual.specularExponent, expected.specularExponent); // 64-bit => 32-bit

  if (undefined === expected.diffuseColor) {
    expect(actual.diffuseColor).to.be.undefined;
  } else {
    expect(actual.diffuseColor).not.to.be.undefined;
    expect(actual.diffuseColor!.tbgr).to.equal(expected.diffuseColor.tbgr);
  }

  expect(actual.specularColor).not.to.be.undefined;
  if (undefined === expected.specularColor)
    expect(actual.specularColor!.tbgr).to.equal(0xffffff);
  else
    expect(actual.specularColor!.tbgr).to.equal(expected.specularColor.tbgr);

  expect(actual.rgbOverridden).to.equal(undefined !== expected.diffuseColor);
  expect(actual.alphaOverridden).to.equal(undefined !== expected.alpha);

  expect(actual.textureWeight).to.equal(undefined !== material.textureMapping ? material.textureMapping.params.weight : 1.0);
  expectEqualFloats(expected.specular, actual.specular);
  if (undefined !== expected.alpha)
    expectEqualFloats(1.0 - expected.alpha, actual.transparency);
}

function makeMaterialParams(input: MaterialParams): RenderMaterial.Params {
  const params = RenderMaterial.Params.fromColors(undefined, input.diffuseColor, input.specularColor);
  params.diffuse = input.diffuse;
  params.alpha = 1.0 - input.transparency;
  params.specular = input.specular;
  params.specularExponent = input.specularExponent;
  return params;
}

describe("Material", () => {
  it("should pack and unpack parameters", () => {
    expectMaterialParams(makeMaterialParams({
      diffuseColor: ColorDef.black,
      diffuse: 0.0,
      transparency: 0.0,
      specular: 0.0,
      specularExponent: 0.0,
      specularColor: ColorDef.black,
    }));

    expectMaterialParams(makeMaterialParams({
      diffuseColor: ColorDef.white,
      diffuse: 1.0,
      transparency: 1.0,
      specular: 1.0,
      specularExponent: 1234.5,
      specularColor: ColorDef.white,
    }));

    expectMaterialParams(makeMaterialParams({
      diffuseColor: ColorDef.red,
      diffuse: 0.95,
      transparency: 0.12,
      specular: 0.7,
      specularExponent: -5.4321,
      specularColor: ColorDef.blue,
    }));

    expectMaterialParams(RenderMaterial.Params.defaults);
  });
});

/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
// import { GL } from "../../frontend/render/GL";
// import { Handle, BufferHandle } from "../../frontend/render/Handle";
import { FeatureIndexType, FeatureIndex } from "../../frontend/render/FeatureIndex";
import { FeatureIndices } from "../../frontend/render/CachedGeometry";

// ###TODO: canvas.getContext() returns null on PRG...GPU should not be required
const haveWebGL = false;

function getWebGLContext(): WebGLRenderingContext | null {
  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  assert.isNotNull(canvas);

  if (null === canvas) {
    return null;
  }

  document.body.appendChild(canvas);
  return canvas.getContext("webgl");
}

describe("FeatureIndices", () => {
  it("should create and use FeatureIndices", () => {
    // Get WebGL context
    const gl = getWebGLContext();
    if (haveWebGL) {
      assert.isNotNull(gl, "WebGLContext is null");
    }
    if (null === gl) {
      return;
    }

    // Test empty FeatureIndices
    const fIndex1 = new FeatureIndex();
    let fIndices: FeatureIndices = new FeatureIndices(gl, fIndex1);
    assert.isTrue(fIndices.isEmpty(), "FeatureIndices created with empty data should be empty");
    assert.isFalse(fIndices.isUniform(), "FeatureIndices created with empty data should not be uniform");

    // Test Uniform FeatureIndices
    const uniformData: number = 42;
    const fIndex2 = new FeatureIndex();
    fIndex2.type = FeatureIndexType.kUniform;
    fIndex2.featureID = uniformData;
    fIndices = new FeatureIndices(gl, fIndex2);
    assert.isFalse(fIndices.isEmpty(), "FeatureIndices created with uniform data should not be empty");
    assert.isTrue(fIndices.isUniform(), "FeatureIndices created with uniform data should be uniform");
    assert.isTrue(uniformData === fIndices.uniform, "FeatureIndices created with uniform data should return it");

    // Test NonUniform FeatureIndices
    const nonUniformData: number[] = [];
    for (let i = 0; i < 10; ++i) {
      nonUniformData[i] = 10 - i;
    }
    const fIndex3 = new FeatureIndex();
    fIndex3.type = FeatureIndexType.kNonUniform;
    fIndex3.featureIDs = new Uint32Array(nonUniformData);
    fIndices = new FeatureIndices(gl, fIndex3, 10);
    assert.isFalse(fIndices.isEmpty(), "FeatureIndices created with nonuniform data should not be empty");
    assert.isFalse(fIndices.isUniform(), "FeatureIndices created with nonuniform data should not be uniform");
  });
});

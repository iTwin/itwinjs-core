/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { GL } from "@bentley/imodeljs-frontend/lib/render/webgl/GL";
import { BufferHandle } from "@bentley/imodeljs-frontend/lib/render/webgl/Handle";
import { FeatureIndexType, FeatureIndex } from "@bentley/imodeljs-frontend/lib/render/webgl/FeatureIndex";
import { FeatureIndices } from "@bentley/imodeljs-frontend/lib/render/webgl/CachedGeometry";

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
    const numVerts = 10;
    const nonUniformData: number[] = [];
    for (let i = 0; i < numVerts; ++i) {
      nonUniformData[i] = numVerts - i;
    }
    const fIndex3 = new FeatureIndex();
    fIndex3.type = FeatureIndexType.kNonUniform;
    fIndex3.featureIDs = new Uint32Array(nonUniformData);
    fIndices = new FeatureIndices(gl, fIndex3, numVerts);
    assert.isFalse(fIndices.isEmpty(), "FeatureIndices created with nonuniform data should not be empty");
    assert.isFalse(fIndices.isUniform(), "FeatureIndices created with nonuniform data should not be uniform");
    if (undefined !== fIndices.nonUniform) {
      fIndices.nonUniform.bind(gl, GL.Buffer.ArrayBuffer);
      const size = gl.getBufferParameter(GL.Buffer.ArrayBuffer, GL.Buffer.BufferSize);
      assert.isTrue(numVerts * 4 === size, "nonUniform FeatureIndices for " + numVerts + " vertices should result in buffer of size " + (numVerts * 4));
      const usage = gl.getBufferParameter(GL.Buffer.ArrayBuffer, GL.Buffer.BufferUsage);
      assert.isTrue(GL.BufferUsage.StaticDraw === usage, "nonUniform FeatureIndices should result in buffer with usage of StaticDraw");
      BufferHandle.unBind(gl, GL.Buffer.ArrayBuffer);
    }
  });
});

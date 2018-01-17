/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { GL } from "@build/imodeljs-core/lib/frontend/render/GL";
import { RenderState } from "@build/imodeljs-core/lib/frontend/render/RenderState";

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

describe("WebGL context tests", () => {
  it("should obtain valid WebGL context", () => {
    const gl = getWebGLContext();
    if (haveWebGL) {
      assert.isNotNull(gl);
    }
  });
});

describe("RenderState API", () => {
  it("should compare as expected", () => {
    let a = new RenderState();
    assert.isTrue(a.equals(a));

    const b = new RenderState();
    assert.isTrue(a.equals(b));
    assert.isTrue(b.equals(a));
    a.flags.depthTest = true;
    assert.isFalse(a.equals(b));
    b.flags.depthTest = true;
    assert.isTrue(a.equals(b));

    b.depthFunc = GL.DepthFunc.NotEqual;
    assert.isFalse(a.equals(b));

    a = new RenderState(b);
    assert.isTrue(a.equals(b));

    a = b.clone();
    assert.isTrue(a.equals(b));

    a.flags.depthTest = false;
    assert.isFalse(b.equals(a));

    b.copyFrom(a);
    assert.isTrue(b.equals(a));
  });
});

describe("RenderState.apply()", () => {
  it("should apply state", () => {
    const gl = getWebGLContext();
    if (haveWebGL) {
      assert.isNotNull(gl);
    }

    if (null === gl) {
      return;
    }

    assert.isTrue(gl.getParameter(GL.Capability.DepthWriteMask) === true, "depth mask should be enabled by default");

    const prevState = new RenderState();
    const newState = new RenderState();

    newState.flags.depthMask = false;
    newState.apply(gl, prevState);
    assert.isTrue(gl.getParameter(GL.Capability.DepthWriteMask) === false, "depth mask should now be disabled");

    prevState.copyFrom(newState);
    assert.isTrue(gl.getParameter(GL.Capability.DepthTest) === false, "depth test should be disabled by default");

    newState.flags.depthTest = true;
    newState.depthFunc = GL.DepthFunc.Always;
    newState.apply(gl, prevState);
    assert.isTrue(gl.getParameter(GL.Capability.DepthTest) === true, "depth test should now be enabled");
    const depthFunc: GL.DepthFunc = gl.getParameter(GL.Capability.DepthFunc) as GL.DepthFunc;
    assert.isTrue(gl.getParameter(GL.Capability.DepthFunc) === GL.DepthFunc.Always, "depth func should be ALWAYS but is " + GL.DepthFunc[depthFunc]);
    });
});

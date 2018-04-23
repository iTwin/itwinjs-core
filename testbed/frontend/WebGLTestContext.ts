/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";

export class WebGLTestContext {
  // ###TODO: on PRG, canvas.getContext() returns null? We will want these tests to run on PRG eventually...
  // For now, set this to true locally to run the tests which require a WebGLRenderingContext.
  private static haveWebGL = false;
  public readonly canvas: HTMLCanvasElement | null = null;
  public readonly gl: WebGLRenderingContext | null = null;

  public constructor() {
    if (!WebGLTestContext.haveWebGL) {
      return;
    }

    this.canvas = document.createElement("canvas") as HTMLCanvasElement;
    assert(null !== this.canvas);
    if (null === this.canvas) {
      return;
    }

    document.body.appendChild(this.canvas);
    let gl = this.canvas.getContext("webgl");
    if (null === gl) {
      gl = this.canvas.getContext("experimental-webgl"); // IE/Edge...
    }

    this.gl = gl;
    assert(null != this.gl);
  }

  public get isValid() { return null != this.gl; }
}

export function getWebGLContext(): WebGLRenderingContext | null {
  const context = new WebGLTestContext();
  return context.gl;
}

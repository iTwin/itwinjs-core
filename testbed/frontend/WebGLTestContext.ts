/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";

export class WebGLTestContext {
  // ###TODO: on PRG, canvas.getContext() returns null? We will want these tests to run on PRG eventually...
  // For now, set this to true locally to run the tests which require a WebGLRenderingContext.
  private static haveWebGL = false;
  public readonly canvas?: HTMLCanvasElement = undefined;
  public readonly gl?: WebGLRenderingContext = undefined;

  public constructor() {
    if (!WebGLTestContext.haveWebGL) {
      return;
    }

    const canvas = document.createElement("canvas") as HTMLCanvasElement;
    if (null === canvas) {
      return;
    }

    document.body.appendChild(canvas);
    this.canvas = canvas;

    let gl = canvas.getContext("webgl");
    if (null === gl) {
      gl = this.canvas.getContext("experimental-webgl"); // IE/Edge...
    }

    if (null !== gl) {
      this.gl = gl;
    }

    assert(undefined !== this.gl);
  }

  public get isValid() { return undefined !== this.gl; }
}

export function getWebGLContext(): WebGLRenderingContext | undefined {
  const context = new WebGLTestContext();
  return context.gl;
}

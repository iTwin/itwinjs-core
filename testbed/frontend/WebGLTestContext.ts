/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";

export class WebGLTestContext {
  // ###TODO: on PRG, canvas.getContext() returns null? We will want these tests to run on PRG eventually...
  // For now, set this to true locally to run the tests which require a WebGLRenderingContext.
  public static isEnabled = false;
  public readonly canvas?: HTMLCanvasElement = undefined;
  public readonly context?: WebGLRenderingContext = undefined;

  public constructor() {
    if (!WebGLTestContext.isEnabled) {
      return;
    }

    this.canvas = WebGLTestContext.createCanvas();
    if (undefined === this.canvas) {
      return;
    }

    let context = this.canvas.getContext("webgl");
    if (null === context) {
      context = this.canvas.getContext("experimental-webgl"); // IE/Edge...
    }

    if (null !== context) {
      this.context = context;
    }

    assert(undefined !== this.context);
  }

  public get isValid() { return undefined !== this.context; }

  public static createCanvas(): HTMLCanvasElement | undefined {
    const canvas = document.createElement("canvas") as HTMLCanvasElement;
    if (null === canvas) {
      return undefined;
    }

    document.body.appendChild(canvas);
    return canvas;
  }
}

export function getWebGLContext(): WebGLRenderingContext | undefined {
  const context = new WebGLTestContext();
  return context.context;
}

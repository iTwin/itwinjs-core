/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { IModelApp } from "@bentley/imodeljs-frontend";

export namespace WebGLTestContext {
  // When executing on the continuous integration server, we fail to obtain a WebGLRenderingContext.
  // Need to determine why, and how to fix.
  // Bill Goehrig claims one or both of these env vars will be defined when executing on the CI server.
  function isEnabled(): boolean { return undefined === process.env.CI && undefined === process.env.TF_BUILD; }

  const canvasId = "WebGLTestCanvas";

  function createCanvas(width: number, height: number): HTMLCanvasElement | undefined {
    let canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (null === canvas) {
      canvas = document.createElement("canvas") as HTMLCanvasElement;
      if (null === canvas) {
        return undefined;
      }

      canvas.id = canvasId;
      document.body.appendChild(document.createTextNode("WebGL tests"));
      document.body.appendChild(canvas);
    }

    canvas.width = width;
    canvas.height = height;

    return canvas;
  }

  export let isInitialized = false;

  export function startup(canvasWidth: number = 300, canvasHeight: number = 150) {
    if (!isEnabled()) {
      return;
    }

    const canvas = createCanvas(canvasWidth, canvasHeight);
    assert(undefined !== canvas);
    if (undefined !== canvas) {
      IModelApp.startup("QA", canvas);
      isInitialized = IModelApp.hasRenderSystem;
      assert(isInitialized);
    }
  }

  export function shutdown() {
    isInitialized = false;
    if (IModelApp.initialized) {
      IModelApp.shutdown();
    }
  }
}

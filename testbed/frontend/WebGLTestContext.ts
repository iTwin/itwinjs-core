/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { IModelApp } from "@bentley/imodeljs-frontend";

export namespace WebGLTestContext {
  // When executing on the continuous integration server, we fail to obtain a WebGLRenderingContext.
  // Need to determine why, and how to fix.
  // For now, all tests requiring WebGL are disabled by default; enable in developer builds by setting
  // isEnabled to true.
  const isEnabled = false;
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
    if (!isEnabled) {
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

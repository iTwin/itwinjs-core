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
  const isEnabled = true;
  const canvasId = "WebGLTestCanvas";

  function createCanvas(): HTMLCanvasElement | undefined {
    let canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (null !== canvas) {
      return canvas;
    }

    canvas = document.createElement("canvas") as HTMLCanvasElement;
    if (null === canvas) {
      return undefined;
    }

    canvas.width = 300;
    canvas.height = 150;
    canvas.id = canvasId;

    document.body.appendChild(document.createTextNode("WebGL tests"));
    document.body.appendChild(canvas);
    return canvas;
  }

  export let isInitialized = false;

  export function startup() {
    if (!isEnabled) {
      return;
    }

    const canvas = createCanvas();
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

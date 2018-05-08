/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { IModelApp } from "@bentley/imodeljs-frontend";

export namespace WebGLTestContext {
  // When executing on the continuous integration server, we fail to obtain a WebGLRenderingContext.
  // Need to determine why, and how to fix.
  // Bill Goehrig claims one or both of these env vars will be defined when executing on the CI server.
  function isEnabled(): boolean { return undefined === process.env.CI && undefined === process.env.TF_BUILD && undefined === process.env.BENTLEY_CI_BUILD; }

  export let isInitialized = false;

  export function startup() {
    if (!isEnabled()) {
      return;
    }

    IModelApp.startup("QA", true);
    isInitialized = IModelApp.hasRenderSystem;
    assert(isInitialized);
  }

  export function shutdown() {
    isInitialized = false;
    if (IModelApp.initialized) {
      IModelApp.shutdown();
    }
  }

  const canvasId = "WebGLTestCanvas";

  export function createCanvas(width: number = 300, height: number = 150): HTMLCanvasElement | undefined {
    let canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (null === canvas) {
      canvas = document.createElement("canvas") as HTMLCanvasElement;
      if (null === canvas) return undefined;

      canvas.id = canvasId;
      document.body.appendChild(document.createTextNode("WebGL tests"));
      document.body.appendChild(canvas);
    }

    canvas.width = width;
    canvas.height = height;

    return canvas;
  }
}

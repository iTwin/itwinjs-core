/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { IModelApp } from "@bentley/imodeljs-frontend";

export namespace WebGLTestContext {
  // ###TODO: on PRG, canvas.getContext() returns null? We will want these tests to run on PRG eventually...
  // For now, set this to true locally to run the tests which require a WebGLRenderingContext.
  const isEnabled = false;

  function createCanvas(): HTMLCanvasElement | undefined {
    const canvas = document.createElement("canvas") as HTMLCanvasElement;
    if (null === canvas) {
      return undefined;
    }

    document.body.appendChild(canvas);
    return canvas;
  }

  export function startup() {
    if (!isEnabled) {
      return;
    }

    const canvas = createCanvas();
    assert(undefined !== canvas);
    if (undefined !== canvas) {
      IModelApp.startup("QA", canvas);
      assert(IModelApp.hasRenderSystem);
    }
  }

  export function shutdown() {
    if (IModelApp.initialized) {
      IModelApp.shutdown();
    }
  }
}

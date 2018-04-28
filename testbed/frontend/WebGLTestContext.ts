/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { IModelApp } from "@bentley/imodeljs-frontend";

export namespace WebGLTestContext {
  // When tests requiring a WebGLRenderingContext were first introduced, they appeared to fail to obtain
  // the context when executed on the continuous integration server. As a temporary workaround we added
  // this flag, set to false, which could be manually set to true in developer build to enable such tests.
  // Not clear if this is still required.
  const isEnabled = true;

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

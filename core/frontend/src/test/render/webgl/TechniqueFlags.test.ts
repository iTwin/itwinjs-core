/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IsEdgeTestNeeded, TechniqueFlags } from "../../../render/webgl/TechniqueFlags";
import { System } from "../../../render/webgl/System";

/** Overrides the WebGL context's "unmasked renderer" string. */
class TestSystem extends System {
  private static _renderer: string;

  public static createContext(canvas: HTMLCanvasElement, useWebGL2: boolean, inputContextAttributes?: WebGLContextAttributes): WebGLRenderingContext | WebGL2RenderingContext | undefined {
    const ctx = System.createContext(canvas, useWebGL2, inputContextAttributes);
    if (ctx) {
      const ext = ctx.getExtension("WEBGL_debug_renderer_info")!;
      if (ext) {
        const getParameter = ctx.getParameter.bind(ctx);
        ctx.getParameter = (name: number) => { // eslint-disable-line @typescript-eslint/unbound-method
          return (name === ext.UNMASKED_RENDERER_WEBGL) ? this._renderer : getParameter(name);
        };
      }
    }

    return ctx;
  }

  public static createSystem(unmaskedRenderer: string): System {
    this._renderer = unmaskedRenderer;
    return this.create();
  }

  protected async handleContextLoss(): Promise<void> {
    // Base class wants to translate a localized string, which requires us to call IModelApp.startup().
    // We're going to trigger context loss because we're creating a large number of contexts. We don't care.
  }
}

describe("TechniqueFlags", () => {
  afterEach(() => {
    TechniqueFlags.requireEdgeTest = false;
  });

  it("should force surface discard for buggy drivers", () => {
    const test = (expectSurfaceDiscardRequired: boolean) => {
      expect(TechniqueFlags.requireEdgeTest).to.equal(expectSurfaceDiscardRequired);

      const flags = new TechniqueFlags();
      expect(flags.isEdgeTestNeeded === IsEdgeTestNeeded.Yes).to.equal(expectSurfaceDiscardRequired);

      flags.isEdgeTestNeeded = IsEdgeTestNeeded.Yes;
      expect(flags.isEdgeTestNeeded === IsEdgeTestNeeded.Yes).to.be.true;

      flags.isEdgeTestNeeded = IsEdgeTestNeeded.No;
      expect((flags as any).isEdgeTestNeeded === IsEdgeTestNeeded.Yes).to.equal(expectSurfaceDiscardRequired);
    };

    const renderers: Array<[string, boolean]> = [
      [ "ANGLE (Intel(R) HD Graphics 630 Direct3D11 vs_5_0 ps_5_0)", true ],
      [ "ANGLE (Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)", true ],
      [ "ANGLE (Intel(R) HD Graphics 620 Direct3D11 vs_5_0 ps_5_0)", true ],
      [ "ANGLE (Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)", true ],
      [ "ANGLE (Intel HD Graphics 620 Direct3D11 vs_5_0 ps_5_0)", false ],

      // Bug only confirmed on 620 and 630
      [ "ANGLE (Intel(R) HD Graphics 610 Direct3D11 vs_5_0 ps_5_0)", false ],
      [ "ANGLE (Intel(R) HD Graphics 610 Direct3D11 vs_5_0 ps_5_0)", false ],
      [ "ANGLE (Intel(R) HD Graphics 615 Direct3D11 vs_5_0 ps_5_0)", false ],
      [ "ANGLE (Intel(R) HD Graphics 500 Direct3D11 vs_5_0 ps_5_0)", false ],
      [ "ANGLE (Intel(R) UHD Graphics 520 Direct3D11 vs_5_0 ps_5_0)", false ],
      [ "ANGLE (Intel(R) UHD Graphics 615 Direct3D11 vs_5_0 ps_5_0)", false ],
      [ "ANGLE (Intel(R) UHD Graphics 500 Direct3D11 vs_5_0 ps_5_0)", false ],
      [ "ANGLE (Intel(R) UHD Graphics 520 Direct3D11 vs_5_0 ps_5_0)", false ],

      // Bug only confirmed for Direct3D11; if Direct3D11 not present, we're not on Windows or using a different renderer.
      [ "ANGLE (Intel(R) HD Graphics 630)", false ],
      [ "ANGLE (Intel(R) UHD Graphics 630)", false ],
      [ "ANGLE (Intel(R) HD Graphics 620)", false ],
      [ "ANGLE (Intel(R) UHD Graphics 620)", false ],
      [ "ANGLE (Intel HD Graphics 620)", false ],
      [ "ANGLE (Intel(R) UHD Graphics 610)", false ],

      // Bug only confirmed on Windows; if ANGLE not present, we're not running on Windows.
      [ "Intel(R) HD Graphics 630", false ],
      [ "Intel(R) UHD Graphics 630", false ],
      [ "Intel(R) HD Graphics 620", false ],
      [ "Intel(R) UHD Graphics 620", false ],
      [ "Intel HD Graphics 620", false ],
      [ "Intel(R) UHD Graphics 610", false ],

      [ "ANGLE (NVIDIA GeForce GTX 970 Direct3D11 vs_5_0 ps_5_0)", false ],
    ];

    test(false);

    for (const renderer of renderers) {
      // The System constructor overrides TechniqueFlags.requireEdgeTest. In real usage, System is a singleton accessed via IModelApp.renderSystem.
      const system = TestSystem.createSystem(renderer[0]);
      test(renderer[1]);
      system.dispose();
    }
  });
});

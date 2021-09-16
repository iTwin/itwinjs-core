/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  CachedDecoration, CanvasDecoration, DecorateContext, DecorationsCache, Decorator, GraphicType, IModelApp, IModelConnection, ScreenViewport, SnapshotConnection,
} from "@bentley/imodeljs-frontend";
import { ScreenTestViewport, testOnScreenViewport } from "../TestViewport";
import { Point3d } from "@bentley/geometry-core";
import { Graphic, GraphicOwner } from "@bentley/imodeljs-frontend/lib/webgl";

describe("Cached decorations", () => {
  let imodel: IModelConnection;

  before(async () => {
    await IModelApp.startup();
    imodel = await SnapshotConnection.openFile("mirukuru.ibim"); // relative path resolved by BackendTestAssetResolver
  });

  after(async () => {
    if (imodel) await imodel.close();
    await IModelApp.shutdown();
  });

  class TestCanvasDecoration implements CanvasDecoration {
    public drawDecoration(_ctx: CanvasRenderingContext2D): void { }
  }

  class TestDecorator implements Decorator {
    private _type: "graphic" | "html" | "canvas";
    private _useCachedDecorations: boolean;
    public get useCachedDecorations() { return this._useCachedDecorations ? true : undefined; }
    public decorate(context: DecorateContext) {
      switch (this._type) {
        case "graphic":
          const builder = context.createGraphicBuilder(GraphicType.ViewOverlay);
          builder.addPointString([new Point3d(0, 0, 0)]);
          context.addDecorationFromBuilder(builder);
          break;
        case "html":
          context.addHtmlDecoration(document.createElement("div"));
          break;
        case "canvas":
          context.addCanvasDecoration(new TestCanvasDecoration());
          break;
      }
    }
    public constructor(type: "graphic" | "html" | "canvas", useCachedDecorations: boolean) {
      this._type = type;
      this._useCachedDecorations = useCachedDecorations;
    }
  }

  // Drop the decorator and ensure no decorations are cached anymore.
  async function dropAndVerifyEmptyCache(vp: ScreenTestViewport, dec: Decorator, cache: DecorationsCache) {
    IModelApp.viewManager.dropDecorator(dec);
    await vp.drawFrame();
    expect(cache.size).to.equal(0);
    expect(cache.get(dec)).to.be.undefined;
  }

  function verifyGraphicDecorationDisposed(decoration: CachedDecoration) {
    expect("graphic" === decoration.type);
    if ("graphic" === decoration.type) {
      const graphicOwner = decoration.graphicOwner as GraphicOwner;
      const graphic = graphicOwner.graphic as Graphic;
      expect(graphicOwner.isDisposed).to.be.true;
      expect(graphic.isDisposed).to.be.true;
    }
  }

  function getDecorationsCache(vp: ScreenTestViewport): DecorationsCache {
    const cache = (vp as any)._decorationCache as DecorationsCache;
    expect(cache).not.to.be.undefined;
    expect(cache).instanceof(DecorationsCache);
    return cache;
  }

  async function testCachedDecorations(type: "graphic" | "html" | "canvas") {
    await testOnScreenViewport("0x24", imodel, 200, 150, async (vp) => {
      await vp.waitForAllTilesToRender();

      const cache = getDecorationsCache(vp);

      // Add no decorators and ensure no decorations have been cached.
      await vp.drawFrame();
      expect(cache.size).to.equal(0);

      // Add non-cachable decorator and ensure no decorations have been cached.
      const nonCachableDecorator = new TestDecorator(type, false);
      IModelApp.viewManager.addDecorator(nonCachableDecorator);
      await vp.drawFrame();
      expect(cache.size).to.equal(0);
      expect(cache.get(nonCachableDecorator)).to.be.undefined;

      // Add a cachable decorator and ensure one decoration has been cached.
      const cachableDecoratorA = new TestDecorator(type, true);
      IModelApp.viewManager.addDecorator(cachableDecoratorA);
      await vp.drawFrame();
      expect(cache.size).to.equal(1);
      const cachedA = cache.get(cachableDecoratorA);
      expect(cachedA).to.not.be.undefined;
      expect(cachedA!.length).to.equal(1); // verify only one decoration was added (as seen above in decorate())
      const cachedDecorationA = cachedA![0];

      await dropAndVerifyEmptyCache(vp, cachableDecoratorA, cache);
      if ("graphic" === type)
        verifyGraphicDecorationDisposed(cachedDecorationA);

      // Add another cachable decorator and ensure one decoration has been cached.
      const cachableDecoratorB = new TestDecorator(type, true);
      IModelApp.viewManager.addDecorator(cachableDecoratorB);
      await vp.drawFrame();
      expect(cache.size).to.equal(1);
      const cachedB = cache.get(cachableDecoratorB);
      expect(cachedB).to.not.be.undefined;
      expect(cachedB!.length).to.equal(1); // verify only one decoration was added (as seen above in decorate())
      const cachedDecorationB = cachedB![0];
      expect(cachedDecorationB !== cachedDecorationA).to.be.true; // verify that the new cached decoration is not the old one

      // Invalidate viewport's decorations but do not invalidate the cached decorations; verify the cached decoration graphic remains.
      vp.invalidateDecorations();
      await vp.drawFrame();
      const cachedC = cache.get(cachableDecoratorB);
      expect(cachedC).to.not.be.undefined;
      expect(cachedC!.length).to.equal(1); // verify only one decoration was added (as seen above in decorate())
      const cachedDecorationC = cachedC![0];
      expect(cachedDecorationC === cachedDecorationB).to.be.true; // verify that this cached decoration is the previous one

      await dropAndVerifyEmptyCache(vp, cachableDecoratorB, cache);
      if ("graphic" === type)
        verifyGraphicDecorationDisposed(cachedDecorationB);

      IModelApp.viewManager.dropDecorator(nonCachableDecorator);
    });
  }

  it("should properly cache graphic decorations", async () => {
    await testCachedDecorations("graphic");
  });

  it("should properly cache canvas decorations", async () => {
    await testCachedDecorations("canvas");
  });

  it("should properly cache html decorations", async () => {
    await testCachedDecorations("html");
  });

  it("should prohibit removal while decorating", async () => {
    const cachedDecorator = new TestDecorator("graphic", true);

    async function test(decorateFunc: (vp: ScreenViewport) => void, expectRemovalAfterDecorate = true): Promise<void> {
      await testOnScreenViewport("0x24", imodel, 200, 150, async (vp) => {
        IModelApp.viewManager.addDecorator(cachedDecorator);

        const badDecorator = {
          decorate: (context: DecorateContext) => {
            decorateFunc(context.viewport);
          },
        };
        IModelApp.viewManager.addDecorator(badDecorator);

        const cache = getDecorationsCache(vp);
        expect(cache.size).to.equal(0);

        await vp.drawFrame();
        expect(cache.size).to.equal(1);

        decorateFunc(vp);
        expect(cache.size).to.equal(expectRemovalAfterDecorate ? 0 : 1);

        IModelApp.viewManager.dropDecorator(cachedDecorator);
        IModelApp.viewManager.dropDecorator(badDecorator);
      });
    }

    await test((vp) => vp.invalidateScene());
    await test((vp) => vp.invalidateRenderPlan());
    await test((vp) => vp.invalidateCachedDecorations(cachedDecorator));
    await test((vp) => vp.invalidateDecorations(), false);
  });
});

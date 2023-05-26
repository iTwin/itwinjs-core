/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { UnexpectedErrors } from "@itwin/core-bentley";
import { Point2d } from "@itwin/core-geometry";
import {
  AnalysisStyle, ColorDef, EmptyLocalization, ImageBuffer, ImageBufferFormat, ImageMapLayerSettings,
} from "@itwin/core-common";
import { ViewRect } from "../common/ViewRect";
import { ScreenViewport } from "../Viewport";
import { DisplayStyle3dState } from "../DisplayStyleState";
import { IModelApp } from "../IModelApp";
import { openBlankViewport, testBlankViewport, testBlankViewportAsync } from "./openBlankViewport";
import { DecorateContext } from "../ViewContext";
import { GraphicType } from "../render/GraphicBuilder";
import { Pixel } from "../render/Pixel";

describe("Viewport", () => {
  before(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  after(async () => IModelApp.shutdown());

  describe("flashedId", () => {
    type ChangedEvent = [string | undefined, string | undefined];

    function expectFlashedId(viewport: ScreenViewport, expectedId: string | undefined, expectedEvent: ChangedEvent | undefined, func: () => void): void {
      let event: ChangedEvent | undefined;
      const removeListener = viewport.onFlashedIdChanged.addListener((vp, arg) => {
        expect(vp).to.equal(viewport);
        expect(event).to.be.undefined;
        event = [arg.previous, arg.current];
      });

      func();
      removeListener();

      expect(viewport.flashedId).to.equal(expectedId);
      expect(event).to.deep.equal(expectedEvent);
    }

    it("dispatches events when flashed Id changes", () => {
      testBlankViewport((viewport) => {
        expectFlashedId(viewport, "0x123", [undefined, "0x123"], () => viewport.flashedId = "0x123");
        expectFlashedId(viewport, "0x456", ["0x123", "0x456"], () => viewport.flashedId = "0x456");
        expectFlashedId(viewport, "0x456", undefined, () => viewport.flashedId = "0x456");
        expectFlashedId(viewport, undefined, ["0x456", undefined], () => viewport.flashedId = undefined);
        expectFlashedId(viewport, undefined, undefined, () => viewport.flashedId = undefined);
      });
    });

    it("treats invalid Id as undefined", () => {
      testBlankViewport((viewport) => {
        viewport.flashedId = "0x123";
        expectFlashedId(viewport, undefined, ["0x123", undefined], () => viewport.flashedId = "0");
        viewport.flashedId = "0x123";
        expectFlashedId(viewport, undefined, ["0x123", undefined], () => viewport.flashedId = undefined);
      });
    });

    it("rejects malformed Ids", () => {
      testBlankViewport((viewport) => {
        expectFlashedId(viewport, undefined, undefined, () => viewport.flashedId = "not an id");
        viewport.flashedId = "0x123";
        expectFlashedId(viewport, "0x123", undefined, () => viewport.flashedId = "not an id");
      });
    });

    it("prohibits assignment from within event callback", () => {
      testBlankViewport((viewport) => {
        const oldHandler = UnexpectedErrors.setHandler(UnexpectedErrors.reThrowImmediate);
        viewport.onFlashedIdChanged.addOnce(() => viewport.flashedId = "0x12345");
        expect(() => viewport.flashedId = "0x12345").to.throw(Error, "Cannot assign to Viewport.flashedId from within an onFlashedIdChanged event callback");
        UnexpectedErrors.setHandler(oldHandler);
      });
    });
  });

  describe("analysis style changed events", () => {
    it("registers and unregisters for multiple events", () => {
      testBlankViewport((viewport) => {
        function expectListeners(expected: boolean): void {
          const expectedNum = expected ? 1 : 0;
          expect(viewport.onChangeView.numberOfListeners).to.equal(expectedNum);

          // The viewport registers its own listener for each of these.
          expect(viewport.view.onDisplayStyleChanged.numberOfListeners).to.equal(expectedNum + 1);
          expect(viewport.displayStyle.settings.onAnalysisStyleChanged.numberOfListeners).to.equal(expectedNum + 1);
        }

        expectListeners(false);
        const removeListener = viewport.addOnAnalysisStyleChangedListener(() => undefined);
        expectListeners(true);
        removeListener();
        expectListeners(false);
      });
    });

    it("emits events when analysis style changes", () => {
      testBlankViewport((viewport) => {
        type EventPayload = AnalysisStyle | "undefined" | "none";
        function expectChangedEvent(expectedPayload: EventPayload, func: () => void): void {
          let payload: EventPayload = "none";
          const removeListener = viewport.addOnAnalysisStyleChangedListener((style) => {
            expect(payload).to.equal("none");
            payload = style ?? "undefined";
          });

          func();
          removeListener();
          expect(payload).to.equal(expectedPayload);
        }

        const a = AnalysisStyle.fromJSON({ normalChannelName: "a" });

        expectChangedEvent(a, () => viewport.displayStyle.settings.analysisStyle = a);
        expectChangedEvent("none", () => viewport.displayStyle.settings.analysisStyle = a);

        const b = AnalysisStyle.fromJSON({ normalChannelName: "b" });
        expectChangedEvent(b, () => {
          const style = viewport.displayStyle.clone();
          style.settings.analysisStyle = b;
          viewport.displayStyle = style;
        });

        const c = AnalysisStyle.fromJSON({ normalChannelName: "c" });
        expectChangedEvent(c, () => {
          const view = viewport.view.clone();
          expect(view.displayStyle).not.to.equal(viewport.view.displayStyle);
          view.displayStyle.settings.analysisStyle = c;
          viewport.changeView(view);
        });

        expectChangedEvent("undefined", () => viewport.displayStyle.settings.analysisStyle = undefined);
        expectChangedEvent("none", () => viewport.displayStyle.settings.analysisStyle = undefined);
      });
    });
  });

  describe("background map", () => {
    let viewport: ScreenViewport;
    function expectBackgroundMap(expected: boolean) {
      expect(viewport.viewFlags.backgroundMap).to.equal(expected);
    }

    function expectTerrain(expected: boolean) {
      expect(viewport.backgroundMap).not.to.be.undefined; // this is *never* undefined despite type annotation...
      expect(viewport.backgroundMap!.settings.applyTerrain).to.equal(expected);
    }

    beforeEach(() => {
      viewport = openBlankViewport();
      expectBackgroundMap(false);
      expectTerrain(false);

      viewport.viewFlags = viewport.viewFlags.with("backgroundMap", true);
      expectBackgroundMap(true);
      expectTerrain(false);
    });

    afterEach(() => {
      viewport.view.displayStyle = new DisplayStyle3dState({} as any, viewport.iModel);
      expectBackgroundMap(false);
      expectTerrain(false);
      viewport.dispose();
    });

    it("updates when display style is assigned to", () => {
      let style = viewport.displayStyle.clone();
      style.viewFlags = style.viewFlags.with("backgroundMap", false);
      viewport.displayStyle = style;
      expectBackgroundMap(false);
      expectTerrain(false);

      style = style.clone();
      style.viewFlags = style.viewFlags.with("backgroundMap", true);
      style.settings.applyOverrides({ backgroundMap: { applyTerrain: true } });
      viewport.displayStyle = style;
      expectBackgroundMap(true);
      expectTerrain(true);

      style = style.clone();
      style.settings.applyOverrides({ backgroundMap: { applyTerrain: false } });
      viewport.displayStyle = style;
      expectBackgroundMap(true);
      expectTerrain(false);
    });

    it("updates when settings are modified", () => {
      const style = viewport.displayStyle;
      style.viewFlags = style.viewFlags.with("backgroundMap", false);
      expectBackgroundMap(false);
      expectTerrain(false);

      style.viewFlags = style.viewFlags.with("backgroundMap", true);
      style.settings.applyOverrides({ backgroundMap: { applyTerrain: true } });
      expectBackgroundMap(true);
      expectTerrain(true);

      style.settings.applyOverrides({ backgroundMap: { applyTerrain: false } });
      expectBackgroundMap(true);
      expectTerrain(false);
    });
  });

  describe("read images", () => {
    interface TestCase {
      width: number;
      height?: number;
      image: ColorDef[];
      bgColor?: ColorDef;
    }

    class Decorator {
      public constructor(public readonly image: ColorDef[], public readonly width: number, public readonly height: number) {
        IModelApp.viewManager.addDecorator(this);
      }

      public decorate(context: DecorateContext): void {
        const builder = context.createGraphicBuilder(GraphicType.ViewOverlay);
        for (let x = 0; x < this.width; x++) {
          for (let y = 0; y < this.height; y++) {
            const color = this.image[x + y * this.width];
            builder.setSymbology(color, color, 1);
            builder.addPointString2d([new Point2d(x + 0.5, y + 0.5)], 0);
          }
        }

        context.addDecorationFromBuilder(builder);
      }
    }

    function test(testCase: TestCase, func: (viewport: ScreenViewport) => void): void {
      const decHeight = testCase.image.length / testCase.width;
      const rectHeight = testCase.height ?? decHeight;
      expect(rectHeight).to.equal(Math.floor(rectHeight));
      expect(decHeight).to.equal(Math.floor(decHeight));

      testBlankViewport({
        width: testCase.width,
        height: rectHeight,
        position: "absolute",
        test: (viewport) => {
          expect(viewport.viewRect.width).to.equal(testCase.width);
          expect(viewport.viewRect.height).to.equal(rectHeight);

          if (testCase.bgColor)
            viewport.displayStyle.backgroundColor = testCase.bgColor;

          const decorator = new Decorator(testCase.image, testCase.width, decHeight);
          try {
            viewport.renderFrame();
            func(viewport);
          } finally {
            IModelApp.viewManager.dropDecorator(decorator);
          }
        },
      });
    }

    function expectColors(image: ImageBuffer, expectedColors: ColorDef[]): void {
      expect(image.width * image.height).to.equal(expectedColors.length);
      expect(image.format).to.equal(ImageBufferFormat.Rgba);

      const expected = expectedColors.map((x) => x.tbgr.toString(16));
      const actual: string[] = [];
      for (let i = 0; i < expected.length; i++) {
        const offset = i * 4;
        actual.push(ColorDef.from(image.data[offset], image.data[offset + 1], image.data[offset + 2], 0xff - image.data[offset + 3]).tbgr.toString(16));
      }

      expect(actual).to.deep.equal(expected);
    }

    const rgbw2: TestCase = {
      width: 2,
      image: [
        ColorDef.red, ColorDef.green,
        ColorDef.blue, ColorDef.white,
      ],
    };

    const purple = ColorDef.from(255, 0, 255);
    const cyan = ColorDef.from(0, 255, 255);
    const yellow = ColorDef.from(255, 255, 0);
    const grey = ColorDef.from(127, 127, 127);
    const transpBlack = ColorDef.black.withTransparency(0xff);
    const halfRed = ColorDef.from(0x80, 0, 0);

    const rgbwp1: TestCase = {
      width: 1,
      image: [ColorDef.red, ColorDef.green, ColorDef.blue, ColorDef.white, purple],
    };

    const rTransp50pct: TestCase = {
      width: 1,
      height: 2,
      image: [ColorDef.red.withTransparency(0x7f)],
      bgColor: transpBlack,
    };

    const rTransp100pct: TestCase = {
      ...rTransp50pct,
      image: [ColorDef.red.withTransparency(0xff)],
    };

    const square3: TestCase = {
      width: 3,
      image: [
        ColorDef.red, ColorDef.green, ColorDef.blue,
        ColorDef.white, ColorDef.black, grey,
        cyan, purple, yellow,
      ],
    };

    describe("readImage", () => {
      it("reads image upside down by default (BUG)", () => {
        test(rgbw2, (viewport) => {
          // eslint-disable-next-line deprecation/deprecation
          const image = viewport.readImage()!;
          expect(image).not.to.be.undefined;
          expectColors(image, [ColorDef.blue, ColorDef.white, ColorDef.red, ColorDef.green]);
        });
      });

      it("flips image vertically if specified", () => {
        test(rgbw2, (viewport) => {
          // eslint-disable-next-line deprecation/deprecation
          const image = viewport.readImage(undefined, undefined, true)!;
          expect(image).not.to.be.undefined;
          expectColors(image, rgbw2.image);
        });
      });

      it("inverts view rect y (BUG)", () => {
        test(rgbwp1, (viewport) => {
          // eslint-disable-next-line deprecation/deprecation
          const image = viewport.readImage(new ViewRect(0, 1, 1, 3), undefined, true)!;
          expect(image).not.to.be.undefined;
          expectColors(image, [ColorDef.blue, ColorDef.white]);
        });
      });
    });

    describe("readImageBuffer", () => {
      it("reads image right-side up by default", () => {
        test(rgbw2, (viewport) => {
          const image = viewport.readImageBuffer()!;
          expect(image).not.to.be.undefined;
          expectColors(image, rgbw2.image);
        });
      });

      it("produces upside-down image if specified", () => {
        test(rgbw2, (viewport) => {
          const image = viewport.readImageBuffer({ upsideDown: true })!;
          expect(image).not.to.be.undefined;
          expectColors(image, [ColorDef.blue, ColorDef.white, ColorDef.red, ColorDef.green]);
        });
      });

      it("does not invert view rect", () => {
        test(rgbwp1, (viewport) => {
          const image = viewport.readImageBuffer({ rect: new ViewRect(0, 1, 1, 3) })!;
          expect(image).not.to.be.undefined;
          expectColors(image, [ColorDef.green, ColorDef.blue]);
        });
      });

      it("captures specified region", () => {
        test(square3, (viewport) => {
          const capture = (left: number, top: number, width: number, height: number, expected: ColorDef[]) => {
            const rect = new ViewRect(left, top, left + width, top + height);
            const image = viewport.readImageBuffer({ rect })!;
            expect(image).not.to.be.undefined;
            expectColors(image, expected);
          };

          capture(0, 0, 3, 3, square3.image);
          capture(0, 0, 2, 2, [ColorDef.red, ColorDef.green, ColorDef.white, ColorDef.black]);
          capture(1, 1, 2, 2, [ColorDef.black, grey, purple, yellow]);
          capture(2, 0, 1, 3, [ColorDef.blue, grey, yellow]);
          capture(0, 2, 3, 1, [cyan, purple, yellow]);
          capture(1, 2, 1, 1, [purple]);
        });
      });

      it("rejects invalid capture rects", () => {
        test(rgbw2, (viewport) => {
          const expectNoImage = (left: number, top: number, right: number, bottom: number) => {
            expect(viewport.readImageBuffer({ rect: new ViewRect(left, top, right, bottom) })).to.be.undefined;
          };

          expectNoImage(0, 0, -1, -1);
          expectNoImage(0, 0, 100, 1);
          expectNoImage(0, 0, 1, 100);
          expectNoImage(100, 100, 1, 1);
          expectNoImage(1, 1, 1, 1);
        });
      });

      it("resizes", () => {
        test({ ...rgbw2, bgColor: grey }, (viewport) => {
          const resize = (w: number, h: number, expectedBarPixels?: { top?: number, bottom?: number, left?: number, right?: number }, expectedColors?: ColorDef[]) => {
            const image = viewport.readImageBuffer({ size: { x: w, y: h } })!;
            expect(image).not.to.be.undefined;
            expect(image.width).to.equal(w);
            expect(image.height).to.equal(h);

            if (expectedColors)
              expectColors(image, expectedColors);

            const top = expectedBarPixels?.top ?? 0;
            const left = expectedBarPixels?.left ?? 0;
            const right = w - (expectedBarPixels?.right ?? 0);
            const bottom = h - (expectedBarPixels?.bottom ?? 0);

            for (let x = 0; x < w; x++) {
              for (let y = 0; y < h; y++) {
                const i = 4 * (x + y * w);
                const color = ColorDef.from(image.data[i], image.data[i + 1], image.data[i + 2], 0xff - image.data[i + 3]);
                expect(color.equals(grey)).to.equal(x < left || y < top || x >= right || y >= bottom);
              }
            }
          };

          resize(4, 4);
          resize(1, 1);
          resize(4, 2, { left: 1, right: 1 }, [
            grey, ColorDef.red, ColorDef.green, grey,
            grey, ColorDef.blue, ColorDef.white, grey,
          ]);
          resize(2, 4, { top: 1, bottom: 1 }, [
            grey, grey,
            ColorDef.red, ColorDef.green,
            ColorDef.blue, ColorDef.white,
            grey, grey,
          ]);
          resize(8, 4, { left: 2, right: 2 });
          resize(4, 8, { top: 2, bottom: 2 });
          resize(3, 2, { left: 1 });
          resize(2, 5, { top: 1, bottom: 2 }, [
            grey, grey,
            ColorDef.red, ColorDef.green,
            ColorDef.blue, ColorDef.white,
            grey, grey,
            grey, grey,
          ]);
        });
      });

      it("rejects invalid sizes", () => {
        test(rgbw2, (viewport) => {
          const expectNoImage = (width: number, height: number) => {
            expect(viewport.readImageBuffer({ size: { x: width, y: height } })).to.be.undefined;
          };

          expectNoImage(0, 1);
          expectNoImage(1, 0);
          expectNoImage(-1, 1);
          expectNoImage(1, -1);
        });
      });

      it("discards alpha by default", () => {
        test({ ...rTransp50pct, bgColor: undefined }, (viewport) => {
          const image = viewport.readImageBuffer()!;
          expect(image).not.to.be.undefined;
          expectColors(image, [halfRed, ColorDef.black]);
        });

        test({ ...rTransp100pct, bgColor: undefined }, (viewport) => {
          const image = viewport.readImageBuffer()!;
          expect(image).not.to.be.undefined;
          expectColors(image, [ColorDef.black, ColorDef.black]);
        });
      });

      it("preserves background alpha if background color is fully transparent", () => {
        test(rTransp50pct, (viewport) => {
          const image = viewport.readImageBuffer()!;
          expect(image).not.to.be.undefined;
          expectColors(image, [halfRed, transpBlack]);
        });
      });

      it("doesn't preserve background alpha when resizing (canvas limitation)", () => {
        // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/putImageData#data_loss_due_to_browser_optimization
        test(rTransp50pct, (viewport) => {
          const image = viewport.readImageBuffer({ size: { x: 2, y: 4 } })!;
          expect(image).not.to.be.undefined;
          for (let i = 3; i < 2 * 4 * 4; i += 4)
            expect(image.data[i]).to.equal(0xff);
        });
      });

      it("produces undefined if image is entirely transparent background pixels", () => {
        test(rTransp100pct, (viewport) => {
          expect(viewport.readImageBuffer()).to.be.undefined;
        });
      });
    });
  });

  describe("readPixels", () => {
    it("returns undefined if viewport is disposed", async () => {
      testBlankViewport((vp) => {
        vp.readPixels(vp.viewRect, Pixel.Selector.All, (pixels) => expect(pixels).not.to.be.undefined);

        // BlankViewport.dispose also closes the iModel and removes the viewport's div from the DOM.
        // We don't want that until the test completes.
        const dispose = vp.dispose; // eslint-disable-line @typescript-eslint/unbound-method
        vp.dispose = ScreenViewport.prototype.dispose; // eslint-disable-line @typescript-eslint/unbound-method
        vp.dispose();

        vp.readPixels(vp.viewRect, Pixel.Selector.All, (pixels) => expect(pixels).to.be.undefined);

        vp.dispose = dispose;
      });
    });
  });

  describe("readPixels", () => {
    it("returns undefined if specified area is invalid", async () => {
      testBlankViewport((vp) => {
        vp.readPixels(new ViewRect(10, 0, 50, 0), Pixel.Selector.All, (pixels) => expect(pixels).to.be.undefined);
        vp.readPixels(new ViewRect(0, 10, 0, 50), Pixel.Selector.All, (pixels) => expect(pixels).to.be.undefined);
      });
    });
  });

  describe("Map layers", () => {
    // Issue #4436
    it("ignores map layer with invalid format Id", async () => {
      await testBlankViewportAsync(async (vp) => {
        const settings = ImageMapLayerSettings.fromJSON({
          formatId: "BadFormat",
          url: "https://sampleUrl",
          name: "test",
          subLayers: [{ id: 0, name: "test", visible: true }],
        });

        vp.viewFlags = vp.viewFlags.with("backgroundMap", true);
        expect(vp.displayStyle.attachMapLayer({ settings, mapLayerIndex: { isOverlay: false, index: -1 } })).not.to.throw;
        await vp.waitForSceneCompletion();
      });
    });
  });
});

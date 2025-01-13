/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Id64String, UnexpectedErrors } from "@itwin/core-bentley";
import { Point2d, Point3d } from "@itwin/core-geometry";
import {
  AnalysisStyle, ColorDef, EmptyLocalization, Feature, ImageBuffer, ImageBufferFormat, ImageMapLayerSettings,
} from "@itwin/core-common";
import { ViewRect } from "../common/ViewRect";
import { OffScreenViewport, ScreenViewport, Viewport } from "../Viewport";
import { DisplayStyle3dState } from "../DisplayStyleState";
import { SpatialViewState } from "../SpatialViewState";
import { IModelApp } from "../IModelApp";
import { openBlankViewport, readUniqueFeatures, testBlankViewport, testBlankViewportAsync } from "./openBlankViewport";
import { createBlankConnection } from "./createBlankConnection";
import { DecorateContext } from "../ViewContext";
import { Pixel } from "../render/Pixel";
import { GraphicType } from "../common/render/GraphicType";
import { RenderGraphic } from "../render/RenderGraphic";
import { Decorator } from "../ViewManager";

describe("Viewport", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());

  describe("constructor", () => {
    it("invokes initialize method", () => {
      class ScreenVp extends ScreenViewport {
        public initialized = false;
        protected override initialize() { this.initialized = true; }

        public static createVp(view: SpatialViewState): ScreenVp {
          const parentDiv = document.createElement("div");
          parentDiv.setAttribute("height", "100px");
          parentDiv.setAttribute("width", "100px");
          parentDiv.style.height = parentDiv.style.width = "100px";
          document.body.appendChild(parentDiv);
          return this.create(parentDiv, view) as ScreenVp;
        }
      }

      class OffScreenVp extends OffScreenViewport {
        public initialized = false;
        protected override initialize() { this.initialized = true; }

        public static createVp(view: SpatialViewState): OffScreenVp {
          return this.create({ view, viewRect: new ViewRect(0, 0, 100, 100) }) as OffScreenVp;
        }
      }

      function test(ctor: (typeof ScreenVp | typeof OffScreenVp)): void {
        const iModel = createBlankConnection();
        const view = SpatialViewState.createBlank(iModel, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
        const vp = ctor.createVp(view);
        expect(vp.initialized).toBe(true);
        vp.dispose();
      }

      test(ScreenVp);
      test(OffScreenVp);
    });
  });

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

      expect(viewport.flashedId).toEqual(expectedId);
      expect(event).toEqual(expectedEvent);
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
        expect(() => (viewport.flashedId = "0x12345")).toThrowError("Cannot assign to Viewport.flashedId from within an onFlashedIdChanged event callback");
        UnexpectedErrors.setHandler(oldHandler);
      });
    });
  });

  describe("analysis style changed events", () => {
    it("registers and unregisters for multiple events", () => {
      testBlankViewport((viewport) => {
        function expectListeners(expected: boolean): void {
          const expectedNum = expected ? 1 : 0;
          expect(viewport.onChangeView.numberOfListeners).toEqual(expectedNum);

          // The viewport registers its own listener for each of these.
          expect(viewport.view.onDisplayStyleChanged.numberOfListeners).toEqual(expectedNum + 1);
          expect(viewport.displayStyle.settings.onAnalysisStyleChanged.numberOfListeners).toEqual(expectedNum + 1);
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
            expect(payload).toEqual("none");
            payload = style ?? "undefined";
          });

          func();
          removeListener();
          expect(payload).toEqual(expectedPayload);
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
          expect(view.displayStyle).not.toEqual(viewport.view.displayStyle);
          view.displayStyle.settings.analysisStyle = c;
          viewport.changeView(view);
        });

        expectChangedEvent("undefined", () => viewport.displayStyle.settings.analysisStyle = undefined);
        expectChangedEvent("none", () => (viewport.displayStyle.settings.analysisStyle = undefined));
      });
    });
  });

  describe("background map", () => {
    let viewport: ScreenViewport;
    function expectBackgroundMap(expected: boolean) {
      expect(viewport.viewFlags.backgroundMap).toEqual(expected);
    }

    function expectTerrain(expected: boolean) {
      expect(viewport.backgroundMap).toBeDefined(); // this is *never* undefined despite type annotation...
      expect(viewport.backgroundMap!.settings.applyTerrain).toEqual(expected);
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

    class PointDecorator {
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
      expect(rectHeight).toEqual(Math.floor(rectHeight));
      expect(decHeight).toEqual(Math.floor(decHeight));

      testBlankViewport({
        width: testCase.width,
        height: rectHeight,
        position: "absolute",
        test: (viewport) => {
          expect(viewport.viewRect.width).toEqual(testCase.width);
          expect(viewport.viewRect.height).toEqual(rectHeight);

          if (testCase.bgColor)
            viewport.displayStyle.backgroundColor = testCase.bgColor;

          const decorator = new PointDecorator(testCase.image, testCase.width, decHeight);
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
      expect(image.width * image.height).toEqual(expectedColors.length);
      expect(image.format).toEqual(ImageBufferFormat.Rgba);

      const expected = expectedColors.map((x) => x.tbgr.toString(16));
      const actual: string[] = [];
      for (let i = 0; i < expected.length; i++) {
        const offset = i * 4;
        actual.push(ColorDef.from(image.data[offset], image.data[offset + 1], image.data[offset + 2], 0xff - image.data[offset + 3]).tbgr.toString(16));
      }

      expect(actual).toEqual(expected);
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
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          const image = viewport.readImage()!;
          expect(image).toBeDefined();
          expectColors(image, [ColorDef.blue, ColorDef.white, ColorDef.red, ColorDef.green]);
        });
      });

      it("flips image vertically if specified", () => {
        test(rgbw2, (viewport) => {
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          const image = viewport.readImage(undefined, undefined, true)!;
          expect(image).toBeDefined();
          expectColors(image, rgbw2.image);
        });
      });

      it("inverts view rect y (BUG)", () => {
        test(rgbwp1, (viewport) => {
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          const image = viewport.readImage(new ViewRect(0, 1, 1, 3), undefined, true)!;
          expect(image).toBeDefined();
          expectColors(image, [ColorDef.blue, ColorDef.white]);
        });
      });
    });

    describe("readImageBuffer", () => {
      it("reads image right-side up by default", () => {
        test(rgbw2, (viewport) => {
          const image = viewport.readImageBuffer()!;
          expect(image).toBeDefined();
          expectColors(image, rgbw2.image);
        });
      });

      it("produces upside-down image if specified", () => {
        test(rgbw2, (viewport) => {
          const image = viewport.readImageBuffer({ upsideDown: true })!;
          expect(image).toBeDefined();
          expectColors(image, [ColorDef.blue, ColorDef.white, ColorDef.red, ColorDef.green]);
        });
      });

      it("does not invert view rect", () => {
        test(rgbwp1, (viewport) => {
          const image = viewport.readImageBuffer({ rect: new ViewRect(0, 1, 1, 3) })!;
          expect(image).toBeDefined();
          expectColors(image, [ColorDef.green, ColorDef.blue]);
        });
      });

      it("captures specified region", () => {
        test(square3, (viewport) => {
          const capture = (left: number, top: number, width: number, height: number, expected: ColorDef[]) => {
            const rect = new ViewRect(left, top, left + width, top + height);
            const image = viewport.readImageBuffer({ rect })!;
            expect(image).toBeDefined();
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
            expect(viewport.readImageBuffer({ rect: new ViewRect(left, top, right, bottom) })).toBeUndefined();
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
            expect(image).toBeDefined();
            expect(image.width).toEqual(w);
            expect(image.height).toEqual(h);

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
                expect(color.equals(grey)).toEqual(x < left || y < top || x >= right || y >= bottom);
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
            expect(viewport.readImageBuffer({ size: { x: width, y: height } })).toBeUndefined();
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
          expect(image).toBeDefined();
          expectColors(image, [halfRed, ColorDef.black]);
        });

        test({ ...rTransp100pct, bgColor: undefined }, (viewport) => {
          const image = viewport.readImageBuffer()!;
          expect(image).toBeDefined();
          expectColors(image, [ColorDef.black, ColorDef.black]);
        });
      });

      it("preserves background alpha if background color is fully transparent", () => {
        test(rTransp50pct, (viewport) => {
          const image = viewport.readImageBuffer()!;
          expect(image).toBeDefined();
          expectColors(image, [halfRed, transpBlack]);
        });
      });

      it("doesn't preserve background alpha when resizing (canvas limitation)", () => {
        // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/putImageData#data_loss_due_to_browser_optimization
        test(rTransp50pct, (viewport) => {
          const image = viewport.readImageBuffer({ size: { x: 2, y: 4 } })!;
          expect(image).toBeDefined();
          for (let i = 3; i < 2 * 4 * 4; i += 4)
            expect(image.data[i]).toEqual(0xff);
        });
      });

      it("produces undefined if image is entirely transparent background pixels", () => {
        test(rTransp100pct, (viewport) => {
          expect(viewport.readImageBuffer()).toBeUndefined();
        });
      });
    });
  });

  describe("readPixels", () => {
    const activeDecorators: Decorator[] = [];
    function addDecorator(dec: Decorator) {
      IModelApp.viewManager.addDecorator(dec);
      activeDecorators.push(dec);
    }

    afterEach(() => {
      for (const dec of activeDecorators) {
        IModelApp.viewManager.dropDecorator(dec);
      }

      activeDecorators.length = 0;
    });

    it("returns undefined if viewport is disposed", () => {
      testBlankViewport((vp) => {
        vp.readPixels(vp.viewRect, Pixel.Selector.All, (pixels) => expect(pixels).toBeDefined());

        // BlankViewport.dispose also closes the iModel and removes the viewport's div from the DOM.
        // We don't want that until the test completes.
        const dispose = vp.dispose; // eslint-disable-line @typescript-eslint/unbound-method
        vp.dispose = ScreenViewport.prototype.dispose; // eslint-disable-line @typescript-eslint/unbound-method
        vp.dispose();

        vp.readPixels(vp.viewRect, Pixel.Selector.All, (pixels) => expect(pixels).toBeUndefined());

        vp.dispose = dispose;
      });
    });

    it("returns undefined if specified area is invalid", () => {
      testBlankViewport((vp) => {
        vp.readPixels(new ViewRect(10, 0, 50, 0), Pixel.Selector.All, (pixels) => expect(pixels).toBeUndefined());
        vp.readPixels(new ViewRect(0, 10, 0, 50), Pixel.Selector.All, (pixels) => expect(pixels).toBeUndefined());
      });
    });

    it("can filter out specified elements", () => {
      class SquareDecorator {
        private readonly _graphic: RenderGraphic;

        public constructor(z: number, id: string, vp: Viewport) {
          const pts = [
            new Point3d(-10, -10, z), new Point3d(10, -10, z), new Point3d(10, 10, z), new Point3d(-10, 10, z), new Point3d(-10, -10, z),
          ];
          vp.viewToWorldArray(pts);

          const builder = IModelApp.renderSystem.createGraphic({
            type: GraphicType.WorldDecoration,
            pickable: { id },
            computeChordTolerance: () => 0,
          });
          builder.addShape(pts);

          this._graphic = IModelApp.renderSystem.createGraphicOwner(builder.finish());
        }

        public decorate(context: DecorateContext): void {
          context.addDecoration(GraphicType.WorldDecoration, this._graphic);
        }
      }

      testBlankViewport((vp) => {
        addDecorator(new SquareDecorator(0, "0xa", vp));
        addDecorator(new SquareDecorator(-10, "0xb", vp));

        vp.renderFrame();

        let features = readUniqueFeatures(vp, undefined, undefined, undefined);
        expect(features.length).to.equal(1);
        expect(features.contains(new Feature("0xa"))).to.be.true;

        features = readUniqueFeatures(vp, undefined, undefined, ["0xa"]);
        expect(features.length).to.equal(1);
        expect(features.contains(new Feature("0xb"))).to.be.true;

        features = readUniqueFeatures(vp, undefined, undefined, undefined);
        expect(features.length).to.equal(1);
        expect(features.contains(new Feature("0xa"))).to.be.true;

        features = readUniqueFeatures(vp, undefined, undefined, ["0xb"]);
        expect(features.length).to.equal(1);
        expect(features.contains(new Feature("0xa"))).to.be.true;

        features = readUniqueFeatures(vp, undefined, undefined, ["0xa", "0xb"]);
        expect(features.length).to.equal(0);
      });
    });

    it("can filter out specified elements within a single batch", () => {
      testBlankViewport((vp) => {
        const frontPts = [
          new Point3d(-10, -10, 0), new Point3d(10, -10, 0), new Point3d(10, 10, 0), new Point3d(-10, 10, 0), new Point3d(-10, -10, 0),
        ];
        const backPts = frontPts.map((pt) => new Point3d(pt.x, pt.y, -10));

        vp.viewToWorldArray(frontPts);
        vp.viewToWorldArray(backPts);

        const builder = IModelApp.renderSystem.createGraphic({
          type: GraphicType.WorldDecoration,
          pickable: { id: "0xc" },
          computeChordTolerance: () => 0,
        });

        builder.addShape(frontPts);
        builder.activateFeature(new Feature("0xd"));
        builder.addShape(backPts);

        const graphic = IModelApp.renderSystem.createGraphicOwner(builder.finish());
        addDecorator({
          decorate: (context) => context.addDecoration(GraphicType.WorldDecoration, graphic),
        });

        vp.renderFrame();

        let features = readUniqueFeatures(vp, undefined, undefined, undefined);
        expect(features.length).to.equal(1);
        expect(features.contains(new Feature("0xc"))).to.be.true;

        features = readUniqueFeatures(vp, undefined, undefined, undefined);
        expect(features.length).to.equal(1);
        expect(features.contains(new Feature("0xc"))).to.be.true;

        features = readUniqueFeatures(vp, undefined, undefined, ["0xd"]);
        expect(features.length).to.equal(1);
        expect(features.contains(new Feature("0xc"))).to.be.true;

        features = readUniqueFeatures(vp, undefined, undefined, ["0xc", "0xd"]);
        expect(features.length).to.equal(0);

        features = readUniqueFeatures(vp, undefined, undefined, ["0xc"]);
        expect(features.length).to.equal(1);
        expect(features.contains(new Feature("0xd"))).to.be.true;
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

        // Set the base map to solid color so no Bing maps requests are made, and potentially hang the test.
        vp.displayStyle.backgroundMapBase = ColorDef.black;
        vp.viewFlags = vp.viewFlags.with("backgroundMap", true);

        expect(() => vp.displayStyle.attachMapLayer({ settings, mapLayerIndex: { isOverlay: false, index: -1 } })).not.toThrow();
        await vp.waitForSceneCompletion();
      });
    });
  });

  describe("Pixel selection", () => {
    it("isPixelSelectable should return false when no map-layers ids", () => {
      testBlankViewport((vp) => {
        const stub = vi.spyOn(Viewport.prototype, "mapLayerFromIds").mockImplementation(function (_mapTreeId: Id64String, _layerTreeId: Id64String) {
          return [];
        });
        const fakePixelData = {modelId: "123", elementId: "456"};
        expect(vp.isPixelSelectable(fakePixelData as any)).toBe(true);
        stub.mockRestore();
      });
    });
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { UnexpectedErrors } from "@itwin/core-bentley";
import { Point2d } from "@itwin/core-geometry";
import { AnalysisStyle, ColorDef, ImageBuffer, ImageBufferFormat } from "@itwin/core-common";
import { ViewRect } from "../ViewRect";
import { ScreenViewport } from "../Viewport";
import { DisplayStyle3dState } from "../DisplayStyleState";
import { IModelApp } from "../IModelApp";
import { openBlankViewport, testBlankViewport } from "./openBlankViewport";
import { DecorateContext } from "../ViewContext";
import { GraphicType } from "../render/GraphicBuilder";

describe("Viewport", () => {
  before(async () => IModelApp.startup());
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

  describe.only("read images", () => {
    interface TestCase {
      width: number;
      image: ColorDef[];
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
      const height = testCase.image.length / testCase.width;
      expect(height).to.equal(Math.floor(height));

      testBlankViewport({
        width: testCase.width,
        height,
        position: "absolute",
        test: (viewport) => {
          expect(viewport.viewRect.width).to.equal(testCase.width);
          expect(viewport.viewRect.height).to.equal(height);

          const decorator = new Decorator(testCase.image, testCase.width, height);
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

    const rgbwp1: TestCase = {
      width: 1,
      image: [ ColorDef.red, ColorDef.green, ColorDef.blue, ColorDef.white, purple ],
    };

    describe("readImage", () => {
      it("reads image upside down (BUG)", () => {
        test(rgbw2, (viewport) => {
          const image = viewport.readImage()!;
          expect(image).not.to.be.undefined;
          expectColors(image, [ ColorDef.blue, ColorDef.white, ColorDef.red, ColorDef.green ]);
        });
      });

      it("flips image vertically", () => {
        test(rgbw2, (viewport) => {
          const image = viewport.readImage(undefined, undefined, true)!;
          expect(image).not.to.be.undefined;
          expectColors(image, rgbw2.image);
        });
      });

      it("inverts view rect y (BUG)", () => {
        test(rgbwp1, (viewport) => {
          const image = viewport.readImage(new ViewRect(0, 1, 1, 3), undefined, true)!;
          expect(image).not.to.be.undefined;
          expectColors(image, [ ColorDef.blue, ColorDef.white ]);
        });
      });

      it("discards background alpha when resizing (BUG)", () => {
      });
    });

    describe("readImageBuffer", () => {
      it("reads image right-side up", () => {
        test(rgbw2, (viewport) => {
          const image = viewport.readImageBuffer()!;
          expect(image).not.to.be.undefined;
          expectColors(image, rgbw2.image);
        });
      });

      it("flips image vertically", () => {
        test(rgbw2, (viewport) => {
          const image = viewport.readImageBuffer({ flipVertically: true })!;
          expect(image).not.to.be.undefined;
          expectColors(image, [ ColorDef.blue, ColorDef.white, ColorDef.red, ColorDef.green ]);
        });
      });

      it("does not invert view rect", () => {
        test(rgbwp1, (viewport) => {
          const image = viewport.readImageBuffer({ rect: new ViewRect(0, 1, 1, 3) })!;
          expect(image).not.to.be.undefined;
          expectColors(image, [ ColorDef.green, ColorDef.blue ]);
        });
      });

      it("preserves background alpha when resizing", () => {
      });
    });
  });
});

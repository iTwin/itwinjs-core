/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { AnalysisStyle } from "@bentley/imodeljs-common";
import { ScreenViewport } from "../Viewport";
import { IModelApp } from "../IModelApp";
import { openBlankViewport } from "./openBlankViewport";

describe("Viewport", () => {
  let viewport: ScreenViewport;

  before(async () => IModelApp.startup());
  after(async () => IModelApp.shutdown());
  beforeEach(() => viewport = openBlankViewport());
  afterEach(() => viewport.dispose());

  describe("flashedId", () => {
    type ChangedEvent = [string | undefined, string | undefined];

    function expectFlashedId(expectedId: string | undefined, expectedEvent: ChangedEvent | undefined, func: () => void): void {
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
      expectFlashedId("0x123", [undefined, "0x123"], () => viewport.flashedId = "0x123");
      expectFlashedId("0x456", ["0x123", "0x456"], () => viewport.flashedId = "0x456");
      expectFlashedId("0x456", undefined, () => viewport.flashedId = "0x456");
      expectFlashedId(undefined, ["0x456", undefined], () => viewport.flashedId = undefined);
      expectFlashedId(undefined, undefined, () => viewport.flashedId = undefined);
    });

    it("treats invalid Id as undefined", () => {
      viewport.flashedId = "0x123";
      expectFlashedId(undefined, ["0x123", undefined], () => viewport.flashedId = "0");
      viewport.flashedId = "0x123";
      expectFlashedId(undefined, ["0x123", undefined], () => viewport.flashedId = undefined);
    });

    it("rejects malformed Ids", () => {
      expectFlashedId(undefined, undefined, () => viewport.flashedId = "not an id");
      viewport.flashedId = "0x123";
      expectFlashedId("0x123", undefined, () => viewport.flashedId = "not an id");
    });

    it("prohibits assignment from within event callback", () => {
      viewport.onFlashedIdChanged.addOnce(() => viewport.flashedId = "0x12345");
      expect(() => viewport.flashedId = "0x12345").to.throw(Error, "Cannot assign to Viewport.flashedId from within an onFlashedIdChanged event callback");
    });
  });

  describe("analysis style changed events", () => {
    it("registers and unregisters for multiple events", () => {
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

    it("emits events when analysis style changes", () => {
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

<<<<<<< HEAD
      const c = AnalysisStyle.fromJSON({ normalChannelName: "c" });
      expectChangedEvent(c, () => {
        const view = viewport.view.clone();
        expect(view.displayStyle).not.to.equal(viewport.view.displayStyle);
        view.displayStyle.settings.analysisStyle = c;
        viewport.changeView(view);
=======
    describe("readImage", () => {
      it("reads image upside down by default (BUG)", () => {
        test(rgbw2, (viewport) => {
          // eslint-disable-next-line deprecation/deprecation
          const image = viewport.readImage()!;
          expect(image).not.to.be.undefined;
          expectColors(image, [ ColorDef.blue, ColorDef.white, ColorDef.red, ColorDef.green ]);
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
          expectColors(image, [ ColorDef.blue, ColorDef.white ]);
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

      it("captures specified region", () => {
        test(square3, (viewport) => {
          const capture = (left: number, top: number, width: number, height: number, expected: ColorDef[]) => {
            const rect = new ViewRect(left, top, left + width, top + height);
            const image = viewport.readImageBuffer({ rect })!;
            expect(image).not.to.be.undefined;
            expectColors(image, expected);
          };

          capture(0, 0, 3, 3, square3.image);
          capture(0, 0, 2, 2, [ ColorDef.red, ColorDef.green, ColorDef.white, ColorDef.black ]);
          capture(1, 1, 2, 2, [ ColorDef.black, grey, purple, yellow ]);
          capture(2, 0, 1, 3, [ ColorDef.blue, grey, yellow ]);
          capture(0, 2, 3, 1, [ cyan, purple, yellow ]);
          capture(1, 2, 1, 1, [ purple ]);
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
          expectColors(image, [ halfRed, ColorDef.black ]);
        });

        test({ ...rTransp100pct, bgColor: undefined }, (viewport) => {
          const image = viewport.readImageBuffer()!;
          expect(image).not.to.be.undefined;
          expectColors(image, [ ColorDef.black, ColorDef.black ]);
        });
      });

      it("preserves background alpha if background color is fully transparent", () => {
        test(rTransp50pct, (viewport) => {
          const image = viewport.readImageBuffer()!;
          expect(image).not.to.be.undefined;
          expectColors(image, [ halfRed, transpBlack ]);
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
>>>>>>> b1f03298e1 (Convert negative ViewRect coordinates to zero. (#3653))
      });

      expectChangedEvent("undefined", () => viewport.displayStyle.settings.analysisStyle = undefined);
      expectChangedEvent("none", () => viewport.displayStyle.settings.analysisStyle = undefined);
    });
  });
});

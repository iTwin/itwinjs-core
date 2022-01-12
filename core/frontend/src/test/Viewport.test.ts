/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { UnexpectedErrors } from "@itwin/core-bentley";
import { AnalysisStyle } from "@itwin/core-common";
import { ScreenViewport } from "../Viewport";
import { DisplayStyle3dState } from "../DisplayStyleState";
import { IModelApp } from "../IModelApp";
import { openBlankViewport, testBlankViewport } from "./openBlankViewport";

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

  describe("readImage", () => {

  });
});

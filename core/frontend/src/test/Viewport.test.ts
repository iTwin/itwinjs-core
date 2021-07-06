/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
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
});

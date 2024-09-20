/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testBlankViewport } from "./openBlankViewport";
import { FeatureSymbology, IModelApp, Viewport, ViewState } from "../core-frontend";
import { EmptyLocalization } from "@itwin/core-common";

describe("FeatureSymbology.Overrides", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());

  it("combines viewport's never-drawn elements with display style's excluded elements", () => {
    function expectNeverDrawn(view: Viewport | ViewState, ids: string[]): void {
      const ovrs = new FeatureSymbology.Overrides(view);
      expect(ovrs.neverDrawn.size).toEqual(ids.length);
      for (const id of ids) {
        expect(ovrs.neverDrawn.hasId(id)).toBe(true);
      }
    }

    testBlankViewport((vp) => {
      expectNeverDrawn(vp.view, []);
      expectNeverDrawn(vp, []);

      vp.view.displayStyle.settings.addExcludedElements("0x1");
      expectNeverDrawn(vp.view, ["0x1"]);
      expectNeverDrawn(vp, ["0x1"]);

      vp.setNeverDrawn(new Set(["0x2"]));
      expectNeverDrawn(vp.view, ["0x1"]);
      expectNeverDrawn(vp, ["0x1", "0x2"]);

      vp.view.displayStyle.settings.dropExcludedElement("0x1");
      expectNeverDrawn(vp.view, []);
      expectNeverDrawn(vp, ["0x2"]);

      vp.clearNeverDrawn();
      expectNeverDrawn(vp.view, []);
      expectNeverDrawn(vp, []);
    });
  });
});

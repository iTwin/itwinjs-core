/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ColorDef, EmptyLocalization, RenderMode } from "@itwin/core-common";
import { GraphicType, IModelApp, ScreenViewport } from "../../../core-frontend";
import { expectColors } from "../../ExpectColors";
import { testBlankViewport } from "../../openBlankViewport";
import { BoxDecorator, TestDecorator } from "../../TestDecorators";

describe("Decorations containing Features", () => {
  before(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterEach(() => TestDecorator.dropAll());
  after(async () => IModelApp.shutdown());

  function test(graphicType: GraphicType, subCategoryId: "0x456" | "0" | undefined, expectIgnoreSubCategory: boolean): void {
    testBlankViewport((vp: ScreenViewport) => {
      vp.viewFlags = vp.viewFlags.copy({
        acsTriad: false,
        grid: false,
        lighting: false,
        renderMode: RenderMode.SmoothShade,
      });

      const pickable = undefined !== subCategoryId ? { id: "0x123", subCategoryId } : undefined;
      const decorator = new BoxDecorator({
        viewport: vp,
        color: ColorDef.red,
        pickable,
        graphicType,
      });

      const bg = [vp.view.displayStyle.backgroundColor];
      const bgAndDec = [...bg, ColorDef.red];
      expectColors(vp, expectIgnoreSubCategory ? bgAndDec : bg);

      vp.addFeatureOverrideProvider({
        addFeatureOverrides: (ovrs) => {
          ovrs.setVisibleSubCategory("0x456");
        },
      });

      expectColors(vp, bgAndDec);

      decorator.drop();
    });
  }

  describe("as scene graphics", () => {
    it("only display if subcategory is invalid, missing, or enabled for the view", () => {
      test(GraphicType.Scene, "0", true);
      test(GraphicType.Scene, undefined, true);
      test(GraphicType.Scene, "0x456", false);
    });
  });

  describe("as world decorations", () => {
    it("always display regardless of subcategory", () => {
      test(GraphicType.WorldDecoration, "0", true);
      test(GraphicType.WorldDecoration, undefined, true);
      test(GraphicType.WorldDecoration, "0x456", true);
    });
  });

  describe("as world overlays", () => {
    it("always display regardless of subcategory", () => {
      test(GraphicType.WorldOverlay, "0", true);
      test(GraphicType.WorldOverlay, undefined, true);
      test(GraphicType.WorldOverlay, "0x456", true);
    });
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point3d, Vector3d } from "@itwin/core-geometry";
import { ColorDef, EmptyLocalization, Feature, GeometryClass, RenderMode } from "@itwin/core-common";
import { IModelConnection } from "../../../IModelConnection";
import { ScreenViewport } from "../../../Viewport";
import { DecorateContext } from "../../../ViewContext";
import { IModelApp } from "../../../IModelApp";
import { SpatialViewState } from "../../../SpatialViewState";
import { createBlankConnection } from "../../createBlankConnection";
import { BoxDecorator, TestDecorator } from "../../TestDecorators";
import { expectColors } from "../../ExpectColors";
import { GraphicType } from "../../../core-frontend";

describe("Pickable graphic", () => {
  let imodel: IModelConnection;
  let viewport: ScreenViewport;

  const div = document.createElement("div");
  div.style.width = div.style.height = "20px";
  document.body.appendChild(div);

  before(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    imodel = createBlankConnection();
  });

  beforeEach(() => {
    const view = SpatialViewState.createBlank(imodel, new Point3d(), new Vector3d(1, 1, 1));
    view.viewFlags = view.viewFlags.copy({
      acsTriad: false,
      grid: false,
      lighting: false,
      renderMode: RenderMode.SmoothShade,
    });

    viewport = ScreenViewport.create(div, view);
  });

  afterEach(() => {
    viewport.dispose();
    TestDecorator.dropAll();
  });

  after(async () => {
    await imodel.close();
    await IModelApp.shutdown();
    document.body.removeChild(div);
  });

  function expectIds(expected: string[]): void {
    viewport.renderFrame();

    const actual = new Set<string>();
    viewport.queryVisibleFeatures({ source: "screen" }, (features) => {
      for (const feature of features)
        actual.add(feature.elementId);
    });

    expect(actual.size).to.equal(expected.length);
    for (const id of expected)
      expect(actual.has(id)).to.be.true;
  }

  it("is pickable", () => {
    const dec = new BoxDecorator({ viewport, color: ColorDef.red, pickable: { id: "0x123", locateOnly: false } });
    expectColors(viewport, [dec.color, viewport.view.displayStyle.backgroundColor]);
    expect(dec.pickable).to.not.be.undefined;
    expectIds([dec.pickable!.id]);
  }).timeout(20000); // macOS is slow.

  it("optionally draws only for pick", () => {
    const dec = new BoxDecorator({ viewport, color: ColorDef.blue, pickable: { id: "0x456", locateOnly: true } });
    expectColors(viewport, [viewport.view.displayStyle.backgroundColor]);
    expect(dec.pickable).to.not.be.undefined;
    expectIds([dec.pickable!.id]);
  }).timeout(20000); // macOS is slow.

  it("can contain multiple features", () => {
    expect(viewport.viewFlags.constructions).to.be.false;
    const bgColor = viewport.view.displayStyle.backgroundColor;

    const leftId = "0x1";
    const rightId = "0x2";
    const leftColor = ColorDef.red;
    const rightColor = ColorDef.blue;

    class MultiFeatureDecorator extends TestDecorator {
      public decorate(context: DecorateContext): void {
        const builder = context.createGraphic({
          type: GraphicType.Scene,
          pickable: { id: leftId },
        });

        builder.setSymbology(leftColor, leftColor, 1);
        builder.addShape([new Point3d(0, 0, 0), new Point3d(0, 0.5, 0), new Point3d(0.5, 0.5, 0), new Point3d(0, 0, 0)]);

        builder.setSymbology(rightColor, rightColor, 1);
        builder.activateFeature(new Feature(rightId, undefined, GeometryClass.Construction));
        builder.addShape([new Point3d(0, 0, 0), new Point3d(0.5, 0, 0), new Point3d(0.5, 0.5, 0), new Point3d(0, 0, 0)]);

        context.addDecorationFromBuilder(builder);
      }
    }

    IModelApp.viewManager.addDecorator(new MultiFeatureDecorator());

    expectColors(viewport, [leftColor, bgColor]);
    expectIds([leftId]);

    viewport.viewFlags = viewport.viewFlags.with("constructions", true);
    expectColors(viewport, [leftColor, rightColor, bgColor]);
    expectIds([leftId, rightId]);

    viewport.setNeverDrawn(new Set<string>([leftId]));
    expectColors(viewport, [rightColor, bgColor]);
    expectIds([rightId]);
  }).timeout(20000); // macOS is slow.
});

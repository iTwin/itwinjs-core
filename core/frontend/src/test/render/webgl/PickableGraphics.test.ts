/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point3d, Vector3d } from "@itwin/core-geometry";
import { ColorDef, RenderMode } from "@itwin/core-common";
import { IModelConnection } from "../../../IModelConnection";
import { ScreenViewport } from "../../../Viewport";
import { IModelApp } from "../../../IModelApp";
import { SpatialViewState } from "../../../SpatialViewState";
import { createBlankConnection } from "../../createBlankConnection";
import { BoxDecorator } from "../../TestDecorators";
import { expectColors } from "../../ExpectColors";

describe("Pickable graphic", () => {
  let imodel: IModelConnection;
  let viewport: ScreenViewport;

  const div = document.createElement("div");
  div.style.width = div.style.height = "20px";
  document.body.appendChild(div);

  before(async () => {
    await IModelApp.startup();
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
    for (const decorator of IModelApp.viewManager.decorators.filter((x) => x instanceof BoxDecorator))
      IModelApp.viewManager.dropDecorator(decorator);
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
    const dec = new BoxDecorator(viewport, ColorDef.red, { id: "0x123", locateOnly: false });
    expectColors(viewport, [dec.color, viewport.view.displayStyle.backgroundColor]);
    expect(dec.pickable).to.not.be.undefined;
    expectIds([dec.pickable!.id]);
  }).timeout(20000); // macOS is slow.

  it("optionally draws only for pick", () => {
    const dec = new BoxDecorator(viewport, ColorDef.blue, { id: "0x456", locateOnly: true });
    expectColors(viewport, [viewport.view.displayStyle.backgroundColor]);
    expect(dec.pickable).to.not.be.undefined;
    expectIds([dec.pickable!.id]);
  }).timeout(20000); // macOS is slow.
});

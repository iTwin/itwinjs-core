/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from "vitest";
import { Point3d, Transform, Vector3d } from "@itwin/core-geometry";
import { ColorDef, EmptyLocalization, RenderMode } from "@itwin/core-common";
import { IModelConnection } from "../../../IModelConnection";
import { ScreenViewport } from "../../../Viewport";
import { IModelApp } from "../../../IModelApp";
import { SpatialViewState } from "../../../SpatialViewState";
import { createBlankConnection } from "../../createBlankConnection";
import { BoxDecorator, SphereDecorator, TestDecorator } from "../../TestDecorators";
import { expectColors } from "../../ExpectColors";
import { ViewRect } from "../../../common/ViewRect";
import { ViewState } from "../../../ViewState";
import { StandardViewId } from "../../../StandardView";

describe("Decorations", () => {
  let imodel: IModelConnection;
  let viewport: ScreenViewport;
  let width = 0;
  let height = 0;
  let boxDecLocRect: ViewRect;
  let sphereDecBgLocRect: ViewRect;

  const shapePoints = [
    new Point3d(0, 0, 0),
    new Point3d(0.5, 0, 0),
    new Point3d(0.5, 0.5, 0),
    new Point3d(0, 0.5, 0),
    new Point3d(0, 0, 0),
  ];

  const div = document.createElement("div");
  div.style.width = div.style.height = "20px";
  document.body.appendChild(div);

  beforeAll(async () => {
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
    width = viewport.viewRect.width;
    height = viewport.viewRect.height;
    boxDecLocRect = new ViewRect(0, height / 2, width / 2, height);
    sphereDecBgLocRect = new ViewRect(width - 2, height / 2 + 128, width - 2 + 1, height / 2 + 128 + 1);
  });

  afterEach(() => {
    viewport.dispose();
    TestDecorator.dropAll();
  });

  afterAll(async () => {
    await imodel.close();
    await IModelApp.shutdown();
    document.body.removeChild(div);
  });

  it("draws box decoration in expected location", () => {
    const dec = new BoxDecorator({ viewport, color: ColorDef.red, points: shapePoints });
    expectColors(viewport, [dec.color, viewport.view.displayStyle.backgroundColor]); // are both the decorator and background rendering?
    expectColors(viewport, [dec.color, viewport.view.displayStyle.backgroundColor], boxDecLocRect); // is decorator rendering at expected location?
    dec.drop();
  });

  it("draws box decoration in graphic-builder-transformed location", () => {
    const dec = new BoxDecorator({ viewport, color: ColorDef.red, placement: Transform.createTranslationXYZ(0.25, 0.25), points: shapePoints });
    expectColors(viewport, [dec.color, viewport.view.displayStyle.backgroundColor]); // are both the decorator and background rendering?
    expectColors(viewport, [viewport.view.displayStyle.backgroundColor], new ViewRect(0, 0, 10, 10)); // background should render where the decorator would have been without transform.
    dec.drop();
  });

  it("draws sphere decoration in expected location", () => {
    const dec = new SphereDecorator(viewport, ColorDef.red, undefined, undefined, new Point3d(), 1.0);
    expectColors(viewport, [dec.color, viewport.view.displayStyle.backgroundColor]); // are both the decorator and background rendering?
    expectColors(viewport, [viewport.view.displayStyle.backgroundColor], sphereDecBgLocRect); // when sphere is untransformed, this location should be the background
    dec.drop();
  });

  it("draws sphere decoration in graphic-builder-transformed location", () => {
    const dec = new SphereDecorator(viewport, ColorDef.red, undefined, Transform.createTranslationXYZ(0.25, 0), new Point3d(), 1.0);
    expectColors(viewport, [dec.color, viewport.view.displayStyle.backgroundColor]); // are both the decorator and background rendering?
    expectColors(viewport, [dec.color], sphereDecBgLocRect); // when sphere is transformed, this location should contain the sphere
    dec.drop();
  });

  it("rotates about view-independent origin", () => {
    const viewIndependentOrigin = new Point3d(0.5, 0.5, 0);
    const dec = new BoxDecorator({ viewport, color: ColorDef.red, points: shapePoints, viewIndependentOrigin });
    expectColors(viewport, [dec.color, viewport.view.displayStyle.backgroundColor]);
    expectColors(viewport, [dec.color, viewport.view.displayStyle.backgroundColor], boxDecLocRect);

    viewport.view.setRotationAboutPoint(ViewState.getStandardViewMatrix(StandardViewId.Bottom), viewIndependentOrigin);
    viewport.synchWithView();
    expectColors(viewport, [dec.color, viewport.view.displayStyle.backgroundColor]);
    expectColors(viewport, [dec.color, viewport.view.displayStyle.backgroundColor], boxDecLocRect);

    viewport.view.setRotationAboutPoint(ViewState.getStandardViewMatrix(StandardViewId.Front), viewIndependentOrigin);
    viewport.synchWithView();
    expectColors(viewport, [dec.color, viewport.view.displayStyle.backgroundColor]);
    expectColors(viewport, [dec.color, viewport.view.displayStyle.backgroundColor], boxDecLocRect);
  });
});

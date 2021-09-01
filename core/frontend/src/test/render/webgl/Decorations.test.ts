/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Point3d, Transform, Vector3d } from "@bentley/geometry-core";
import { ColorDef, RenderMode } from "@bentley/imodeljs-common";
import { IModelConnection } from "../../../IModelConnection";
import { ScreenViewport } from "../../../Viewport";
import { IModelApp } from "../../../IModelApp";
import { SpatialViewState } from "../../../SpatialViewState";
import { createBlankConnection } from "../../createBlankConnection";
import { BoxDecorator } from "../../BoxDecorator";
import { expectColors } from "../../ExpectColors";
import { ViewRect } from "../../../ViewRect";

describe("Decorations", () => {
  let imodel: IModelConnection;
  let viewport: ScreenViewport;
  let width = 0;
  let height = 0;
  let decLocRect: ViewRect;
  let decLocRect2: ViewRect;

  const w = 0.5;
  const h = 0.5;
  const shapePoints = [
    new Point3d(0, 0, 0),
    new Point3d(w, 0, 0),
    new Point3d(w, h, 0),
    new Point3d(0, h, 0),
    new Point3d(0, 0, 0),
  ];

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
    width = viewport.viewRect.width;
    height = viewport.viewRect.height;
    decLocRect = new ViewRect(0, 0, 1, 1);
    decLocRect2 = new ViewRect(width / 2 - 1, height / 2 - 1, width / 2, height / 2);
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

  it("draws decoration in expected location", () => {
    const dec = new BoxDecorator(viewport, ColorDef.red, undefined, undefined, shapePoints);
    expectColors(viewport, [dec.color, viewport.view.displayStyle.backgroundColor]); // are both the decorator and background rendering?
    expectColors(viewport, [dec.color], decLocRect); // is decorator rendering at expected location?
    expectColors(viewport, [dec.color], decLocRect2); // is decorator rendering at expected location?
  }).timeout(20000); // macOS is slow.

  it("draws decoration in graphic-builder-transformed location", () => {
    const dec = new BoxDecorator(viewport, ColorDef.red, undefined, Transform.createTranslationXYZ(0.25, 0.25), shapePoints);
    expectColors(viewport, [dec.color, viewport.view.displayStyle.backgroundColor]); // are both the decorator and background rendering?
    expectColors(viewport, [viewport.view.displayStyle.backgroundColor], decLocRect); // background should render where the decorator would have been without transform.
    expectColors(viewport, [viewport.view.displayStyle.backgroundColor], decLocRect2); // background should render where the decorator would have been without transform.
  }).timeout(20000); // macOS is slow.
});

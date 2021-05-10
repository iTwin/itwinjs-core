/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point3d, Vector3d } from "@bentley/geometry-core";
import { ColorDef, RenderMode } from "@bentley/imodeljs-common";
import { DecorateContext } from "../../../ViewContext";
import { GraphicType } from "../../../render/GraphicBuilder";
import { IModelConnection } from "../../../IModelConnection";
import { ScreenViewport } from "../../../Viewport";
import { IModelApp } from "../../../IModelApp";
import { SpatialViewState } from "../../../SpatialViewState";
import { createBlankConnection } from "../../createBlankConnection";

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
    view.viewFlags.acsTriad = view.viewFlags.grid = view.viewFlags.lighting = false;
    view.viewFlags.renderMode = RenderMode.SmoothShade;
    view.displayStyle.backgroundColor = ColorDef.black;
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

  class BoxDecorator {
    public constructor(public readonly id: string, public readonly color: ColorDef, public readonly locateOnly: boolean) {
      IModelApp.viewManager.addDecorator(this);
    }

    public decorate(context: DecorateContext): void {
      const w = 0.5;
      const h = 0.5;
      const shape = [
        new Point3d(0, 0, 0),
        new Point3d(w, 0, 0),
        new Point3d(w, h, 0),
        new Point3d(0, h, 0),
        new Point3d(0, 0, 0),
      ];
      viewport.npcToWorldArray(shape);

      const builder = context.createGraphic({
        type: GraphicType.Scene,
        pickable: {
          id: this.id,
          locateOnly: this.locateOnly,
        },
      });

      builder.setSymbology(this.color, this.color, 1);
      builder.addShape(shape);
      context.addDecorationFromBuilder(builder);
    }
  }

  function expectColors(expected: ColorDef[]): void {
    viewport.renderFrame();
    const buf = viewport.readImage(viewport.viewRect)!;
    expect(buf).not.to.be.undefined;

    const u32 = new Uint32Array(buf.data.buffer);
    const values = new Set<number>();
    for (const rgba of u32)
      values.add(rgba);

    expect(values.size).to.equal(expected.length);

    for (const rgba of values) {
      const r = ((rgba & 0x000000ff) >>> 0x00) >>> 0;
      const g = ((rgba & 0x0000ff00) >>> 0x08) >>> 0;
      const b = ((rgba & 0x00ff0000) >>> 0x10) >>> 0;
      const a = ((rgba & 0xff000000) >>> 0x18) >>> 0;
      const actualColor = ColorDef.from(r, g, b, 0xff - a);
      expect(expected.findIndex((x) => x.tbgr === actualColor.tbgr)).least(0);
    }
  }

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
    const dec = new BoxDecorator("0x123", ColorDef.red, false);
    expectColors([dec.color, viewport.view.displayStyle.backgroundColor]);
    expectIds([dec.id]);
  }).timeout(20000); // macOS is slow.

  it("optionally draws only for pick", () => {
    const dec = new BoxDecorator("0x456", ColorDef.blue, true);
    expectColors([viewport.view.displayStyle.backgroundColor]);
    expectIds([dec.id]);
  }).timeout(20000); // macOS is slow.
});

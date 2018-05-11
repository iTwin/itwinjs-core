/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Point3d, Angle, Range3d } from "@bentley/geometry-core";
import { Cartographic, FontType, FontMap, ColorByName, QPoint3dList, QParams3d } from "@bentley/imodeljs-common";
import * as path from "path";
import { DecorateContext, SpatialViewState, ViewState, StandardViewId, IModelConnection, Viewport, IModelApp, PanTool, CompassMode } from "@bentley/imodeljs-frontend";
import { CONSTANTS } from "../common/Testbed";
import { RenderTarget, RenderGraphic, MeshArgs, RenderPlan, Target } from "@bentley/imodeljs-frontend/lib/rendering";

const iModelLocation = path.join(CONSTANTS.IMODELJS_CORE_DIRNAME, "core/backend/lib/test/assets/test.bim");

class TestViewport extends Viewport {
  protected _decoration?: RenderGraphic;

  public constructor(canvas: HTMLCanvasElement, viewState: ViewState, target?: RenderTarget) {
    super(canvas, viewState, target);
    this.setupFromView();
  }

  public callDecorators(context: DecorateContext): void {
    super.callDecorators(context);
    if (undefined === this._decoration) {
      const args = new MeshArgs();
      const points = [ new Point3d(0, 0, 0), new Point3d(4, 0, 0), new Point3d(2, 4, 0) ];
      args.points = new QPoint3dList(QParams3d.fromRange(Range3d.createArray(points)));
      for (const point of points)
        args.points.add(point);

      args.vertIndices = [ 0, 1, 2 ];
      args.colors.initUniform(ColorByName.tan);

      this._decoration = IModelApp.renderSystem.createTriMesh(args, this.iModel!);
    }

    assert(undefined !== this._decoration);
    context.setViewBackground(this._decoration!);
  }
}

// const compareView = (v1: SpatialViewState, v2: SpatialViewDefinitionProps, str: string) => {
//   const compare = new DeepCompare();
//   const v2State = new SpatialViewState(v2, v1.iModel, v1.categorySelector, v1.displayStyle as DisplayStyle3dState, v1.modelSelector);
//   const val = compare.compare(v1, v2State, .01);
//   assert.isTrue(val, str);
// };

describe("Viewport", () => {
  let imodel: IModelConnection;
  let spatialView: SpatialViewState;

  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  assert(null !== canvas);
  canvas!.width = canvas!.height = 1000;
  document.body.appendChild(canvas!);

  before(async () => {   // Create a ViewState to load into a Viewport
    IModelApp.startup();
    imodel = await IModelConnection.openStandalone(iModelLocation);
    spatialView = await imodel.views.load("0x34") as SpatialViewState;
    spatialView.setStandardRotation(StandardViewId.RightIso);
  });

  after(async () => {
    if (imodel) await imodel.closeStandalone();
    IModelApp.shutdown();
  });

  it("Viewport", async () => {
    const vpView = spatialView.clone<SpatialViewState>();
    const vp = new TestViewport(canvas!, vpView);
    assert.isFalse(vp.isRedoPossible, "no redo");
    assert.isFalse(vp.isUndoPossible, "no undo");
    assert.isFalse(vp.isCameraOn(), "camera is off");

    const saveView = vpView.clone<SpatialViewState>();
    assert.notEqual(saveView.modelSelector, vpView.modelSelector, "clone should copy modelSelector");
    assert.notEqual(saveView.categorySelector, vpView.categorySelector, "clone should copy categorySelector");
    assert.notEqual(saveView.displayStyle, vpView.displayStyle, "clone should copy displayStyle");
    const frustSave = vp.getFrustum();

    // const clientRect = vp.getClientRect();
    vpView.camera.validateLens();

    // currently the range test for visible elements doesn't match native code, so we get a different result.
    // re-enable this test when models hold their ranges.
    // const testParams: any = { view: vpView, rect: { left: clientRect.left, bottom: clientRect.bottom, right: clientRect.right, top: clientRect.top } };
    // const cppView = await imodel.executeTest("turnCameraOn", testParams);
    vp.turnCameraOn();
    // compareView(vpView, cppView, "turnCameraOn 3");

    vp.synchWithView(true);
    assert.isTrue(vp.isCameraOn(), "camera should be on");
    const frust2 = vp.getFrustum();
    assert.isFalse(frust2.isSame(frustSave), "turning camera on changes frustum");
    assert.isTrue(vp.isUndoPossible, "undo should now be possible");
    vp.doUndo();
    assert.isTrue(vp.getFrustum().isSame(frustSave), "undo should reinstate saved view");
    assert.isTrue(vp.isRedoPossible, "redo is possible");
    assert.isFalse(vp.isUndoPossible, "no undo");
    vp.doRedo();
    assert.isTrue(vp.getFrustum().isSame(frust2), "redo should reinstate saved view");
    assert.isFalse(vp.isRedoPossible, "after redo, redo is not possible");
    assert.isTrue(vp.isUndoPossible, "after redo, undo is possible");

    const pan = IModelApp.tools.create("View.Pan", vp) as PanTool;
    assert.instanceOf(pan, PanTool);
    assert.equal(pan.viewport, vp);
  });

  it("AccuDraw", () => {
    const vpView = spatialView.clone<SpatialViewState>();
    const viewport = new TestViewport(canvas!, vpView);
    const accudraw = IModelApp.accuDraw;
    assert.isTrue(accudraw.isEnabled(), "Accudraw should be enabled");
    const pt = new Point3d(1, 1, 1);
    accudraw.adjustPoint(pt, viewport, false);

    accudraw.activate();
    assert.isTrue(accudraw.isActive(), "AccuDraw is active");
    accudraw.deactivate();
    assert.isFalse(accudraw.isActive(), "not active");
    accudraw.setCompassMode(CompassMode.Polar);
    assert.equal(accudraw.getCompassMode(), CompassMode.Polar, "polar mode");
  });

  it("loadFontMap", async () => {
    const fonts1 = await imodel.loadFontMap();
    assert.equal(fonts1.fonts.size, 4, "font map size should be 4");
    assert.equal(FontType.TrueType, fonts1.getFont(1)!.type, "get font 1 type is TrueType");
    assert.equal("Arial", fonts1.getFont(1)!.name, "get Font 1 name");
    assert.equal(1, fonts1.getFont("Arial")!.id, "get Font 1, by name");
    assert.equal(FontType.Rsc, fonts1.getFont(2)!.type, "get font 2 type is Rsc");
    assert.equal("Font0", fonts1.getFont(2)!.name, "get Font 2 name");
    assert.equal(2, fonts1.getFont("Font0")!.id, "get Font 2, by name");
    assert.equal(FontType.Shx, fonts1.getFont(3)!.type, "get font 1 type is Shx");
    assert.equal("ShxFont0", fonts1.getFont(3)!.name, "get Font 3 name");
    assert.equal(3, fonts1.getFont("ShxFont0")!.id, "get Font 3, by name");
    assert.equal(FontType.TrueType, fonts1.getFont(4)!.type, "get font 4 type is TrueType");
    assert.equal("Calibri", fonts1.getFont(4)!.name, "get Font 4 name");
    assert.equal(4, fonts1.getFont("Calibri")!.id, "get Font 3, by name");
    assert.isUndefined(fonts1.getFont("notfound"), "attempt lookup of a font that should not be found");
    assert.deepEqual(new FontMap(fonts1.toJSON()), fonts1, "toJSON on FontMap");
  });

  it("creates a RenderPlan from a viewport", () => {
    const vpView = spatialView.clone<SpatialViewState>();
    const vp = new TestViewport(canvas!, vpView);
    let plan: RenderPlan| undefined;
    try {
      plan = new RenderPlan(vp);
    } catch (e) {
      plan = undefined;
    }

    expect(plan).not.to.be.undefined;
    expect(plan!.is3d).to.be.true;
    expect(plan!.activeVolume).to.be.undefined;
    expect(plan!.hline).not.to.be.undefined;
    expect(plan!.hline!.visible.ovrColor).to.be.false;
    expect(plan!.hline!.hidden.width).to.equal(0);
    expect(plan!.lights).to.be.undefined;
  });
});

describe("Cartographic tests", () => {
  it("Cartographic should convert properly", () => {
    const exton = Cartographic.fromDegrees(75, 40, 0);
    assert.equal(exton.toString(), "(1.3089969389957472, 0.6981317007977318, 0)", "exton toString");
    assert.isTrue(exton.equals(exton.clone()));

    const ecef1 = exton.toEcef();
    assert.isTrue(ecef1.isAlmostEqual({ x: 1266325.9090166602, y: 4725992.6313910205, z: 4077985.5722003765 }), "toEcef should work");
    const exton2 = Cartographic.fromEcef(ecef1);
    assert.isTrue(exton.equalsEpsilon(exton2!, 0.01));

    const paris = Cartographic.fromAngles(Angle.createDegrees(2.3522), Angle.createDegrees(48.8566), 67);
    const ecefParis = paris.toEcef();
    assert.isTrue(ecefParis.isAlmostEqual({ x: 4200958.840878805, y: 172561.58554401112, z: 4780131.797337915 }), "paris");
    const paris2 = Cartographic.fromEcef(ecefParis);
    assert.isTrue(paris.equalsEpsilon(paris2!, 0.01));

    const newYork = new Cartographic(Angle.degreesToRadians(74.006), Angle.degreesToRadians(49.7128), -100);
    const ecefNY = newYork.toEcef();
    assert.isTrue(ecefNY.isAlmostEqual({ x: 1138577.8226437706, y: 3972262.6507547107, z: 4842118.181650281 }), "new york");
    const ny2 = Cartographic.fromEcef(ecefNY);
    assert.isTrue(newYork.equalsEpsilon(ny2!, 0.01));
  });
});

// RenderLoop tests exist because all the rendering code lives in the mono-repo, while
// applications like proto-gist which actually allow the user to open a viewport reside outside
// of the mono-repo. This test opens a viewport and then lets the browser's event loop run indefinitely,
// so that we can interact with and debug the viewport.
// Otherwise, every time we made a change/fix to the rendering code, we'd need to republish imodeljs-core
// so that we could test it in proto-gist.
const doRenderLoopTests = false;

describe("RenderLoop tests", () => {
  let imodel: IModelConnection;
  let spatialView: SpatialViewState;

  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  canvas!.width = canvas!.height = 400;
  document.body.appendChild(canvas!);

  before(async () => {
    if (!doRenderLoopTests)
      return;

    IModelApp.startup("QA", true);
    imodel = await IModelConnection.openStandalone(iModelLocation);
    spatialView = await imodel.views.load("0x34") as SpatialViewState;
    spatialView.setStandardRotation(StandardViewId.RightIso);
  });

  after(async (done) => {
    if (!doRenderLoopTests)
      done();
  });

  it("should start up the render loop", () => {
    if (!doRenderLoopTests)
      return;

    const target = IModelApp.renderSystem.createTarget(canvas);
    const viewport = new TestViewport(canvas, spatialView, target);
    IModelApp.viewManager.addViewport(viewport);

    const plan = new RenderPlan(viewport);
    plan.bgColor.tbgr = ColorByName.darkBlue;
    target.changeRenderPlan(plan);
    expect((target as Target).bgColor.tbgr).to.equal(ColorByName.darkBlue);

    target.drawFrame();
  });
});

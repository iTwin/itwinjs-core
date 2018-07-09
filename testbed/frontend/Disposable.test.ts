/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { WebGLTestContext } from "./WebGLTestContext";
import { IModelApp, IModelConnection, Viewport } from "@bentley/imodeljs-frontend";
import { ColorDef, ImageBuffer, ImageBufferFormat, ImageSource, ImageSourceFormat, RenderTexture, QPoint3dList, QParams3d, ColorByName } from "@bentley/imodeljs-common";
import { CONSTANTS } from "../common/Testbed";
import * as path from "path";
import {
  MeshArgs, OnScreenTarget, GraphicBuilderCreateParams, GraphicType,
  Target, Decorations, Batch, DecorationList, WorldDecorations, TextureHandle, UpdatePlan, System,
} from "@bentley/imodeljs-frontend/lib/rendering";
import { Point3d, Range3d, Arc3d } from "@bentley/geometry-core";
import { FakeGMState, FakeModelProps, FakeREProps } from "./TileIO.test";
import { TileIO, IModelTileIO } from "@bentley/imodeljs-frontend/lib/tile";
import { TileData } from "./TileIO.data";
import { TestData } from "./TestData";

/* tslint:disable:no-console */

const iModelLocation = path.join(CONSTANTS.IMODELJS_CORE_DIRNAME, "testbed/node_modules/@bentley/imodeljs-backend/src/test/assets/test.bim");
let canvas: HTMLCanvasElement;
let imodel0: IModelConnection;
let imodel1: IModelConnection;
const itemsChecked: object[] = [];  // Private helper array for storing what objects have already been checked for disposal in isDisposed()

/**
 * Class holding a RenderTarget that provides getters for all of a Target's typically private members, as well as members that may be set to undefined when disposing.
 * This way, it is possible to retain references to objects despite their disposal through target, where they are set to undefined.
 */
class ExposedTarget {
  public target: Target;

  public constructor(target: Target) {
    this.target = target;
  }

  public get decorations(): Decorations | undefined { return (this.target as any)._decorations; }
  public get dynamics(): DecorationList | undefined { return (this.target as any)._dynamics; }
  public get worldDecorations(): WorldDecorations | undefined { return (this.target as any)._worldDecorations; }
  public get clipMask(): TextureHandle | undefined { return (this.target as any)._clipMask; }
  public get environmentMap(): TextureHandle | undefined { return (this.target as any)._environmentMap; }
  public get diffuseMap(): TextureHandle | undefined { return (this.target as any)._diffuseMap; }
  public get batchesClone(): Batch[] { return (this.target as any)._batches.slice(); }
}

/** Return a Uint8Array that can be used for construction of an ImageBuffer. */
function getImageBufferData(): Uint8Array {
  const buffer = new Uint8Array(4096);
  let currentBufferIdx = 0;
  const color = ColorDef.from(54, 117, 255);
  for (let i = 0; i < 1024; i++ , currentBufferIdx += 4) {
    buffer[currentBufferIdx] = color.colors.r; buffer[currentBufferIdx + 1] = color.colors.g; buffer[currentBufferIdx + 2] = color.colors.b; buffer[currentBufferIdx + 3] = color.getAlpha();
  }
  return buffer;
}

/** Returns true if for every batch of the given array, the feature overrides have shared ownership with the given target. */
function allOverridesSharedWithTarget(target: Target, batches: Batch[]): boolean {
  for (const batch of batches) {
    for (const ovr of (batch as any)._overrides) {
      if (ovr.target !== target) {
        return false;
      }
    }
  }
  return true;
}

/**
 * For all members of the object given, if the member is a disposable object, ensure that it is disposed (recursive).
 * Optionally specify a list of property names to be ignored by the isDisposed checks.
 * Note: This will not work for objects holding disposable members that they do not own, unless those attributes are specified to be
 * ignored.
 */
function isDisposed(disposable: any, ignoredAttribs?: string[]): boolean {
  itemsChecked.length = 0;
  return disposedCheck(disposable, ignoredAttribs);
}

/** Private helper method for isDisposed. */
function disposedCheck(disposable: any, ignoredAttribs?: string[]): boolean {
  if (disposable === undefined || disposable === null)
    return true;

  if (itemsChecked.indexOf(disposable) === -1)  // We want to check matching references (skipping primitive types here is okay, since they can't be disposable)
    itemsChecked.push(disposable);
  else
    return true;

  if (Array.isArray(disposable)) {  // Array
    itemsChecked.push(disposable);
    for (const elem of disposable)
      if (!disposedCheck(elem))
        return false;

  } else if (disposable.isDisposed !== undefined) { // Low-level WebGL resource disposable
    itemsChecked.push(disposable);
    return disposable.isDisposed;

  } else if (typeof disposable === "object") {  // High-level rendering object disposable
    for (const prop in disposable) {
      if (disposable.hasOwnProperty(prop) && typeof disposable[prop] === "object") {
        if (ignoredAttribs !== undefined && ignoredAttribs.indexOf(prop) !== -1)
          continue;
        if (Array.isArray(disposable[prop]) || disposable[prop].dispose !== undefined)
          if (!disposedCheck(disposable[prop]))
            return false;
      }
    }
  }
  return true;
}

describe("Disposal of WebGL Resources", () => {
  before(async () => {
    canvas = document.createElement("canvas") as HTMLCanvasElement;
    assert(null !== canvas);
    canvas!.width = canvas!.height = 1000;
    document.body.appendChild(canvas!);

    WebGLTestContext.startup();
    imodel0 = await IModelConnection.openStandalone(iModelLocation);
    imodel1 = await IModelConnection.open(TestData.accessToken, TestData.testProjectId, TestData.testIModelId);
  });
  after(async () => {
    await imodel0.closeStandalone();
    await imodel1.close(TestData.accessToken);
    WebGLTestContext.shutdown();
  });

  it("expect rendersystem disposal to trigger disposal of textures cached in id-map", async () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }
    const system = IModelApp.renderSystem;

    // Create image buffer and image source
    const imageBuff = ImageBuffer.create(getImageBufferData(), ImageBufferFormat.Rgba, 1);
    assert.isDefined(imageBuff);
    const imageSrcData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 3, 0, 0, 0, 3, 8, 2, 0, 0, 0, 217, 74, 34, 232, 0, 0, 0, 1, 115, 82, 71, 66, 0, 174, 206, 28, 233, 0, 0, 0, 4, 103, 65, 77, 65, 0, 0, 177, 143, 11, 252, 97, 5, 0, 0, 0, 9, 112, 72, 89, 115, 0, 0, 14, 195, 0, 0, 14, 195, 1, 199, 111, 168, 100, 0, 0, 0, 24, 73, 68, 65, 84, 24, 87, 99, 248, 15, 4, 12, 12, 64, 4, 198, 64, 46, 132, 5, 162, 254, 51, 0, 0, 195, 90, 10, 246, 127, 175, 154, 145, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
    const imageSrc = new ImageSource(imageSrcData, ImageSourceFormat.Png);

    // Texture from image buffer
    const textureParams0 = new RenderTexture.Params("-192837465");
    const texture0 = system.createTextureFromImageBuffer(imageBuff!, imodel0, textureParams0);
    assert.isDefined(texture0);

    // Texture from image source
    const textureParams1 = new RenderTexture.Params("-918273645");
    const texture1 = system.createTextureFromImageSource(imageSrc, 256, 256, imodel0, textureParams1);
    assert.isDefined(texture1);

    // Pre-disposal
    assert.isFalse(isDisposed(texture0!));
    assert.isFalse(isDisposed(texture1!));

    system.dispose();

    // Post-disposal
    assert.isTrue(isDisposed(texture0!));
    assert.isTrue(isDisposed(texture1!));
    assert.isUndefined(system.findTexture("-192837465", imodel0));
    assert.isUndefined(system.findTexture("-918273645", imodel0));
  });

  it("expect disposal of graphics to trigger top-down disposal of all WebGL resources", async () => {
    if (!IModelApp.hasRenderSystem)
      return;
    const system = IModelApp.renderSystem;

    // Create two MeshGraphics from arguments
    const args = new MeshArgs();
    const points = [new Point3d(0, 0, 0), new Point3d(10, 0, 0), new Point3d(0, 10, 0)];
    args.points = new QPoint3dList(QParams3d.fromRange(Range3d.createArray(points)));
    for (const point of points)
      args.points.add(point);
    args.vertIndices = [0, 1, 2];
    args.colors.initUniform(ColorByName.tan);
    const meshGraphic0 = system.createTriMesh(args, imodel0)!;
    const meshGraphic1 = system.createTriMesh(args, imodel0)!;
    assert.isDefined(meshGraphic0);
    assert.isDefined(meshGraphic1);

    // Get a render graphic from tile reader
    const model = new FakeGMState(new FakeModelProps(new FakeREProps()), imodel0);
    const stream = new TileIO.StreamBuffer(TileData.triangles.buffer);
    const reader = IModelTileIO.Reader.create(stream, model, system);
    const readerRes = reader!.read();
    const tileGraphic = readerRes.renderGraphic!;
    assert.isDefined(tileGraphic);

    // Pre-disposal
    assert.isFalse(isDisposed(meshGraphic0));
    assert.isFalse(isDisposed(meshGraphic1));
    assert.isFalse(isDisposed(tileGraphic));

    meshGraphic0.dispose();
    meshGraphic1.dispose();

    // Post-disposal of graphic 0 and graphic 1
    assert.isTrue(isDisposed(meshGraphic0));
    assert.isTrue(isDisposed(meshGraphic1));
    assert.isFalse(isDisposed(tileGraphic));

    tileGraphic.dispose();

    // Post-disposal of tileGraphic
    assert.isTrue(isDisposed(tileGraphic));
  });

  it("expect disposal of target to trigger disposal of only owned resources", async () => {
    // Due to previous tests that disposed of some items, re-initialize the system, bipassing type-checking
    (IModelApp as any)._renderSystem = System.create();
    (IModelApp as any)._renderSystem.onInitialized();

    const system = IModelApp.renderSystem;

    // Let's grab an actual view and set up a target that is holding prepared decorations
    const viewDefinitions = await imodel1.views.getViewList({ from: "BisCore.DrawingViewDefinition" });
    assert.isTrue(viewDefinitions.length > 0);
    const viewState = await imodel1.views.load(viewDefinitions[0].id);
    assert.exists(viewState);

    const viewport = new Viewport(canvas, viewState);
    await viewport.changeView(viewState);
    viewport.viewFlags.setShowGrid(true);   // force a decoration to be turned on
    viewport.renderFrame(new UpdatePlan()); // force a frame to be rendered

    const target = viewport.target as OnScreenTarget;
    const exposedTarget = new ExposedTarget(target);

    // Create a graphic and a texture
    const textureParams = new RenderTexture.Params("-192837465");
    let texture = system.createTextureFromImageBuffer(ImageBuffer.create(getImageBufferData(), ImageBufferFormat.Rgba, 1)!, imodel0, textureParams);
    const gfParams = GraphicBuilderCreateParams.create(GraphicType.Scene, viewport);
    const graphicBuilder = target.createGraphic(gfParams);
    graphicBuilder.addArc(Arc3d.createCircularStartMiddleEnd(new Point3d(-100, 0, 0), new Point3d(0, 100, 0), new Point3d(100, 0, 0)) as Arc3d, false, false);
    const graphic = graphicBuilder.finish();

    // Pre-disposal
    assert.isFalse(isDisposed(target));
    assert.isFalse(isDisposed(texture));
    assert.isFalse(isDisposed(graphic));

    system.dispose();
    graphic.dispose();

    // Post-disposal of non-related items
    assert.isFalse(isDisposed(target));
    assert.isTrue(isDisposed(texture));
    assert.isTrue(isDisposed(graphic));

    texture = system.createTextureFromImageBuffer(ImageBuffer.create(getImageBufferData(), ImageBufferFormat.Rgba, 1)!, imodel0, textureParams);
    assert.isFalse(isDisposed(texture));

    // Get references to target members before they are modified due to disposing
    const batches = exposedTarget.batchesClone;
    const dynamics = exposedTarget.dynamics;
    const worldDecorations = exposedTarget.worldDecorations;
    const clipMask = exposedTarget.clipMask;
    const environmentMap = exposedTarget.environmentMap;
    const diffuseMap = exposedTarget.diffuseMap;
    target.dispose();

    // Post-disposal of target (not owned resource checks)
    if (batches.length > 0 && !allOverridesSharedWithTarget(target, batches))
      assert.isFalse(isDisposed(target));
    else
      assert.isTrue(isDisposed(target));
    assert.isFalse(isDisposed(texture));
    if (batches.length > 0 && !allOverridesSharedWithTarget(target, batches))
      assert.isFalse(isDisposed(batches));  // we did not call getOverrides on any graphics
    else
      assert.isTrue(isDisposed(batches));

    // Post-disposal of target (only owned resource checks)
    assert.isTrue(isDisposed(target, ["_batches", "_scene"]));   // This test claims _batches and _scene are the only disposable target members that are NOT fully owned
    assert.isTrue(isDisposed(exposedTarget.decorations));
    assert.isTrue(isDisposed(target.compositor));
    assert.isTrue(isDisposed(dynamics));
    assert.isTrue(isDisposed(worldDecorations));
    assert.isTrue(isDisposed(clipMask));
    assert.isTrue(isDisposed(environmentMap));
    assert.isTrue(isDisposed(diffuseMap));
  });
});

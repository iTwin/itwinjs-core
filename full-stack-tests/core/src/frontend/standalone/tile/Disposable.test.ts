/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { ByteStream, IDisposable } from "@bentley/bentleyjs-core";
import { Arc3d, Point3d, Range3d } from "@bentley/geometry-core";
import { ColorByName, ColorDef, ImageBuffer, ImageBufferFormat, QParams3d, QPoint3dList, RenderTexture } from "@bentley/imodeljs-common";
import {
  Decorations, GraphicList, GraphicType, ImdlReader, IModelApp, IModelConnection, OffScreenViewport, PlanarClassifierMap, PlanarClassifierTarget,
  PlanarClipMaskState, RenderMemory, RenderPlanarClassifier, RenderTextureDrape, SceneContext, ScreenViewport, SnapshotConnection, TextureDrapeMap,
  TileTreeReference,
} from "@bentley/imodeljs-frontend";
import { MeshArgs } from "@bentley/imodeljs-frontend/lib/render-primitives";
import { Batch, FrameBuffer, OnScreenTarget, Target, TextureHandle, WorldDecorations } from "@bentley/imodeljs-frontend/lib/webgl";
import { testViewports } from "../../TestViewport";
import { TILE_DATA_1_1 } from "./data/TileIO.data.1.1";
import { FakeGMState, FakeModelProps, FakeREProps } from "./TileIO.test";

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
  public get dynamics(): GraphicList | undefined { return (this.target as any)._dynamics; }
  public get worldDecorations(): WorldDecorations | undefined { return (this.target as any)._worldDecorations; }
  public get clipMask(): TextureHandle | undefined { return (this.target as any)._clipMask; }
  public get environmentMap(): TextureHandle | undefined { return (this.target as any)._environmentMap; }
  public get diffuseMap(): TextureHandle | undefined { return (this.target as any)._diffuseMap; }
  public get batchesClone(): Batch[] { return (this.target as any)._batches.slice(); }
  public get planarClassifiers(): PlanarClassifierMap | undefined { return (this.target as any)._planarClassifiers; }
  public get textureDrapes(): TextureDrapeMap | undefined { return (this.target as any)._textureDrapes; }

  public changePlanarClassifiers(map: PlanarClassifierMap | undefined) {
    // The real implementation takes sole ownership of the map. Tests like to reuse same map. So clone it.
    if (undefined !== map)
      map = new Map<string, RenderPlanarClassifier>(map);

    this.target.changePlanarClassifiers(map);
  }

  public changeTextureDrapes(map: TextureDrapeMap | undefined) {
    if (undefined !== map)
      map = new Map<string, RenderTextureDrape>(map);

    this.target.changeTextureDrapes(map);
  }
}

/** Return a Uint8Array that can be used for construction of an ImageBuffer. */
function getImageBufferData(): Uint8Array {
  const buffer = new Uint8Array(4096);
  let currentBufferIdx = 0;
  const color = ColorDef.from(54, 117, 255);
  for (let i = 0; i < 1024; i++, currentBufferIdx += 4) {
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

  } else if (disposable.dispose !== undefined) { // Low-level WebGL resource disposable
    expect(typeof (disposable.dispose)).to.equal("function");
    expect(typeof (disposable.isDisposed)).to.equal("boolean");
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

// This test block exists on its own since disposal of System causes system to detach from an imodel's onClose event
describe("Disposal of System", () => {
  before(async () => {
    await IModelApp.startup({ renderSys: { doIdleWork: false } });
    imodel0 = await SnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver
  });

  after(async () => {
    await imodel0.close();
    await IModelApp.shutdown();
  });

  it("expect rendersystem disposal to trigger disposal of textures cached in id-map", async () => {
    const system = IModelApp.renderSystem;

    // Create image buffer and image source
    const imageBuff = ImageBuffer.create(getImageBufferData(), ImageBufferFormat.Rgba, 1);
    assert.isDefined(imageBuff);

    // Texture from image buffer
    const textureParams0 = new RenderTexture.Params("-192837465");
    const texture0 = system.createTextureFromImageBuffer(imageBuff, imodel0, textureParams0);
    assert.isDefined(texture0);

    // Texture from image source
    const textureParams1 = new RenderTexture.Params("-918273645");
    const texture1 = system.createTextureFromImageBuffer(imageBuff, imodel0, textureParams1);
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
});

describe("Disposal of WebGL Resources", () => {
  before(async () => {
    await IModelApp.startup({ renderSys: { doIdleWork: false } });

    imodel0 = await SnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver
    imodel1 = await SnapshotConnection.openFile("testImodel.bim"); // relative path resolved by BackendTestAssetResolver
  });

  after(async () => {
    await imodel0.close();
    await imodel1.close();
    await IModelApp.shutdown();
  });

  // ###TODO: Update TileIO.data.ts for new tile format...
  it("expect disposal of graphics to trigger top-down disposal of all WebGL resources", async () => {
    const system = IModelApp.renderSystem;

    // Create two MeshGraphics from arguments
    const args = new MeshArgs();
    const points = [new Point3d(0, 0, 0), new Point3d(10, 0, 0), new Point3d(0, 10, 0)];
    args.points = new QPoint3dList(QParams3d.fromRange(Range3d.createArray(points)));
    for (const point of points)
      args.points.add(point);
    args.vertIndices = [0, 1, 2];
    args.colors.initUniform(ColorByName.tan);
    const meshGraphic0 = system.createTriMesh(args)!;
    const meshGraphic1 = system.createTriMesh(args)!;
    assert.isDefined(meshGraphic0);
    assert.isDefined(meshGraphic1);

    // Get a render graphic from tile reader
    const model = new FakeGMState(new FakeModelProps(new FakeREProps()), imodel0);
    const stream = new ByteStream(TILE_DATA_1_1.triangles.bytes.buffer);
    const reader = ImdlReader.create(stream, model.iModel, model.id, model.is3d, system);
    expect(reader).not.to.be.undefined;
    const readerRes = await reader!.read();
    const tileGraphic = readerRes.graphic!;
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

  it("disposes of Target's framebuffer and attachments", async () => {
    const views = await imodel1.views.getViewList({ from: "BisCore.DrawingViewDefinition" });
    expect(views.length).least(1);

    await testViewports(views[0].id, imodel1, 10, 10, async (vp) => {
      expect(vp instanceof ScreenViewport || vp instanceof OffScreenViewport).to.be.true;
      expect(vp.isDisposed).to.be.false;

      const target = (vp.target as any);
      let fbo = target._fbo as FrameBuffer;
      expect(fbo).to.be.undefined;
      let blitGeom = target._blitGeom;
      expect(blitGeom).to.be.undefined;

      vp.renderFrame();
      fbo = target._fbo as FrameBuffer;
      expect(fbo).not.to.be.undefined;
      expect(fbo.isDisposed).to.be.false;
      const tx = fbo.getColor(0)!;
      expect(tx).not.to.be.undefined;
      expect(tx.isDisposed).to.be.false;

      blitGeom = target._blitGeom as IDisposable;
      expect(blitGeom === undefined).to.equal(vp instanceof OffScreenViewport);
      if (blitGeom)
        expect(blitGeom.isDisposed).to.be.false;

      vp.dispose();
      expect(vp.isDisposed).to.be.true;
      expect(target.isDisposed).to.be.true;

      expect(target._fbo).to.be.undefined;
      expect(fbo.isDisposed).to.be.true;
      expect(tx.isDisposed).to.be.true;
      if (blitGeom) {
        expect(target._blitGeom).to.be.undefined;
        expect(blitGeom.isDisposed).to.be.true;
      }
    });
  });

  class Classifier extends RenderPlanarClassifier {
    public disposed = false;
    public constructor() { super(); }
    public collectGraphics(_context: SceneContext, _target: PlanarClassifierTarget): void { }
    public setSource(_classifierTreeRef?: TileTreeReference, _planarClipMask?: PlanarClipMaskState): void { }
    public dispose(): void {
      expect(this.disposed).to.be.false;
      this.disposed = true;
    }
  }

  class Drape extends RenderTextureDrape {
    public disposed = false;
    public constructor() { super(); }
    public collectGraphics(_context: SceneContext): void { }
    public collectStatistics(_stats: RenderMemory.Statistics): void { }
    public dispose(): void {
      expect(this.disposed).to.be.false;
      this.disposed = true;
    }
  }

  interface ClassifierOrDrape {
    disposed: boolean;
    dispose(): void;
  }

  async function testClassifiersOrDrapes<T extends ClassifierOrDrape>(
    map: Map<string, T>,
    key: "planarClassifiers" | "textureDrapes",
    ctor: () => T,
    get: (target: ExposedTarget, id: string) => T | undefined,
    change: (target: ExposedTarget, map: Map<string, T> | undefined) => void,
  ): Promise<void> {
    const viewDefs = await imodel0.views.getViewList({ from: "BisCore.SpatialViewDefinition" });
    expect(viewDefs[0]).not.to.be.undefined;
    const view = await imodel0.views.load(viewDefs[0].id);
    expect(view).not.to.be.undefined;

    const div = document.createElement("div");
    div.style.width = div.style.height = "100px";
    document.body.appendChild(div);

    const vp = ScreenViewport.create(div, view);
    const target = new ExposedTarget(vp.target as Target);

    expect(target[key]).to.be.undefined;

    // Add an entry.
    const c1 = ctor();
    map.set("0x1", c1);
    change(target, map);
    expect(target[key]).not.to.be.undefined;
    expect(target[key]!.size).to.equal(1);
    expect(get(target, "0x1")).to.equal(c1);
    expect(c1.disposed).to.be.false;

    // Remove all entries..
    change(target, undefined);
    expect(target[key]).to.be.undefined;
    expect(get(target, "0x1")).to.be.undefined;
    expect(c1.disposed).to.be.true;

    // Change to same map twice.
    c1.disposed = false;
    change(target, map);
    change(target, map);
    expect(target[key]).not.to.be.undefined;
    expect(target[key]!.size).to.equal(1);
    expect(get(target, "0x1")).to.equal(c1);
    expect(c1.disposed).to.be.false;

    // Associate a different value with same Id.
    const c2 = ctor();
    map.set("0x1", c2);
    change(target, map);
    expect(target[key]).not.to.be.undefined;
    expect(target[key]!.size).to.equal(1);
    expect(get(target, "0x1")).to.equal(c2);
    expect(c2.disposed).to.be.false;
    expect(c1.disposed).to.be.true;

    // Add another entry.
    c1.disposed = false;
    map.set("0x2", c1);
    change(target, map);
    expect(target[key]).not.to.be.undefined;
    expect(target[key]!.size).to.equal(2);
    expect(get(target, "0x1")).to.equal(c2);
    expect(get(target, "0x2")).to.equal(c1);
    expect(c1.disposed).to.be.false;
    expect(c2.disposed).to.be.false;

    // Remove one entry.
    map.delete("0x1");
    change(target, map);
    expect(target[key]).not.to.be.undefined;
    expect(target[key]!.size).to.equal(1);
    expect(get(target, "0x2")).to.equal(c1);
    expect(c1.disposed).to.be.false;
    expect(c2.disposed).to.be.true;

    // Dispose of the target.
    vp.dispose();
    expect(target[key]).to.be.undefined;
    expect(c1.disposed).to.be.true;
  }

  it("should manage lifetimes of planar classifiers", async () => {
    const map = new Map<string, Classifier>();
    await testClassifiersOrDrapes<Classifier>(map, "planarClassifiers",
      () => new Classifier(),
      (target, id) => target.target.getPlanarClassifier(id) as Classifier,
      (target, newMap) => target.changePlanarClassifiers(newMap));
  });

  it("should manage lifetimes of texture drapes", async () => {
    const map = new Map<string, Drape>();
    await testClassifiersOrDrapes<Drape>(map, "textureDrapes",
      () => new Drape(),
      (target, id) => target.target.getTextureDrape(id) as Drape,
      (target, newMap) => target.changeTextureDrapes(newMap));
  });

  // NB: This rather wacky test disposes of IModelApp.renderSystem. Therefore it must be run last of all of these tests, or subsequent tests expecting
  // IModelApp.renderSystem to still be alive will fail.
  it("expect disposal of target to trigger disposal of only owned resources", async () => {
    const system = IModelApp.renderSystem;

    // Let's grab an actual view and set up a target that is holding prepared decorations
    const viewDefinitions = await imodel1.views.getViewList({ from: "BisCore.DrawingViewDefinition" });
    assert.isTrue(viewDefinitions.length > 0);
    const viewState = await imodel1.views.load(viewDefinitions[0].id);
    assert.exists(viewState);

    const viewDiv = document.createElement("div");
    viewDiv.style.width = viewDiv.style.height = "1000px";
    document.body.appendChild(viewDiv);

    const viewport = ScreenViewport.create(viewDiv, viewState);
    viewport.changeView(viewState);
    viewport.viewFlags.grid = true;   // force a decoration to be turned on
    viewport.renderFrame(); // force a frame to be rendered

    const target = viewport.target as OnScreenTarget;
    const exposedTarget = new ExposedTarget(target);

    // Create a graphic and a texture
    const textureParams = new RenderTexture.Params("-192837465");
    let texture = system.createTextureFromImageBuffer(ImageBuffer.create(getImageBufferData(), ImageBufferFormat.Rgba, 1)!, imodel0, textureParams);
    const graphicBuilder = target.createGraphicBuilder(GraphicType.Scene, viewport);
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

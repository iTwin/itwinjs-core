/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  IModelApp,
  Viewport,
  GraphicList,
  RenderClipVolume,
  Decorations,
  RenderPlan,
  ViewRect,
  Pixel,
  GraphicType,
  RenderGraphic,
  GraphicBranch,
  PackedFeatureTable,
  IModelConnection,
  RenderTarget,
  RenderSystem,
} from "@bentley/imodeljs-frontend";
import {
  PrimitiveBuilder,
  MeshParams,
  PolylineParams,
  PointStringParams,
  PointCloudArgs,
  RenderMemory,
} from "@bentley/imodeljs-frontend/lib/rendering";
import { ElementAlignedBox3d } from "@bentley/imodeljs-common";
import { Transform } from "@bentley/geometry-core";
import { Id64String, dispose } from "@bentley/bentleyjs-core";
import { expect } from "chai";

// Contains extensible mock implementations of the various components of a RenderSystem.
// Use these instead of the default RenderSystem wherever possible because:
//  (1) Electron has a bug on Windows in which it fails to obtain a WebGLRenderingContext when running inside a VM (e.g., during CI job); and
//  (2) To decouple the logic which uses aspects of the RenderSystem from the full implementation.
// Any and all of these types can be extended for the purposes of specific tests.
// To use this:
//  (1) If overriding anything in the implementation supplied herein, pass a SystemFactory function to MockRender.App.systemFactory.
//  (2) Call MockRender.App.startup() instead of IModelApp.startup() or MaybeRenderApp.startup() before tests begin.
//  (3) Likewise call MockRender.App.shutdown() when finished. This resets the SystemFactory to its default.
export namespace MockRender {
  export abstract class Target extends RenderTarget {
    protected constructor(private readonly _system: System) { super(); }

    public get renderSystem(): RenderSystem { return this._system; }
    public get cameraFrustumNearScaleLimit() { return 0; }
    public get wantInvertBlackBackground() { return false; }
    public get animationFraction() { return 0; }
    public set animationFraction(_fraction: number) { }
    public changeScene(_scene: GraphicList, _activeVolume?: RenderClipVolume) { }
    public changeTerrain(_terrain: GraphicList) { }
    public changeDynamics(_dynamics?: GraphicList) { }
    public changeDecorations(_decs: Decorations) { }
    public changeRenderPlan(_plan: RenderPlan) { }
    public drawFrame(_sceneTime?: number) { }
    public updateViewRect() { return false; }
    public readPixels(_rect: ViewRect, _selector: Pixel.Selector, receiver: Pixel.Receiver) { receiver(undefined); }
  }

  export class OnScreenTarget extends Target {
    public constructor(system: System, private readonly _canvas: HTMLCanvasElement) { super(system); }

    public get viewRect() { return new ViewRect(0, 0, this._canvas.clientWidth, this._canvas.clientHeight); }
    public setViewRect(_rect: ViewRect, _temp: boolean) { }
  }

  export class OffScreenTarget extends Target {
    public constructor(system: System, private readonly _viewRect: ViewRect) { super(system); }

    public get viewRect() { return this._viewRect; }
    public setViewRect(rect: ViewRect, _temp: boolean) { this._viewRect.setFrom(rect); }
  }

  export class Builder extends PrimitiveBuilder {
    public constructor(system: System, placement: Transform = Transform.identity, type: GraphicType, viewport: Viewport, pickId?: Id64String) {
      super(system, type, viewport, placement, pickId);
    }
  }

  export class Graphic extends RenderGraphic {
    public constructor() { super(); }

    public dispose() { }
    public collectStatistics(_stats: RenderMemory.Statistics): void { }
  }

  export class List extends Graphic {
    public constructor(public readonly graphics: RenderGraphic[]) { super(); }

    public dispose() {
      for (const graphic of this.graphics)
        dispose(graphic);

      this.graphics.length = 0;
    }
  }

  export class Branch extends Graphic {
    public constructor(public readonly branch: GraphicBranch, public readonly transform: Transform, public readonly clips?: RenderClipVolume) { super(); }

    public dispose() { this.branch.dispose(); }
  }

  export class Batch extends Graphic {
    public constructor(public readonly graphic: RenderGraphic, public readonly featureTable: PackedFeatureTable, public readonly range: ElementAlignedBox3d) { super(); }

    public dispose() {
      dispose(this.graphic);
    }
  }

  export class System extends RenderSystem {
    public get isValid() { return true; }
    public dispose(): void { }
    public get maxTextureSize() { return 4096; }

    public createTarget(canvas: HTMLCanvasElement) { return new OnScreenTarget(this, canvas); }
    public createOffscreenTarget(rect: ViewRect): RenderTarget { return new OffScreenTarget(this, rect); }

    public createGraphicBuilder(placement: Transform, type: GraphicType, viewport: Viewport, pickableId?: Id64String) { return new Builder(this, placement, type, viewport, pickableId); }
    public createGraphicList(primitives: RenderGraphic[]) { return new List(primitives); }
    public createBranch(branch: GraphicBranch, transform: Transform, clips?: RenderClipVolume) { return new Branch(branch, transform, clips); }
    public createBatch(graphic: RenderGraphic, features: PackedFeatureTable, range: ElementAlignedBox3d) { return new Batch(graphic, features, range); }

    public createMesh(_params: MeshParams) { return new Graphic(); }
    public createPolyline(_params: PolylineParams) { return new Graphic(); }
    public createPointString(_params: PointStringParams) { return new Graphic(); }
    public createPointCloud(_args: PointCloudArgs, _imodel: IModelConnection) { return new Graphic(); }
  }

  export type SystemFactory = () => RenderSystem;

  export class App extends IModelApp {
    public static systemFactory: SystemFactory = () => App.createDefaultRenderSystem();

    protected static supplyRenderSystem(): RenderSystem { return this.systemFactory(); }
    public static shutdown(): void {
      this.systemFactory = () => App.createDefaultRenderSystem();
      super.shutdown();
    }

    protected static createDefaultRenderSystem() { return new System(); }
  }
}

class MyTarget extends MockRender.OffScreenTarget { }
class MyList extends MockRender.List { }
class MySystem extends MockRender.System {
  public createOffscreenTarget(rect: ViewRect): RenderTarget { return new MyTarget(this, rect); }
  public createGraphicList(list: RenderGraphic[]) { return new MyList(list); }
}

describe("MockRender", () => {
  before(() => {
    MockRender.App.systemFactory = () => new MySystem();
    MockRender.App.startup();
  });

  after(() => MockRender.App.shutdown());

  it("Should override mock render system", () => {
    expect(IModelApp.hasRenderSystem).to.be.true;
    expect(IModelApp.renderSystem).instanceof(MySystem);
    expect(IModelApp.renderSystem.createOffscreenTarget(new ViewRect(0, 0, 10, 20))).instanceof(MyTarget);
    expect(IModelApp.renderSystem.createGraphicList([])).instanceof(MyList);
  });
});

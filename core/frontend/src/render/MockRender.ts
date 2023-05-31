/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Utils
 */

import { dispose } from "@itwin/core-bentley";
import { Transform } from "@itwin/core-geometry";
import { ElementAlignedBox3d, EmptyLocalization, RenderFeatureTable } from "@itwin/core-common";
import { IModelApp, IModelAppOptions } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { MeshParams } from "../common/render/primitives/MeshParams";
import { PointStringParams } from "../common/render/primitives/PointStringParams";
import { PolylineParams } from "../common/render/primitives/PolylineParams";
import { ViewRect } from "../common/ViewRect";
import { Decorations } from "./Decorations";
import { GraphicBranch, GraphicBranchOptions } from "./GraphicBranch";
import { CustomGraphicBuilderOptions, GraphicBuilder, ViewportGraphicBuilderOptions } from "./GraphicBuilder";
import { Pixel } from "./Pixel";
import { PrimitiveBuilder } from "./primitives/geometry/GeometryListBuilder";
import { PointCloudArgs } from "./primitives/PointCloudPrimitive";
import { GraphicList, RenderGraphic } from "./RenderGraphic";
import { RenderMemory } from "./RenderMemory";
import { RenderPlan } from "./RenderPlan";
import { RenderAreaPattern, RenderGeometry, RenderSystem } from "./RenderSystem";
import { RenderTarget } from "./RenderTarget";
import { Scene } from "./Scene";

/** Contains extensible mock implementations of the various components of a RenderSystem, intended for use in tests.
 * Use these for tests instead of the default RenderSystem wherever possible because:
 *  (1) Electron has a bug on Windows in which it fails to obtain a WebGLRenderingContext when running inside a VM (e.g., during CI job); and
 *  (2) To decouple the logic which uses aspects of the RenderSystem from the full implementation.
 * Any and all of these types can be extended for the purposes of specific tests.
 * To use this:
 *  (1) If overriding anything in the implementation supplied herein, pass a SystemFactory function to MockRender.App.systemFactory.
 *  (2) Call MockRender.App.startup() instead of IModelApp.startup() before tests begin.
 *  (3) Likewise call MockRender.App.shutdown() when finished. This resets the SystemFactory to its default.
 * @note The APIs within this namespace are intended *strictly* for use with unit tests.
 * @internal
 */
export namespace MockRender {
  /** @internal */
  export abstract class Target extends RenderTarget {
    protected constructor(private readonly _system: RenderSystem) { super(); }

    public get renderSystem(): RenderSystem { return this._system; }
    public get wantInvertBlackBackground() { return false; }
    public get analysisFraction() { return 0; }
    public set analysisFraction(_fraction: number) { }
    public changeScene(_scene: Scene) { }
    public changeDynamics(_dynamics?: GraphicList) { }
    public changeDecorations(_decs: Decorations) { }
    public changeRenderPlan(_plan: RenderPlan) { }
    public drawFrame(_sceneTime?: number) { }
    public updateViewRect() { return false; }
    public readPixels(_rect: ViewRect, _selector: Pixel.Selector, receiver: Pixel.Receiver, _excludeNonLocatable: boolean) { receiver(undefined); }
    public get screenSpaceEffects(): Iterable<string> { return []; }
    public set screenSpaceEffects(_effects: Iterable<string>) { }
  }

  /** @internal */
  export class OnScreenTarget extends Target {
    public constructor(system: RenderSystem, private readonly _canvas: HTMLCanvasElement) { super(system); }

    public get viewRect() { return new ViewRect(0, 0, this._canvas.clientWidth, this._canvas.clientHeight); }
    public setViewRect(_rect: ViewRect, _temp: boolean) { }
  }

  /** @internal */
  export class OffScreenTarget extends Target {
    public constructor(system: RenderSystem, private readonly _viewRect: ViewRect) { super(system); }

    public get viewRect() { return this._viewRect; }
    public setViewRect(rect: ViewRect, _temp: boolean) { this._viewRect.setFrom(rect); }
  }

  /** @internal */
  export class Builder extends PrimitiveBuilder {
    public constructor(system: System, options: CustomGraphicBuilderOptions | ViewportGraphicBuilderOptions) {
      super(system, options);
    }
  }

  export class Graphic extends RenderGraphic {
    public constructor() { super(); }

    public dispose() { }
    public collectStatistics(_stats: RenderMemory.Statistics): void { }
  }

  export class List extends Graphic {
    public constructor(public readonly graphics: RenderGraphic[]) { super(); }

    public override dispose() {
      for (const graphic of this.graphics)
        dispose(graphic);

      this.graphics.length = 0;
    }
  }

  export class Branch extends Graphic {
    public constructor(public readonly branch: GraphicBranch, public readonly transform: Transform, public readonly options?: GraphicBranchOptions) { super(); }

    public override dispose() { this.branch.dispose(); }
  }

  export class Batch extends Graphic {
    public constructor(public readonly graphic: RenderGraphic, public readonly featureTable: RenderFeatureTable, public readonly range: ElementAlignedBox3d) { super(); }

    public override dispose() {
      dispose(this.graphic);
    }
  }

  /** @internal */
  export class Geometry implements RenderGeometry {
    public dispose(): void { }
    public collectStatistics(): void { }
  }

  /** @internal */
  export class AreaPattern implements RenderAreaPattern {
    public dispose(): void { }
    public collectStatistics(): void { }
  }

  export class System extends RenderSystem {
    public get isValid() { return true; }
    public dispose(): void { }
    public override get maxTextureSize() { return 4096; }

    public constructor() { super(); }

    /** @internal */
    public override doIdleWork(): boolean { return false; }

    /** @internal */
    public override createTarget(canvas: HTMLCanvasElement): OnScreenTarget { return new OnScreenTarget(this, canvas); }
    /** @internal */
    public override createOffscreenTarget(rect: ViewRect): RenderTarget { return new OffScreenTarget(this, rect); }

    public override createGraphic(options: CustomGraphicBuilderOptions | ViewportGraphicBuilderOptions): GraphicBuilder {
      return new Builder(this, options);
    }

    public override createGraphicList(primitives: RenderGraphic[]) { return new List(primitives); }
    public override createGraphicBranch(branch: GraphicBranch, transform: Transform, options?: GraphicBranchOptions) { return new Branch(branch, transform, options); }
    public override createBatch(graphic: RenderGraphic, features: RenderFeatureTable, range: ElementAlignedBox3d) { return new Batch(graphic, features, range); }

    /** @internal */
    public override createMesh(_params: MeshParams) { return new Graphic(); }
    /** @internal */
    public override createPolyline(_params: PolylineParams) { return new Graphic(); }
    /** @internal */
    public override createPointString(_params: PointStringParams) { return new Graphic(); }
    /** @internal */
    public override createPointCloud(_args: PointCloudArgs, _imodel: IModelConnection) { return new Graphic(); }
    public override createRenderGraphic() { return new Graphic(); }

    /** @internal */
    public override createMeshGeometry() { return new Geometry(); }
    /** @internal */
    public override createPolylineGeometry() { return new Geometry(); }
    /** @internal */
    public override createPointStringGeometry() { return new Geometry(); }
    /** @internal */
    public override createAreaPattern() { return new AreaPattern(); }
  }

  export type SystemFactory = () => RenderSystem;

  /** An implementation of IModelApp which uses a MockRender.System by default. */
  export class App {
    public static systemFactory: SystemFactory = () => App.createDefaultRenderSystem();

    public static async startup(opts?: IModelAppOptions): Promise<void> {
      opts = opts ? opts : {};
      opts.renderSys = this.systemFactory();
      opts.localization = opts.localization ?? new EmptyLocalization();
      await IModelApp.startup(opts);
    }

    public static async shutdown(): Promise<void> {
      this.systemFactory = () => App.createDefaultRenderSystem();
      await IModelApp.shutdown();
    }

    protected static createDefaultRenderSystem() { return new System(); }
  }
}

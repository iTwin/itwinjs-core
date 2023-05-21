/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelApp
 */

import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp, IModelAppOptions } from "./IModelApp";
import { AnimationBranchStates } from "./render/GraphicBranch";
import { RenderSystem } from "./render/RenderSystem";
import { RenderTarget } from "./render/RenderTarget";
import { ViewRect } from "./common/ViewRect";

/**
 * A RenderTarget for applications that must run in environments where WebGL is not present.
 * This is typically used in tests.
 * @internal
 */
export class NullTarget extends RenderTarget {
  public get analysisFraction(): number { return 0; }
  public set analysisFraction(_fraction: number) { }
  public get renderSystem() { return undefined as any; }
  public get viewRect(): ViewRect { return new ViewRect(); }
  public get wantInvertBlackBackground(): boolean { return false; }
  public override get animationBranches(): AnimationBranchStates | undefined { return undefined; }
  public override set animationBranches(_branches: AnimationBranchStates | undefined) { }
  public onDestroy(): void { }
  public override reset(): void { }
  public changeScene(): void { }
  public changeDynamics(): void { }
  public changeDecorations(): void { }
  public changeRenderPlan(): void { }
  public drawFrame(_sceneMilSecElapsed?: number): void { }
  public override overrideFeatureSymbology(): void { }
  public override setHiliteSet(): void { }
  public override setFlashed(): void { }
  public setViewRect(): void { }
  public override onResized(): void { }
  public override dispose(): void { }
  public updateViewRect(): boolean { return false; }
  public readPixels(): void { }
  public get screenSpaceEffects(): Iterable<string> { return []; }
  public set screenSpaceEffects(_effects: Iterable<string>) { }
}

/**
 * A RenderSystem for applications that must run in environments where WebGL is not present.
 * This is typically used in tests.
 * @internal
 */
export class NullRenderSystem extends RenderSystem {
  public get isValid(): boolean { return false; }
  public doIdleWork(): boolean { return false; }
  public createTarget() { return new NullTarget(); }
  public createOffscreenTarget() { return new NullTarget(); }
  public createGraphic() { return undefined as any; }
  public createGraphicList() { return undefined as any; }
  public createGraphicBranch() { return undefined as any; }
  public createBatch() { return undefined as any; }
  public dispose() { }
  public constructor() { super(); }
  public override createRenderGraphic() { return undefined; }
}

/** A utility class intended for applications (primarily test-runners) that run in environments that lack support for WebGL.
 * It installs a [[RenderSystem]] that produces no graphics.
 * Use [[NoRenderApp.startup]] instead of [[IModelApp.startup]] to initialize your application frontend.
 * You may then use the [[IModelApp]] API as normal.
 * @public
 */
export class NoRenderApp {
  /** Initializes [[IModelApp]] with a [[RenderSystem]] that produces no graphics.
   * Use this in place of [[IModelApp.startup]], then proceed to use [[IModelApp]]'s API as normal.
   */
  public static async startup(opts?: IModelAppOptions): Promise<void> {
    opts = opts ? opts : {};
    opts.renderSys = new NullRenderSystem();
    opts.noRender = true;
    opts.localization = opts.localization ?? new EmptyLocalization();
    await IModelApp.startup(opts);
  }
}

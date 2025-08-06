/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { ElementAlignedBox3d, RenderFeatureTable } from "@itwin/core-common";
import { Transform } from "@itwin/core-geometry";
import { OffScreenTarget, OnScreenTarget } from "./Target";
import { CesiumGraphic } from "./Graphic";
import { BatchOptions, CreateGraphicFromTemplateArgs, CustomGraphicBuilderOptions, GraphicBranch, GraphicBranchOptions, GraphicBuilder, IModelApp, IModelConnection, InstancedGraphicParams, PrimitiveBuilder, RenderAreaPattern, RenderGeometry, RenderGraphic, RenderSystem, RenderTarget, ViewportGraphicBuilderOptions, ViewRect } from "@itwin/core-frontend";

// import { RenderSystem } from "../../../../../core/frontend/src/render/RenderSystem";
// // eslint-disable-next-line @itwin/import-within-package
// import { RenderAreaPattern } from "../../../../../core/frontend/src/internal/render/RenderAreaPattern";
// // eslint-disable-next-line @itwin/import-within-package
// import { RenderGeometry } from "../../../../../core/frontend/src/internal/render/RenderGeometry";
// // eslint-disable-next-line @itwin/import-within-package
// import { PrimitiveBuilder } from "../../../../../core/frontend/src/internal/render/PrimitiveBuilder";

// /** @internal */
// export class Builder extends GraphicBuilder {
//   public constructor(system: System, options: CustomGraphicBuilderOptions | ViewportGraphicBuilderOptions) {
//     super(system, options);
//   }
// }

/** @internal */
export class System extends RenderSystem {
  private _removeEventListener?: () => void;

  // ###TODO
  public get isValid(): boolean { return true; }

  public static create(optionsIn?: RenderSystem.Options): System {
    console.log("creating Cesium System...");

    const options: RenderSystem.Options = undefined !== optionsIn ? optionsIn : {};

    // ###TODO use new CesiumJS shared context API: https://github.com/CesiumGS/cesium/pull/12635

    // const canvas = document.createElement("canvas");
    // if (null === canvas)
    //   throw new IModelError(BentleyStatus.ERROR, "Failed to obtain HTMLCanvasElement");

    // const context = this.createContext(canvas, true, optionsIn?.contextAttributes);
    // if (undefined === context)
    //   throw new IModelError(BentleyStatus.ERROR, "Failed to obtain WebGL context");

    // if (!(context instanceof WebGL2RenderingContext))
    //   throw new IModelError(BentleyStatus.ERROR, "WebGL 2 support is required");

    // const capabilities = Capabilities.create(context, options.disabledExtensions);
    // if (undefined === capabilities)
    //   throw new IModelError(BentleyStatus.ERROR, "Failed to initialize rendering capabilities");

    // // set actual gl state to match desired state defaults
    // context.depthFunc(GL.DepthFunc.Default);  // LessOrEqual

    return new this(options);
  }

  protected constructor(options: RenderSystem.Options) {
    super(options);

    // Make this System a subscriber to the the IModelConnection onClose event
    this._removeEventListener = IModelConnection.onClose.addListener((_model) => { /* this.removeIModelMap(imodel)); */ });
  }

  public dispose() {
    // ###TODO Implement disposal logic for Cesium System if necessary
    if (undefined !== this._removeEventListener) {
      this._removeEventListener();
      this._removeEventListener = undefined;
    }
  }

  public static get instance() { return IModelApp.renderSystem as System; }

  public createTarget(canvas: HTMLCanvasElement): RenderTarget {
    return new OnScreenTarget(canvas);
    // return new OnScreenTarget(canvas);
    // ###TODO Implement target creation logic for Cesium
  }

  public createOffscreenTarget(rect: ViewRect): RenderTarget {
    return new OffScreenTarget(rect);
  }

  public doIdleWork(): boolean {
    // ###TODO - should we just remove the requirement for `doIdleWork` in a System? We are not using this anywhere anymore, right?
    return false;
  }

  public createGraphic(options: CustomGraphicBuilderOptions | ViewportGraphicBuilderOptions): GraphicBuilder {
    return new PrimitiveBuilder(this, options); // ###TODO let's check what this function is doing.
  }

  // ###TODO for all of the following create methods, we may need to implement separate classes for each type of graphic. Right now everything is using `CesiumGraphic` as a placeholder. In theory that might be able to handle everything, but we will see. Let's get one path working first!

  public override createGraphicFromTemplate(_args: CreateGraphicFromTemplateArgs): RenderGraphic {
    // ###TODO instancing in Cesium? Take into account _args?
    return new CesiumGraphic();
  }

  public override createRenderGraphic(_geometry: RenderGeometry, _instances?: InstancedGraphicParams | RenderAreaPattern): RenderGraphic | undefined {
    // ###TODO actually do something here with the args
    return new CesiumGraphic();
  }

  public createGraphicList(_primitives: RenderGraphic[]): RenderGraphic {
    // ##TODO implement logic to create a graphic list from the array of primitives.
    return new CesiumGraphic();
  }

  public createGraphicBranch(_lBranch: GraphicBranch, _transform: Transform, _options?: GraphicBranchOptions): RenderGraphic {
    // ###TODO implement logic to create a graphic branch from the branch and transform
    return new CesiumGraphic();
  }

  public createBatch(_graphic: RenderGraphic, _features: RenderFeatureTable, _range: ElementAlignedBox3d, _options?: BatchOptions): RenderGraphic {
    // ###TODO implement logic to create a batch from the graphic, features, range, and options
    return new CesiumGraphic();
  }
}

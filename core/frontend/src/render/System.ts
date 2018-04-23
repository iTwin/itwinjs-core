/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ClipVector, Transform } from "@bentley/geometry-core";
import { AntiAliasPref,
         SceneLights,
         ViewFlags,
         Frustum,
         Hilite,
         HiddenLine,
         ColorDef,
         Graphic,
         Decorations,
         GraphicBranch } from "@bentley/imodeljs-common";
import { Viewport } from "../Viewport";
import { GraphicBuilder, GraphicBuilderCreateParams } from "./GraphicBuilder";
import { IModelConnection } from "../IModelConnection";

/**
 * A RenderPlan holds a Frustum and the render settings for displaying a Render::Scene into a Render::Target.
 */
export class RenderPlan {
  constructor(public is3d: boolean,
              public viewFlags: ViewFlags,
              public frustum: Frustum,
              public fraction: number,
              public bgColor: ColorDef,
              public monoColor: ColorDef,
              public hiliteSettings: Hilite.Settings,
              public aaLines: AntiAliasPref,
              public aaText: AntiAliasPref,
              public activeVolume: ClipVector,
              public hline?: HiddenLine.Params,
              public lights?: SceneLights,
              ) {}
  public static fromViewport(vp: Viewport): RenderPlan {
    const view = vp.view;
    const style = view.displayStyle;
    return new RenderPlan(view.is3d(),
                    style.viewFlags,
                    vp.getFrustum()!,
                    vp.frustFraction,
                    view.backgroundColor,
                    style.getMonochromeColor(),
                    vp.hilite,
                    vp.wantAntiAliasLines,
                    vp.wantAntiAliasText,
                    view.getViewClip(),
                    style.is3d() ? style.getHiddenLineParams() : undefined,
                    undefined); // view.is3d() ? view.getLights() : undefined
  }
}

/**
 * A RenderTarget holds the current scene, the current set of dynamic Graphics, and the current decorators.
 * When frames are composed, all of those Graphics are rendered, as appropriate.
 * A RenderTarget holds a reference to a Render::Device, and a Render::System
 * Every DgnViewport holds a reference to a RenderTarget.
 */
export abstract class RenderTarget {
  public readonly system: RenderSystem;
  public decorations = new Decorations();

  protected constructor(system: RenderSystem) {
    this.system = system;
  }

  public createGraphic(params: GraphicBuilderCreateParams) { return this.system.createGraphic(params); }
  public changeDecorations(decorations: Decorations) { this.decorations = decorations; }
}

/**
 * A RenderSystem is the renderer-specific factory for creating Render::Graphics, Render::Textures, and Render::Materials.
 * @note The methods of this class may be called from any thread.
 */
export interface RenderSystem {
  createTarget(tileSizeModifier: number): RenderTarget;
  createGraphic(params: GraphicBuilderCreateParams): GraphicBuilder;
  createBranch(branch: GraphicBranch, iModel: IModelConnection, transform: Transform, clips: ClipVector): Graphic;
  createGraphicList(primitives: Graphic[], iModel: IModelConnection): Graphic;
}

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
         RenderGraphic,
         Decorations,
         GraphicBranch } from "@bentley/imodeljs-common";
import { Viewport } from "../Viewport";
import { GraphicBuilder, GraphicBuilderCreateParams } from "./GraphicBuilder";
import { IModelConnection } from "../IModelConnection";

/**
 * A RenderPlan holds a Frustum and the render settings for displaying a Render::Scene into a Render::Target.
 */
export class RenderPlan {
  public readonly is3d: boolean;
  public readonly viewFlags: ViewFlags;
  public readonly frustum: Frustum;
  public readonly fraction: number;
  public readonly bgColor: ColorDef;
  public readonly monoColor: ColorDef;
  public readonly hiliteSettings: Hilite.Settings;
  public readonly aaLines: AntiAliasPref;
  public readonly aaText: AntiAliasPref;
  public readonly activeVolume: ClipVector;
  public readonly hline?: HiddenLine.Params;
  public readonly lights?: SceneLights;

  public constructor(vp: Viewport) {
    const view = vp.view;
    const style = view.displayStyle;

    this.is3d = view.is3d();
    this.viewFlags = style.viewFlags;
    this.frustum = vp.getFrustum()!;
    this.fraction = vp.frustFraction;
    this.bgColor = view.backgroundColor;
    this.monoColor = style.getMonochromeColor();
    this.hiliteSettings = vp.hilite;
    this.aaLines = vp.wantAntiAliasLines;
    this.aaText = vp.wantAntiAliasText;
    this.activeVolume = view.getViewClip();
    this.hline = style.is3d() ? style.getHiddenLineParams() : undefined;
    this.lights = undefined; // view.is3d() ? view.getLights() : undefined
  }
}

/**
 * A RenderTarget holds the current scene, the current set of dynamic RenderGraphics, and the current decorators.
 * When frames are composed, all of those RenderGraphics are rendered, as appropriate.
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
 * A RenderSystem is the renderer-specific factory for creating RenderGraphics, Render::Textures, and Render::Materials.
 * @note The methods of this class may be called from any thread.
 */
export interface RenderSystem {
  createTarget(tileSizeModifier: number): RenderTarget;
  createGraphic(params: GraphicBuilderCreateParams): GraphicBuilder;
  createBranch(branch: GraphicBranch, iModel: IModelConnection, transform: Transform, clips: ClipVector): RenderGraphic;
  createGraphicList(primitives: RenderGraphic[], iModel: IModelConnection): RenderGraphic;
}

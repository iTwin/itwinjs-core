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
import { GLESBranch, GLESList } from "./Graphic";
import { PrimitiveBuilder } from "./primitives/Geometry";
import { IModelConnection } from "../IModelConnection";

/**
 * A Render::Plan holds a Frustum and the render settings for displaying a Render::Scene into a Render::Target.
 */
export class Plan {
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
  public static fromViewport(vp: Viewport): Plan {
    const view = vp.view;
    const style = view.displayStyle;
    return new Plan(view.is3d(),
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
 * A Render::Target holds the current scene, the current set of dynamic Graphics, and the current decorators.
 * When frames are composed, all of those Graphics are rendered, as appropriate.
 * A Render::Target holds a reference to a Render::Device, and a Render::System
 * Every DgnViewport holds a reference to a Render::Target.
 */
export abstract class Target {
  constructor(public system: System,
              public decorations: Decorations = new Decorations()) {}
  public createGraphic(params: GraphicBuilderCreateParams) { return this.system.createGraphic(params); }
  public changeDecorations(decorations: Decorations): void { this.decorations = decorations; }
}

export class OnScreenTarget extends Target {
  constructor(public system: System, public tileSizeModifier: number = 1.0) { super(system); }
}

/**
 * A Render::System is the renderer-specific factory for creating Render::Graphics, Render::Textures, and Render::Materials.
 * @note The methods of this class may be called from any thread.
 */
export abstract class System {
  public nowPainting?: Target;
  public abstract createTarget(tileSizeModifier: number): Target;
  public abstract createGraphic(params: GraphicBuilderCreateParams): GraphicBuilder;
  public abstract createBranch(branch: GraphicBranch, iModel: IModelConnection, transform: Transform, clips: ClipVector): Graphic;
  public abstract createGraphicList(primitives: Graphic[], iModel: IModelConnection): Graphic;
}

export class RenderSystem extends System {
  public createGraphic(params: GraphicBuilderCreateParams): GraphicBuilder { return new PrimitiveBuilder(this, params); }
  public createTarget(tileSizeModifier: number): Target { return new OnScreenTarget(this, tileSizeModifier); }
  public createBranch(branch: GraphicBranch, imodel: IModelConnection, transform: Transform, clips: ClipVector): Graphic { return new GLESBranch(imodel, branch, transform, clips); }
  public createGraphicList(graphics: Graphic[], iModel: IModelConnection): Graphic { return new GLESList(graphics, iModel); }
}

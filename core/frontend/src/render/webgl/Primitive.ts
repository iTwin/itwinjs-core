/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { FeatureIndexType } from "@bentley/imodeljs-common";
import { Target } from "./Target";
import { Graphic, Batch } from "./Graphic";
import { CachedGeometry } from "./CachedGeometry";
import { RenderPass, RenderOrder } from "./RenderFlags";
import { ShaderProgramExecutor } from "./ShaderProgram";
import { DrawParams } from "./DrawCommand";
import { TechniqueId } from "./TechniqueId";
import { FeaturesInfo } from "./FeaturesInfo";
import { RenderCommands, DrawCommand } from "./DrawCommand";
import { dispose } from "@bentley/bentleyjs-core";
import { System } from "./System";

export abstract class Primitive extends Graphic {
  public cachedGeometry: CachedGeometry;
  public isPixelMode: boolean = false;

  public constructor(cachedGeom: CachedGeometry) { super(); this.cachedGeometry = cachedGeom; }

  public dispose() {
    dispose(this.cachedGeometry);
  }

  public getRenderPass(target: Target) {
    if (this.isPixelMode)
      return RenderPass.ViewOverlay;
    return this.cachedGeometry.getRenderPass(target);
  }

  public get featureIndexType(): FeatureIndexType {
    const feature = this.cachedGeometry.featuresInfo;
    if (feature instanceof FeaturesInfo)
      return feature.type;
    return FeatureIndexType.Empty;
  }

  public get usesMaterialColor(): boolean {
    const materialData = this.cachedGeometry.material;
    return undefined !== materialData && (materialData.overridesRgb || materialData.overridesAlpha);
  }

  public get isLit(): boolean { return this.cachedGeometry.isLitSurface; }

  public get hasAnimation(): boolean { return this.cachedGeometry.hasAnimation; }

  public addCommands(commands: RenderCommands): void { commands.addPrimitive(this); }

  public addHiliteCommands(commands: RenderCommands, batch: Batch, pass: RenderPass): void {
    // Edges do not contribute to hilite pass.
    // Note that IsEdge() does not imply geom->ToEdge() => true...polylines can be edges too...
    if (!this.isEdge) {
      commands.getCommands(pass).push(DrawCommand.createForPrimitive(this, batch));
    }
  }

  public setUniformFeatureIndices(featId: number): void { this.cachedGeometry.uniformFeatureIndices = featId; }

  public get isEdge(): boolean { return false; }

  public toPrimitive(): Primitive { return this; }

  public abstract get renderOrder(): RenderOrder;

  private static _drawParams?: DrawParams;

  public draw(shader: ShaderProgramExecutor): void {
    // ###TODO: local to world should be pushed before we're invoked...we shouldn't need to pass (or copy) it
    if (undefined === Primitive._drawParams)
      Primitive._drawParams = new DrawParams();

    const drawParams = Primitive._drawParams!;
    drawParams.init(shader.params, this.cachedGeometry, shader.target.currentTransform, shader.renderPass);
    shader.draw(drawParams);
  }

  public getTechniqueId(target: Target): TechniqueId { return this.cachedGeometry.getTechniqueId(target); }

  public get debugString(): string { return this.cachedGeometry.debugString; }
}

export class SkyBoxPrimitive extends Primitive {
  public constructor(cachedGeom: CachedGeometry) { super(cachedGeom); }

  public draw(shader: ShaderProgramExecutor): void {
    // Alter viewport to maintain square aspect ratio of skybox images even as viewRect resizes
    const vh = shader.target.viewRect.height;
    const vw = shader.target.viewRect.width;
    if (vw > vh)
      System.instance.context.viewport(0, -(vw - vh) / 2, vw, vw);
    else
      System.instance.context.viewport(-(vh - vw) / 2, 0, vh, vh);

    super.draw(shader); // Draw the skybox cubemap

    System.instance.context.viewport(0, 0, vw, vh); // Restore viewport
  }

  public get renderOrder(): RenderOrder { return RenderOrder.Surface; }
}

export class SkySpherePrimitive extends Primitive {
  public constructor(cachedGeom: CachedGeometry) { super(cachedGeom); }
  public get renderOrder(): RenderOrder { return RenderOrder.Surface; }
}

export class PointCloudPrimitive extends Primitive {
  public constructor(cachedGeom: CachedGeometry) { super(cachedGeom); }
  public get renderOrder(): RenderOrder { return RenderOrder.Surface; }
}

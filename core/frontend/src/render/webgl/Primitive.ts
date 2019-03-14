/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { FeatureIndexType } from "@bentley/imodeljs-common";
import { Target } from "./Target";
import { Graphic, Batch } from "./Graphic";
import { CachedGeometry, LUTGeometry } from "./CachedGeometry";
import { RenderPass, RenderOrder } from "./RenderFlags";
import { ShaderProgramExecutor } from "./ShaderProgram";
import { DrawParams, RenderCommands, DrawCommand } from "./DrawCommand";
import { TechniqueId } from "./TechniqueId";
import { assert, dispose } from "@bentley/bentleyjs-core";
import { System } from "./System";
import { InstancedGraphicParams, RenderMemory } from "../System";
import { InstancedGeometry, InstanceBuffers } from "./InstancedGeometry";

export class Primitive extends Graphic {
  public cachedGeometry: CachedGeometry;
  public isPixelMode: boolean = false;

  protected constructor(cachedGeom: CachedGeometry) { super(); this.cachedGeometry = cachedGeom; }

  public static create(createGeom: () => CachedGeometry | undefined, instances?: InstancedGraphicParams): Primitive | undefined {
    const instanceBuffers = undefined !== instances ? InstanceBuffers.create(instances, false) : undefined;
    if (undefined === instanceBuffers && undefined !== instances)
      return undefined;

    return this.createShared(createGeom, instanceBuffers);
  }

  public static createShared(createGeom: () => CachedGeometry | undefined, instances?: InstanceBuffers): Primitive | undefined {
    let geom = createGeom();
    if (undefined === geom)
      return undefined;

    if (undefined !== instances) {
      assert(geom instanceof LUTGeometry, "Invalid geometry type for instancing");
      geom = new InstancedGeometry(geom as LUTGeometry, true, instances);
    }

    return undefined !== geom ? new this(geom) : undefined;
  }

  public dispose() {
    dispose(this.cachedGeometry);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    this.cachedGeometry.collectStatistics(stats);
  }

  public getRenderPass(target: Target) {
    if (this.isPixelMode)
      return RenderPass.ViewOverlay;
    return this.cachedGeometry.getRenderPass(target);
  }

  public get featureIndexType(): FeatureIndexType {
    const feature = this.cachedGeometry.featuresInfo;
    return undefined !== feature ? feature.type : FeatureIndexType.Empty;
  }

  public get usesMaterialColor(): boolean {
    const materialData = this.cachedGeometry.material;
    return undefined !== materialData && (materialData.overridesRgb || materialData.overridesAlpha);
  }

  public addCommands(commands: RenderCommands): void { commands.addPrimitive(this); }

  public addHiliteCommands(commands: RenderCommands, batch: Batch, pass: RenderPass): void {
    // Edges do not contribute to hilite pass.
    // Note that IsEdge() does not imply geom->ToEdge() => true...polylines can be edges too...
    if (!this.isEdge) {
      commands.getCommands(pass).push(DrawCommand.createForPrimitive(this, batch));
    }
  }

  public setUniformFeatureIndices(featId: number): void { this.cachedGeometry.uniformFeatureIndices = featId; }
  public get hasAnimation(): boolean { return this.cachedGeometry.hasAnimation; }
  public get isInstanced(): boolean { return this.cachedGeometry.isInstanced; }
  public get isLit(): boolean { return this.cachedGeometry.isLitSurface; }
  public get isEdge(): boolean { return this.cachedGeometry.isEdge; }
  public get renderOrder(): RenderOrder { return this.cachedGeometry.renderOrder; }

  public toPrimitive(): Primitive { return this; }

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
}

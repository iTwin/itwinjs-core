/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { Point3d } from "@itwin/core-geometry";
import { CustomGraphicBuilderOptions, GraphicTemplate, PrimitiveBuilder, RenderGraphic, ViewportGraphicBuilderOptions } from "@itwin/core-frontend";
import { System } from "./System";
import { CesiumGeometryData } from "./CesiumGeometryData";

export class CesiumPrimitiveBuilder extends PrimitiveBuilder {
  private _originalPointStrings: Point3d[][] = [];

  public constructor(system: System, options: ViewportGraphicBuilderOptions | CustomGraphicBuilderOptions) {
    super(system, options);
  }

  public override addPointString(points: Point3d[]): void {
    this._originalPointStrings.push([...points]);
    super.addPointString(points);
  }

  public override finish(): RenderGraphic {
    if (this._originalPointStrings.length > 0) {
      const templateId = Symbol.for(`cesium_template_${Date.now()}_${Math.random()}`);
      CesiumGeometryData.storePointStrings(templateId, this._originalPointStrings);
      (this as any)._cesiumTemplateId = templateId;
    }
    // convert coordinates
    const template = this.finishTemplate();
    
    if ((this as any)._cesiumTemplateId) {
      (template as any)._cesiumTemplateId = (this as any)._cesiumTemplateId;
    }
    
    const graphic = this.system.createGraphicFromTemplate({ template });
    return graphic ?? this.system.createGraphicList([]);
  }

  public override finishTemplate(): GraphicTemplate {
    const template = super.finishTemplate();
    
    if (this._originalPointStrings.length > 0) {
      const templateId = Symbol.for(`cesium_template_${Date.now()}_${Math.random()}`);
      CesiumGeometryData.storePointStrings(templateId, this._originalPointStrings);
      (template as any)._cesiumTemplateId = templateId;
    }
    
    return template;
  }

  public getOriginalPointStrings(): Point3d[][] {
    return this._originalPointStrings;
  }

  public clearOriginalData(): void {
    this._originalPointStrings = [];
  }
}
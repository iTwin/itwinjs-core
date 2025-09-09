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
import { CoordinateStorage } from "./CoordinateStorage";

/** Generic coordinate builder for capturing geometry coordinates */
export class CoordinateBuilder extends PrimitiveBuilder {
  private _coordinateData: any[] = [];

  public constructor(system: System, options: ViewportGraphicBuilderOptions | CustomGraphicBuilderOptions) {
    super(system, options);
  }

  public override addPointString(points: Point3d[]): void {
    this._coordinateData.push({ type: 'point-string', data: [...points] });
    super.addPointString(points);
  }

  public override finish(): RenderGraphic {
    if (this._coordinateData.length > 0) {
      const templateId = Symbol.for(`coordinate_template_${Date.now()}_${Math.random()}`);
      CoordinateStorage.storeCoordinates(templateId, this._coordinateData);
      (this as any)._coordinateTemplateId = templateId;
    }
    
    const template = this.finishTemplate();
    
    if ((this as any)._coordinateTemplateId) {
      (template as any)._coordinateTemplateId = (this as any)._coordinateTemplateId;
    }
    
    const graphic = this.system.createGraphicFromTemplate({ template });
    return graphic ?? this.system.createGraphicList([]);
  }

  public override finishTemplate(): GraphicTemplate {
    const template = super.finishTemplate();
    
    if (this._coordinateData.length > 0) {
      const templateId = Symbol.for(`coordinate_template_${Date.now()}_${Math.random()}`);
      CoordinateStorage.storeCoordinates(templateId, this._coordinateData);
      (template as any)._coordinateTemplateId = templateId;
    }
    
    return template;
  }

  public getCoordinateData(): any[] {
    return this._coordinateData;
  }

  public clearCoordinateData(): void {
    this._coordinateData = [];
  }
}
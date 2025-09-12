/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { Arc3d, Path, Point3d } from "@itwin/core-geometry";
import { CustomGraphicBuilderOptions, GraphicPrimitive, GraphicTemplate, PrimitiveBuilder, RenderGraphic, ViewportGraphicBuilderOptions } from "@itwin/core-frontend";
import { System } from "./System";
import { CoordinateStorage } from "./CoordinateStorage";

/** Generic coordinate builder for capturing geometry coordinates */
export class CoordinateBuilder extends PrimitiveBuilder {
  private _coordinateData: GraphicPrimitive[] = [];

  public constructor(system: System, options: ViewportGraphicBuilderOptions | CustomGraphicBuilderOptions) {
    super(system, options);
  }

  public override addPointString(points: Point3d[]): void {
    this._coordinateData.push({ type: 'pointstring', points: [...points] });
    super.addPointString(points);
  }

  public override addLineString(points: Point3d[]): void {
    this._coordinateData.push({ type: 'linestring', points: [...points] });
    super.addLineString(points);
  }

  public override addShape(points: Point3d[]): void {
    this._coordinateData.push({ type: 'shape', points: [...points] });
    super.addShape(points);
  }

  public override addArc(arc: Arc3d, isEllipse: boolean, filled: boolean): void {
    this._coordinateData.push({ type: 'arc', arc: arc.clone(), isEllipse, filled });
    super.addArc(arc, isEllipse, filled);
  }

  public override addPath(path: Path): void {
    this._coordinateData.push({ type: 'path', path: path.clone() });
    super.addPath(path);
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

  public getCoordinateData(): GraphicPrimitive[] {
    return this._coordinateData;
  }

  public clearCoordinateData(): void {
    this._coordinateData = [];
  }
}
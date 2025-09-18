/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { Arc3d, Loop, Path, Point3d, Polyface, SolidPrimitive } from "@itwin/core-geometry";
import { CustomGraphicBuilderOptions, GraphicBuilder, GraphicPrimitive, GraphicTemplate, RenderGraphic, ViewportGraphicBuilderOptions, _implementationProhibited } from "@itwin/core-frontend";
import { ColorDef, LinePixels } from "@itwin/core-common";
import { System } from "../System.js";
import { CoordinateStorage } from "./CoordinateStorage.js";

/** Generic coordinate builder for capturing geometry coordinates */
export class CoordinateBuilder extends GraphicBuilder {
  public override readonly [_implementationProhibited] = undefined;
  private _coordinateData: GraphicPrimitive[] = [];
  private _currentLineColor?: ColorDef;
  private _currentFillColor?: ColorDef;
  private _currentWidth?: number;
  private _currentLinePixels?: LinePixels;
  private _system: System;

  public constructor(system: System, options: ViewportGraphicBuilderOptions | CustomGraphicBuilderOptions) {
    super(options);
    this._system = system;
  }

  public get system(): System {
    return this._system;
  }

  public override resolveGradient(_gradient: any): any {
    // No-op for coordinate builder
    return undefined;
  }

  public override setSymbology(lineColor: ColorDef, fillColor: ColorDef, width?: number, linePixels?: LinePixels): void {
    this._currentLineColor = lineColor;
    this._currentFillColor = fillColor;
    this._currentWidth = width;
    this._currentLinePixels = linePixels;
    super.setSymbology(lineColor, fillColor, width ?? 0, linePixels);
  }

  public override addPointString(points: Point3d[]): void {
    this._coordinateData.push({ type: 'pointstring', points: [...points], symbology: this.snapshotSymbology() } as any);
    super.addPointString(points);
  }

  public override addLineString(points: Point3d[]): void {
    this._coordinateData.push({ type: 'linestring', points: [...points], symbology: this.snapshotSymbology() } as any);
    super.addLineString(points);
  }

  public override addShape(points: Point3d[]): void {
    this._coordinateData.push({ type: 'shape', points: [...points], symbology: this.snapshotSymbology() } as any);
    super.addShape(points);
  }

  public override addArc(arc: Arc3d, isEllipse: boolean, filled: boolean): void {
    this._coordinateData.push({ type: 'arc', arc: arc.clone(), isEllipse, filled, symbology: this.snapshotSymbology() } as any);
    super.addArc(arc, isEllipse, filled);
  }

  public override addPath(path: Path): void {
    this._coordinateData.push({ type: 'path', path, symbology: this.snapshotSymbology() } as any);
    super.addPath(path);
  }

  public override addLoop(loop: Loop): void {
    this._coordinateData.push({ type: 'loop', loop, symbology: this.snapshotSymbology() } as any);
    super.addLoop(loop);
  }

  public override addPolyface(polyface: Polyface, filled: boolean): void {
    this._coordinateData.push({ type: 'polyface', polyface, filled, symbology: this.snapshotSymbology() } as any);
    super.addPolyface(polyface, filled);
  }

  public override addSolidPrimitive(solidPrimitive: SolidPrimitive): void {
    this._coordinateData.push({ type: 'solidPrimitive', solidPrimitive, symbology: this.snapshotSymbology() } as any);
    super.addSolidPrimitive(solidPrimitive);
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
    const template = {} as GraphicTemplate;
    
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

  private snapshotSymbology(): { lineColor?: ColorDef; fillColor?: ColorDef; width?: number; linePixels?: LinePixels } {
    return {
      lineColor: this._currentLineColor,
      fillColor: this._currentFillColor,
      width: this._currentWidth,
      linePixels: this._currentLinePixels,
    };
  }
}

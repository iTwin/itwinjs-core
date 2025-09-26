/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Arc3d, Loop, Path, Point2d, Point3d, Polyface, SolidPrimitive } from "@itwin/core-geometry";
import { _implementationProhibited, CustomGraphicBuilderOptions, GraphicBuilder, GraphicTemplate, RenderGraphic, ViewportGraphicBuilderOptions } from "@itwin/core-frontend";
import { ColorDef, LinePixels } from "@itwin/core-common";
import { CesiumSystem } from "../System.js";
import { CoordinateStorage } from "./CoordinateStorage.js";
import { DecorationPrimitiveEntry, SymbologySnapshot } from "./DecorationTypes.js";

/** Generic coordinate builder for capturing geometry coordinates */
export class CoordinateBuilder extends GraphicBuilder {
  public override readonly [_implementationProhibited] = undefined;
  private _coordinateData: DecorationPrimitiveEntry[] = [];
  private _currentLineColor?: ColorDef;
  private _currentFillColor?: ColorDef;
  private _currentWidth?: number;
  private _currentLinePixels?: LinePixels;
  private _system: CesiumSystem;
  private _pendingTemplateId?: symbol;

  public constructor(system: CesiumSystem, options: ViewportGraphicBuilderOptions | CustomGraphicBuilderOptions) {
    super(options);
    this._system = system;
  }

  public get system(): CesiumSystem {
    return this._system;
  }

  public override resolveGradient(_gradient: unknown): undefined {
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
    this._coordinateData.push({ type: 'pointstring', points: [...points], symbology: this.snapshotSymbology() });
    super.addPointString(points);
  }

  public override addPointString2d(points: Point2d[], zDepth: number): void {
    this._coordinateData.push({ type: 'pointstring2d', points: points.map((pt) => Point2d.create(pt.x, pt.y)), zDepth, symbology: this.snapshotSymbology() });
    super.addPointString2d(points, zDepth);
  }

  public override addLineString(points: Point3d[]): void {
    this._coordinateData.push({ type: 'linestring', points: [...points], symbology: this.snapshotSymbology() });
    super.addLineString(points);
  }

  public override addLineString2d(points: Point2d[], zDepth: number): void {
    this._coordinateData.push({ type: 'linestring2d', points: points.map((pt) => Point2d.create(pt.x, pt.y)), zDepth, symbology: this.snapshotSymbology() });
    super.addLineString2d(points, zDepth);
  }

  public override addShape(points: Point3d[]): void {
    this._coordinateData.push({ type: 'shape', points: [...points], symbology: this.snapshotSymbology() });
    super.addShape(points);
  }

  public override addShape2d(points: Point2d[], zDepth: number): void {
    this._coordinateData.push({ type: 'shape2d', points: points.map((pt) => Point2d.create(pt.x, pt.y)), zDepth, symbology: this.snapshotSymbology() });
    super.addShape2d(points, zDepth);
  }

  public override addArc(arc: Arc3d, isEllipse: boolean, filled: boolean): void {
    this._coordinateData.push({ type: 'arc', arc: arc.clone(), isEllipse, filled, symbology: this.snapshotSymbology() });
    super.addArc(arc, isEllipse, filled);
  }

  public override addArc2d(arc: Arc3d, isEllipse: boolean, filled: boolean, zDepth: number): void {
    const arcClone = arc.clone();
    if (arcClone.center.z !== zDepth)
      arcClone.center.z = zDepth;
    this._coordinateData.push({ type: 'arc2d', arc: arcClone, isEllipse, filled, zDepth, symbology: this.snapshotSymbology() });
    super.addArc2d(arc, isEllipse, filled, zDepth);
  }

  public override addPath(path: Path): void {
    this._coordinateData.push({ type: 'path', path, symbology: this.snapshotSymbology() });
    super.addPath(path);
  }

  public override addLoop(loop: Loop): void {
    this._coordinateData.push({ type: 'loop', loop, symbology: this.snapshotSymbology() });
    super.addLoop(loop);
  }

  public override addPolyface(polyface: Polyface, filled: boolean): void {
    this._coordinateData.push({ type: 'polyface', polyface, filled, symbology: this.snapshotSymbology() });
    super.addPolyface(polyface, filled);
  }

  public override addSolidPrimitive(solidPrimitive: SolidPrimitive): void {
    this._coordinateData.push({ type: 'solidPrimitive', solidPrimitive, symbology: this.snapshotSymbology() });
    super.addSolidPrimitive(solidPrimitive);
  }

  public override finish(): RenderGraphic {
    if (this._coordinateData.length > 0) {
      const templateId = Symbol.for(`coordinate_template_${Date.now()}_${Math.random()}`);
      CoordinateStorage.storeCoordinates(templateId, this._coordinateData);
      this._pendingTemplateId = templateId;
    }

    const template = this.finishTemplate();

    if (this._pendingTemplateId) {
      Reflect.set(template as object, "_coordinateTemplateId", this._pendingTemplateId);
    }

    const graphic = this.system.createGraphicFromTemplate({ template });
    return graphic ?? this.system.createGraphicList([]);
  }

  public override finishTemplate(): GraphicTemplate {
    const template = {} as GraphicTemplate;

    if (this._coordinateData.length > 0) {
      const templateId = Symbol.for(`coordinate_template_${Date.now()}_${Math.random()}`);
      CoordinateStorage.storeCoordinates(templateId, this._coordinateData);
      Reflect.set(template as object, "_coordinateTemplateId", templateId);
    }

    return template;
  }

  public getCoordinateData(): DecorationPrimitiveEntry[] {
    return this._coordinateData;
  }

  public clearCoordinateData(): void {
    this._coordinateData = [];
  }

  private snapshotSymbology(): SymbologySnapshot {
    return {
      lineColor: this._currentLineColor,
      fillColor: this._currentFillColor,
      width: this._currentWidth,
      linePixels: this._currentLinePixels,
    };
  }
}

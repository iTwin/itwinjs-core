/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { Decorations, GraphicList, IModelConnection, RenderGraphic } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { Cartesian3, Color } from "cesium";
import { ColorDef } from "@itwin/core-common";
import { CesiumScene } from "../CesiumScene.js";
import { PrimitiveConverterFactory } from "./PrimitiveConverterFactory.js";
import { CesiumCoordinateConverter } from "./CesiumCoordinateConverter.js";
import type { DecorationPrimitiveEntry } from "./DecorationTypes.js";

export interface DecorationGeometryCoordinate {
  x: number;
  y: number;
  z: number;
}

export interface DecorationGeometry {
  coordinateData?: DecorationGeometryCoordinate[];
}

export interface RenderGraphicWithCoordinates extends RenderGraphic {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  _coordinateData?: DecorationPrimitiveEntry[];
  geometries?: DecorationGeometry[];
  geometryType?: string;
}

/** Base class for converting iTwin.js decorations to Cesium primitives */
export abstract class PrimitiveConverter<TPrimitiveData = DecorationPrimitiveEntry[]> {
  // Geometry type handled by this converter
  protected abstract readonly primitiveType: DecorationPrimitiveEntry["type"];

  // Unified convert method that uses the subclass primitiveType
  public convertDecorations(graphics: GraphicList, type: string, scene: CesiumScene, iModel?: IModelConnection): void {
    this.convertDecorationsTemplate(graphics, type, scene, this.primitiveType, iModel);
  }

  /** Convert Point3d array to Cartesian3 array for all geometry types */
  protected convertPointsToCartesian3(points: Point3d[], iModel?: IModelConnection): Cartesian3[] {
    if (!points || points.length === 0) return [];

    if ((this.primitiveType === 'pointstring' || this.primitiveType === 'pointstring2d') && points.length > 1) {
      points = [points[0]];
    }

    if (iModel) {
      const converter = new CesiumCoordinateConverter(iModel);
      return points.map(point => converter.spatialToCesiumCartesian3(point));
    } else {
      return points.map(point => new Cartesian3(point.x, point.y, point.z));
    }
  }

  protected getDepthOptions(decorationType: string): Record<string, unknown> {
    const isOverlay = decorationType === 'worldOverlay' || decorationType === 'viewOverlay';
    if (!isOverlay) {
      return {};
    }

    return {};
  }

  /** Generic method to extract primitive data by type. Subclasses may override for specialized needs. */
  protected extractPrimitiveData(coordinateData: DecorationPrimitiveEntry[] | undefined, primitiveType: string): TPrimitiveData | undefined {
    if (!coordinateData || !Array.isArray(coordinateData))
      return undefined;
    const filtered = coordinateData.filter((entry) => entry.type === primitiveType);
    return filtered as unknown as TPrimitiveData;
  }

  /** Template method for convertDecorations - defines the algorithm structure */
  protected convertDecorationsTemplate(
    graphics: GraphicList,
    type: string,
    scene: CesiumScene,
    primitiveType: string,
    iModel?: IModelConnection
  ): void {
    if (!graphics || graphics.length === 0) return;

    const collection = this.getCollection(scene);
    if (!collection) return;

    const filteredGraphics = this.filterGraphics(graphics, primitiveType);

    if (this.shouldSkipEmptyGraphics() && filteredGraphics.length === 0) {
      return;
    }

    filteredGraphics.forEach((graphic, index) => {
      const primitiveId = `${type}_${this.getPrimitiveTypeName()}_${index}`;
      const graphicWithCoords = graphic as RenderGraphicWithCoordinates;
      const coordinateData = graphicWithCoords._coordinateData;
      const originalData = this.extractPrimitiveData(coordinateData, primitiveType);

      const result = this.createPrimitiveFromGraphic(graphicWithCoords, primitiveId, index, collection, iModel, originalData, type);

      if (result && typeof result === 'object' && (result as { constructor?: { name?: string } }).constructor?.name === 'Primitive') {
        const add = (collection as unknown as { add: (arg: unknown) => unknown }).add;
        if (typeof add === 'function')
          add.call(collection, result);
      }
    });
  }

  /** Default filterGraphics implementation - can be overridden by subclasses if needed */
  protected filterGraphics(graphics: GraphicList, primitiveType: string): GraphicList {
    return graphics.filter(graphic => {
      const graphicWithCoords = graphic as RenderGraphicWithCoordinates;
      const coordinateData = graphicWithCoords._coordinateData;
      const hasPrimitiveData = !!(coordinateData && coordinateData.some((entry: DecorationPrimitiveEntry) => entry.type === primitiveType));
      const geometryType = graphicWithCoords.geometryType;

      return hasPrimitiveData || geometryType === primitiveType;
    });
  }

  /** Abstract methods that must be implemented by subclasses */
  protected abstract getCollection(scene: CesiumScene): unknown;
  protected abstract createPrimitiveFromGraphic(
    graphic: RenderGraphicWithCoordinates,
    primitiveId: string,
    index: number,
    collection: unknown,
    iModel?: IModelConnection,
    originalData?: TPrimitiveData,
    type?: string
  ): unknown;
  // Default primitive type name for IDs; subclasses can override for custom naming
  protected getPrimitiveTypeName(): string {
    return this.primitiveType;
  }

  /** Hook method - can be overridden by subclasses */
  protected shouldSkipEmptyGraphics(): boolean {
    return false;
  }


  /** Convert all decoration types using switch-based auto dispatch */
  public convertAllDecorationTypes(decorations: Decorations, scene: CesiumScene, iModel?: IModelConnection): void {
    if (decorations.world) {
      this.autoDispatchGraphics(decorations.world, 'world', scene, iModel);
    }

    if (decorations.normal) {
      this.autoDispatchGraphics(decorations.normal, 'normal', scene, iModel);
    }

    if (decorations.worldOverlay) {
      this.autoDispatchGraphics(decorations.worldOverlay, 'worldOverlay', scene, iModel);
    }

    if (decorations.viewOverlay) {
      this.autoDispatchGraphics(decorations.viewOverlay, 'viewOverlay', scene, iModel);
    }

    if (decorations.viewBackground) {
      this.autoDispatchGraphics([decorations.viewBackground], 'viewBackground', scene, iModel);
    }
  }

  private autoDispatchGraphics(graphics: GraphicList, type: string, scene: CesiumScene, iModel?: IModelConnection): void {
    graphics.forEach((graphic) => {
      const graphicWithCoords = graphic as RenderGraphicWithCoordinates;
      const coordinateData = graphicWithCoords._coordinateData;

      if (coordinateData && Array.isArray(coordinateData)) {
        const data = coordinateData;
        data.forEach((primitive) => {
          const converter = PrimitiveConverterFactory.getConverter(primitive.type);
          if (converter)
            converter.convertDecorations([graphic], type, scene, iModel);
        });
      }
    });
  }

  /** Unified clear decorations - removes all decoration primitives from scene */
  public clearDecorations(scene: CesiumScene): void {
    // Clear all point primitives
    const pointCollection = scene.pointCollection;
    if (pointCollection) {
      const pointsToRemove: unknown[] = [];
      for (let i = 0; i < pointCollection.length; i++) {
        const point = pointCollection.get(i);
        const hasId = (p: unknown): p is { id?: unknown } => typeof p === 'object' && p !== null && 'id' in (p);
        if (hasId(point) && typeof point.id === 'string' && this.isAnyDecorationId(point.id))
          pointsToRemove.push(point);
      }
      pointsToRemove.forEach(point => pointCollection.remove(point as import('cesium').PointPrimitive));
    }

    // Clear all line primitives
    const polylineCollection = scene.polylineCollection;
    if (polylineCollection) {
      const linesToRemove: unknown[] = [];
      for (let i = 0; i < polylineCollection.length; i++) {
        const line = polylineCollection.get(i);
        const hasId = (l: unknown): l is { id?: unknown } => typeof l === 'object' && l !== null && 'id' in (l);
        if (hasId(line) && typeof line.id === 'string' && this.isAnyDecorationId(line.id))
          linesToRemove.push(line);
      }
      linesToRemove.forEach(line => polylineCollection.remove(line as import('cesium').Polyline));
    }
  }

  /** Check if an ID is any type of decoration */
  private isAnyDecorationId(id: string): boolean {
    // Matches: <type>_(pointstring|linestring|shape)_<index>
    return /^(world|normal|worldOverlay|viewOverlay|viewBackground)_(pointstring(?:2d)?|linestring(?:2d)?|shape(?:2d)?)_/i.test(id);
  }

  // Shared helpers to reduce duplication in converters

  protected getCoordData(graphic?: RenderGraphicWithCoordinates): DecorationPrimitiveEntry[] | undefined {
    return graphic?._coordinateData;
  }

  protected colorFromColorDef(cd?: ColorDef): Color | undefined {
    if (!cd) return undefined;
    const c = cd.colors;
    const alpha = 255 - (c.t ?? 0);
    return Color.fromBytes(c.r, c.g, c.b, alpha);
  }

  protected getGraphicSymbology(graphic?: RenderGraphicWithCoordinates): { color?: ColorDef; fillColor?: ColorDef } | undefined {
    interface HasSymbology { symbology?: { color?: ColorDef; fillColor?: ColorDef } }
    const hasSymbology = (g: unknown): g is HasSymbology => typeof g === 'object' && g !== null && ('symbology' in g);
    return hasSymbology(graphic) ? graphic.symbology : undefined;
  }

  protected findEntryByType<K extends DecorationPrimitiveEntry["type"]>(graphic: RenderGraphicWithCoordinates | undefined, type: K): Extract<DecorationPrimitiveEntry, { type: K }> | undefined {
    const data = this.getCoordData(graphic);
    const isType = (e: DecorationPrimitiveEntry): e is Extract<DecorationPrimitiveEntry, { type: K }> => e.type === type;
    return data?.find((e): e is Extract<DecorationPrimitiveEntry, { type: K }> => isType(e));
  }

  protected extractLineColorFromGraphic<K extends DecorationPrimitiveEntry["type"]>(graphic: RenderGraphicWithCoordinates | undefined, type: K): Color | undefined {
    const entry = this.findEntryByType(graphic, type);
    const fromEntry = this.colorFromColorDef(entry?.symbology?.lineColor);
    if (fromEntry) return fromEntry;
    const sym = this.getGraphicSymbology(graphic);
    return this.colorFromColorDef(sym?.color);
  }

  protected extractFillOrLineColorFromGraphic(graphic: RenderGraphicWithCoordinates | undefined, type: 'shape' | 'shape2d'): Color | undefined {
    const entry = this.findEntryByType(graphic, type);
    const fill = this.colorFromColorDef(entry?.symbology?.fillColor) ?? this.colorFromColorDef(entry?.symbology?.lineColor);
    if (fill) return fill;
    const sym = this.getGraphicSymbology(graphic);
    return this.colorFromColorDef(sym?.fillColor ?? sym?.color);
  }

  protected extractFillAndLineColorsFromGraphic<K extends DecorationPrimitiveEntry["type"]>(graphic: RenderGraphicWithCoordinates | undefined, type: K): { fillColor: Color; lineColor: Color; outlineWanted: boolean } | undefined {
    const entry = this.findEntryByType(graphic, type);
    const line = this.colorFromColorDef(entry?.symbology?.lineColor);
    const fill = this.colorFromColorDef(entry?.symbology?.fillColor);
    if (line && fill) {
      return { fillColor: fill, lineColor: line, outlineWanted: !Color.equals(line, fill) };
    }
    const sym = this.getGraphicSymbology(graphic);
    const line2 = this.colorFromColorDef(sym?.color);
    const fill2 = this.colorFromColorDef(sym?.fillColor ?? sym?.color);
    if (!line2 || !fill2) return undefined;
    return { fillColor: fill2, lineColor: line2, outlineWanted: !Color.equals(line2, fill2) };
  }
}

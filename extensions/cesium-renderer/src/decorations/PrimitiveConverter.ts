/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Decorations, GraphicList, IModelConnection, RenderGeometry, RenderGraphic } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import {
  Cartesian3,
  Color,
  type DistanceDisplayCondition,
  type PointPrimitive,
  PointPrimitiveCollection,
  type Polyline,
  PolylineCollection,
  Primitive,
  PrimitiveCollection,
} from "@cesium/engine";
import { ColorDef } from "@itwin/core-common";
import { CesiumScene } from "../CesiumScene.js";
import { PrimitiveConverterFactory } from "./PrimitiveConverterFactory.js";
import { CesiumCoordinateConverter } from "./CesiumCoordinateConverter.js";
import type { DecorationPrimitiveEntry } from "./DecorationTypes.js";

export interface RenderGraphicWithCoordinates extends RenderGraphic {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  _coordinateData?: DecorationPrimitiveEntry[];
  geometries?: RenderGeometry[];
  geometryType?: string;
  symbology?: { color?: ColorDef; fillColor?: ColorDef };
}

export type DepthOptions = Partial<{
  disableDepthTestDistance: number;
  clampToGround: boolean;
  distanceDisplayCondition: DistanceDisplayCondition | undefined;
  heightReference: number;
  extrudedHeightReference: number;
}>;

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

  protected getDepthOptions(decorationType: string): DepthOptions {
    const isOverlay = decorationType === 'worldOverlay' || decorationType === 'viewOverlay';
    if (!isOverlay) {
      return {};
    }

    return {};
  }

  /** Generic method to extract primitive data by type. Subclasses may override for specialized needs. */
  protected extractPrimitiveData(coordinateData: DecorationPrimitiveEntry[], primitiveType: string): TPrimitiveData | undefined {
    if (!Array.isArray(coordinateData))
      return undefined;
    const filtered = coordinateData.filter((entry) => entry.type === primitiveType);
    return filtered as TPrimitiveData;
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
      const originalData = coordinateData ? this.extractPrimitiveData(coordinateData, primitiveType) : undefined;

      const result = this.createPrimitiveFromGraphic(graphicWithCoords, primitiveId, index, collection, iModel, originalData, type);

      if (result && this.isPrimitiveResult(result) && this.isPrimitiveCollection(collection))
        collection.add(result);
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
  protected abstract getCollection(scene: CesiumScene): PointPrimitiveCollection | PolylineCollection | PrimitiveCollection | undefined;
  protected abstract createPrimitiveFromGraphic(
    graphic: RenderGraphicWithCoordinates,
    primitiveId: string,
    index: number,
    collection: PointPrimitiveCollection | PolylineCollection | PrimitiveCollection,
    iModel?: IModelConnection,
    originalData?: TPrimitiveData,
    type?: string
  ): Primitive | Polyline | PointPrimitive | void;
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
      const pointsToRemove: PointPrimitive[] = [];
      for (let i = 0; i < pointCollection.length; i++) {
        const point = pointCollection.get(i);
        if (typeof point?.id === 'string' && this.isAnyDecorationId(point.id))
          pointsToRemove.push(point);
      }
      pointsToRemove.forEach(point => pointCollection.remove(point));
    }

    // Clear all line primitives
    const polylineCollection = scene.polylineCollection;
    if (polylineCollection) {
      const linesToRemove: Polyline[] = [];
      for (let i = 0; i < polylineCollection.length; i++) {
        const line = polylineCollection.get(i);
        if (typeof line?.id === 'string' && this.isAnyDecorationId(line.id))
          linesToRemove.push(line);
      }
      linesToRemove.forEach(line => polylineCollection.remove(line));
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
    return graphic?.symbology;
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

  private isPrimitiveCollection(collection: PointPrimitiveCollection | PolylineCollection | PrimitiveCollection): collection is PrimitiveCollection {
    return collection instanceof PrimitiveCollection;
  }

  private isPrimitiveResult(result: Primitive | Polyline | PointPrimitive | void): result is Primitive {
    return result instanceof Primitive;
  }
}
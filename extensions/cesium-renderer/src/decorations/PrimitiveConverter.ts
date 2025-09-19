/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { Decorations, GraphicList, IModelConnection, RenderGraphic } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { Cartesian3 } from "cesium";
import { CesiumScene } from "../CesiumScene.js";
import { PrimitiveConverterFactory } from "./PrimitiveConverterFactory.js";
import { CesiumCoordinateConverter } from "./CesiumCoordinateConverter.js";
import { DecorationPrimitiveEntry } from "./DecorationTypes.js";

export interface RenderGraphicWithCoordinates extends RenderGraphic {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  _coordinateData?: DecorationPrimitiveEntry[];
  geometries?: unknown[];
  geometryType?: string;
}

/** Base class for converting iTwin.js decorations to Cesium primitives */
export abstract class PrimitiveConverter {
  // Geometry type handled by this converter
  protected abstract readonly primitiveType: import('./DecorationTypes.js').DecorationPrimitiveEntry["type"];

  // Unified convert method that uses the subclass primitiveType
  public convertDecorations(graphics: GraphicList, type: string, scene: CesiumScene, iModel?: IModelConnection): void {
    this.convertDecorationsTemplate(graphics, type, scene, this.primitiveType, iModel);
  }

  /** Convert Point3d array to Cartesian3 array for all geometry types */
  protected convertPointsToCartesian3(points: Point3d[], iModel?: IModelConnection): Cartesian3[] {
    if (!points || points.length === 0) return [];

    if (this.primitiveType === 'pointstring' && points.length > 1) {
      points = [points[0]];
    }

    if (iModel) {
      const converter = new CesiumCoordinateConverter(iModel);
      return points.map(point => converter.spatialToCesiumCartesian3(point));
    } else {
      return points.map(point => new Cartesian3(point.x, point.y, point.z));
    }
  }

  /** Base implementation for depth options - can be extended by subclasses */
  protected getDepthOptions(decorationType: string): Record<string, unknown> {
    // Handle common base logic for all primitive types
    const isOverlay = decorationType === 'worldOverlay' || decorationType === 'viewOverlay';
    if (!isOverlay) {
      return {}; // Normal depth testing case
    }
    
    // Return base overlay configuration (if any common settings needed)
    return {};
  }

  /** Generic method to extract primitive data by type. Subclasses may override and return their own shape. */
  protected extractPrimitiveData(coordinateData: DecorationPrimitiveEntry[] | undefined, primitiveType: string): unknown {
    if (!coordinateData || !Array.isArray(coordinateData)) return undefined;
    const entries = coordinateData.filter((entry) => entry.type === primitiveType);
    type EntriesWithPoints =
      | import('./DecorationTypes.js').PointStringEntry
      | import('./DecorationTypes.js').LineStringEntry
      | import('./DecorationTypes.js').ShapeEntry;
    const withPoints = entries.filter((e): e is EntriesWithPoints => 'points' in e);
    return withPoints.map((entry) => entry.points);
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
    originalData?: unknown,
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
        const data = coordinateData as DecorationPrimitiveEntry[];
        data.forEach((primitive) => {
          switch (primitive.type) {
            case 'pointstring':
              const pointConverter = PrimitiveConverterFactory.getConverter(primitive.type);
              if (pointConverter) {
                pointConverter.convertDecorations([graphic], type, scene, iModel);
              }
              break;
              
            case 'linestring':
              const lineConverter = PrimitiveConverterFactory.getConverter(primitive.type);
              if (lineConverter) {
                lineConverter.convertDecorations([graphic], type, scene, iModel);
              }
              break;
              
            case 'shape':
              const shapeConverter = PrimitiveConverterFactory.getConverter(primitive.type);
              if (shapeConverter) {
                shapeConverter.convertDecorations([graphic], type, scene, iModel);
              }
              break;
              
            case 'arc':
              const arcConverter = PrimitiveConverterFactory.getConverter(primitive.type);
              if (arcConverter) {
                arcConverter.convertDecorations([graphic], type, scene, iModel);
              }
              break;
              
            case 'path':
              const pathConverter = PrimitiveConverterFactory.getConverter(primitive.type);
              if (pathConverter) {
                pathConverter.convertDecorations([graphic], type, scene, iModel);
              }
              break;
              
            case 'loop':
              const loopConverter = PrimitiveConverterFactory.getConverter(primitive.type);
              if (loopConverter) {
                loopConverter.convertDecorations([graphic], type, scene, iModel);
              }
              break;
              
            case 'polyface':
              const polyfaceConverter = PrimitiveConverterFactory.getConverter(primitive.type);
              if (polyfaceConverter) {
                polyfaceConverter.convertDecorations([graphic], type, scene, iModel);
              }
              break;
              
            case 'solidPrimitive':
              const solidPrimitiveConverter = PrimitiveConverterFactory.getConverter(primitive.type);
              if (solidPrimitiveConverter) {
                solidPrimitiveConverter.convertDecorations([graphic], type, scene, iModel);
              }
              break;
              
            default:
              // Exhaustive over DecorationPrimitiveEntry discriminant; no-op for unknown
              break;
          }
        });
      }
    });
  }

  /** Check if an ID string matches decoration naming pattern */
  protected isDecorationId(id: string, pattern: string): boolean {
    return id.startsWith(`world_${pattern}_`) ||
           id.startsWith(`normal_${pattern}_`) ||
           id.startsWith(`worldOverlay_${pattern}_`) ||
           id.startsWith(`viewOverlay_${pattern}_`) ||
           id.startsWith(`viewBackground_${pattern}_`);
  }

  /** Unified clear decorations - removes all decoration primitives from scene */
  public clearDecorations(scene: CesiumScene): void {
    // Clear all point primitives
    const pointCollection = scene.pointCollection;
    if (pointCollection) {
      const pointsToRemove: unknown[] = [];
      for (let i = 0; i < pointCollection.length; i++) {
        const point = pointCollection.get(i);
        const hasId = (p: unknown): p is { id?: unknown } => typeof p === 'object' && p !== null && 'id' in (p as object);
        if (hasId(point) && typeof point.id === 'string' && this.isAnyDecorationId(point.id))
          pointsToRemove.push(point);
      }
      pointsToRemove.forEach(point => pointCollection.remove(point as unknown as import('cesium').PointPrimitive));
    }

    // Clear all line primitives  
    const polylineCollection = scene.polylineCollection;
    if (polylineCollection) {
      const linesToRemove: unknown[] = [];
      for (let i = 0; i < polylineCollection.length; i++) {
        const line = polylineCollection.get(i);
        const hasId = (l: unknown): l is { id?: unknown } => typeof l === 'object' && l !== null && 'id' in (l as object);
        if (hasId(line) && typeof line.id === 'string' && this.isAnyDecorationId(line.id))
          linesToRemove.push(line);
      }
      linesToRemove.forEach(line => polylineCollection.remove(line as unknown as import('cesium').Polyline));
    }
  }

  /** Check if an ID is any type of decoration */
  private isAnyDecorationId(id: string): boolean {
    // Matches: <type>_(pointstring|linestring|shape)_<index>
    return /^(world|normal|worldOverlay|viewOverlay|viewBackground)_(pointstring|linestring|shape)_/i.test(id);
  }
}

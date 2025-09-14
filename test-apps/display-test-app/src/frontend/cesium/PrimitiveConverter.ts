/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { Decorations, GraphicList, GraphicPrimitive, IModelConnection, RenderGraphic } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { Cartesian3 } from "cesium";
import { CesiumScene } from "./Scene";
import { PrimitiveConverterFactory } from "./PrimitiveConverterFactory";
import { CesiumCoordinateConverter } from "./CesiumCoordinateConverter";

export interface RenderGraphicWithCoordinates extends RenderGraphic {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  _coordinateData?: GraphicPrimitive[];
  geometryType?: string;
}

/** Base class for converting iTwin.js decorations to Cesium primitives */
export abstract class PrimitiveConverter {
  // Geometry type handled by this converter
  protected abstract readonly primitiveType: GraphicPrimitive["type"];

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
  protected getDepthOptions(decorationType: string): any {
    // Handle common base logic for all primitive types
    const isOverlay = decorationType === 'worldOverlay' || decorationType === 'viewOverlay';
    if (!isOverlay) {
      return {}; // Normal depth testing case
    }
    
    // Return base overlay configuration (if any common settings needed)
    return {};
  }

  /** Generic method to extract primitive data by type */
  protected extractPrimitiveData(coordinateData: GraphicPrimitive[] | undefined, primitiveType: string): Point3d[][] | undefined {
    if (!coordinateData || !Array.isArray(coordinateData)) return undefined;
    
    const entries = coordinateData.filter((entry: GraphicPrimitive) => entry.type === primitiveType);
    return entries.map((entry: any) => entry.points);
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

      const result = this.createPrimitiveFromGraphic(graphic, primitiveId, index, collection, iModel, originalData, type);

      if (result && typeof result === 'object' && result.constructor.name === 'Primitive') {
        collection.add(result);
      }
    });
  }

  /** Default filterGraphics implementation - can be overridden by subclasses if needed */
  protected filterGraphics(graphics: GraphicList, primitiveType: string): GraphicList {
    return graphics.filter(graphic => {
      const graphicWithCoords = graphic as RenderGraphicWithCoordinates;
      const coordinateData = graphicWithCoords._coordinateData;
      const hasPrimitiveData = coordinateData && coordinateData.some((entry: GraphicPrimitive) => entry.type === primitiveType);
      const geometryType = graphicWithCoords.geometryType;
      
      return hasPrimitiveData || geometryType === primitiveType;
    });
  }

  /** Abstract methods that must be implemented by subclasses */
  protected abstract getCollection(scene: CesiumScene): any;
  protected abstract createPrimitiveFromGraphic(
    graphic: any, 
    primitiveId: string, 
    index: number, 
    collection: any, 
    iModel?: IModelConnection, 
    originalData?: Point3d[][], 
    type?: string
  ): any;
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
        coordinateData.forEach((primitive: GraphicPrimitive) => {
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
              console.warn(`Unknown geometry type: ${primitive.type}`);
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
      const pointsToRemove: any[] = [];
      for (let i = 0; i < pointCollection.length; i++) {
        const point = pointCollection.get(i);
        if (point.id && typeof point.id === 'string' && this.isAnyDecorationId(point.id)) {
          pointsToRemove.push(point);
        }
      }
      pointsToRemove.forEach(point => pointCollection.remove(point));
    }

    // Clear all line primitives  
    const polylineCollection = scene.polylineCollection;
    if (polylineCollection) {
      const linesToRemove: any[] = [];
      for (let i = 0; i < polylineCollection.length; i++) {
        const line = polylineCollection.get(i);
        if (line.id && typeof line.id === 'string' && this.isAnyDecorationId(line.id)) {
          linesToRemove.push(line);
        }
      }
      linesToRemove.forEach(line => polylineCollection.remove(line));
    }
  }

  /** Check if an ID is any type of decoration */
  private isAnyDecorationId(id: string): boolean {
    // Matches: <type>_(pointstring|linestring|shape)_<index>
    return /^(world|normal|worldOverlay|viewOverlay|viewBackground)_(pointstring|linestring|shape)_/i.test(id);
  }
}

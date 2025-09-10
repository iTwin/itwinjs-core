/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { Decorations, GraphicList, IModelConnection } from "@itwin/core-frontend";
import { CesiumScene } from "./Scene";
import { PrimitiveConverterFactory } from "./PrimitiveConverterFactory";

/** Base class for converting iTwin.js decorations to Cesium primitives */
export abstract class PrimitiveConverter {
  public abstract convertDecorations(graphics: GraphicList, type: string, scene: CesiumScene, iModel?: IModelConnection): void;

  /** Get depth test distance based on decoration type */
  protected getDepthTestDistance(type: string): number {
    if (type === 'worldOverlay' || type === 'viewOverlay') {
      return Number.POSITIVE_INFINITY;
    }
    return 0.0;
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
      const coordinateData = (graphic as any)._coordinateData;
      
      if (coordinateData && Array.isArray(coordinateData)) {
        coordinateData.forEach((primitive: any) => {
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
    return id.includes('_decoration_') || id.includes('_linestring_');
  }
}
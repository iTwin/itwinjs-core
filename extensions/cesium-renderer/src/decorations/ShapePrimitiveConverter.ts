/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { Cartesian3, ColorGeometryInstanceAttribute, GeometryInstance, PerInstanceColorAppearance, PolygonGeometry, PolygonHierarchy, Primitive, PrimitiveCollection } from "cesium";
import { IModelConnection } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { CesiumScene } from "../CesiumScene.js";
import { PrimitiveConverter, RenderGraphicWithCoordinates } from "./PrimitiveConverter.js";
 
export class ShapePrimitiveConverter extends PrimitiveConverter {
  protected readonly primitiveType = 'shape';

  protected override getCollection(scene: CesiumScene): PrimitiveCollection {
    return scene.primitivesCollection;
  }


  protected override createPrimitiveFromGraphic(
    graphic: RenderGraphicWithCoordinates,
    primitiveId: string,
    index: number,
    collection: PrimitiveCollection,
    iModel?: IModelConnection,
    originalData?: unknown,
    type?: string
  ): Primitive | null {
    return this.createPolygonFromGraphic(graphic, primitiveId, index, collection, iModel, originalData as Point3d[][] | undefined, type);
  }

  protected override getPrimitiveTypeName(): string {
    return 'shape';
  }

  protected override shouldSkipEmptyGraphics(): boolean {
    return true;
  }

  protected override getDepthOptions(decorationType: string): Record<string, unknown> {
    const baseOptions = super.getDepthOptions(decorationType);
    
    const isOverlay = decorationType === 'worldOverlay' || decorationType === 'viewOverlay';
    if (isOverlay) {
      return {
        ...baseOptions,
        heightReference: 0,
        extrudedHeightReference: 0,
      };
    }
    return baseOptions;
  }

  private createPolygonFromGraphic(
    graphic: RenderGraphicWithCoordinates,
    shapeId: string,
    index: number,
    primitivesCollection: PrimitiveCollection,
    iModel?: IModelConnection,
    originalShapes?: Point3d[][],
    type?: string
  ): Primitive | null {
    if (!graphic) {
      return null;
    }
    if (graphic.geometries && graphic.geometryType) {
      return this.createPolygonFromGeometry(graphic.geometries, graphic.geometryType, shapeId, index, primitivesCollection, iModel, originalShapes, type, graphic);
    }

    return null;
  }

  private createPolygonFromGeometry(
    geometries: unknown[],
    geometryType: string,
    shapeId: string,
    _index: number,
    primitivesCollection: PrimitiveCollection,
    iModel?: IModelConnection,
    originalShapes?: Point3d[][],
    _type?: string,
    _graphic?: RenderGraphicWithCoordinates
  ): Primitive | null {
    if (!geometries || !geometryType || !primitivesCollection) {
      return null;
    }

    let positions: Cartesian3[] = [];
    
    if (originalShapes && originalShapes.length > 0) {
      const firstShape = originalShapes[0];
      if (firstShape && firstShape.length > 0) {
        positions = this.convertPointsToCartesian3(firstShape, iModel);
        // For polygon, ensure the shape is properly closed
        if (positions.length > 2) {
          const firstPos = positions[0];
          const lastPos = positions[positions.length - 1];
          if (!Cartesian3.equals(firstPos, lastPos)) {
            positions.push(firstPos);
          }
        }
      }
    }
    
    if (positions.length === 0 && geometries && geometries.length > 0) {
      const geometry = geometries[0];
      interface Coord { x: number; y: number; z: number }
      const hasCoords = (g: unknown): g is { coordinateData: Coord[] } =>
        typeof g === 'object' && g !== null && ('coordinateData' in g);
      if (hasCoords(geometry) && geometry.coordinateData.length > 0) {
        const points = geometry.coordinateData.map((coord) => new Point3d(coord.x, coord.y, coord.z));
        positions = this.convertPointsToCartesian3(points, iModel);
        // Ensure the shape is closed
        if (positions.length > 2) {
          const firstPos = positions[0];
          const lastPos = positions[positions.length - 1];
          if (!Cartesian3.equals(firstPos, lastPos)) {
            positions.push(firstPos);
          }
        }
      }
    }

    if (positions.length < 3) {
      return null;
    }

    switch (geometryType) {
      case 'shape':
      default:
        // Create filled polygon geometry
        const polygonGeometry = new PolygonGeometry({
          polygonHierarchy: new PolygonHierarchy(positions),
          extrudedHeight: 0, // Flat polygon, no extrusion
        });

        // Determine color: prefer symbology fill, fallback by type
        const color = this.extractFillOrLineColorFromGraphic(_graphic, 'shape');
        if (!color)
          return null;
        
        const geometryInstance = new GeometryInstance({
          geometry: polygonGeometry,
          id: shapeId,
          attributes: {
            color: ColorGeometryInstanceAttribute.fromColor(color)
          }
        });

        const primitive = new Primitive({
          geometryInstances: geometryInstance,
          appearance: new PerInstanceColorAppearance({
            flat: true, // Use flat shading for better performance
            translucent: false
          })
        });

        primitivesCollection.add(primitive);
        return primitive;
    }
  }
}

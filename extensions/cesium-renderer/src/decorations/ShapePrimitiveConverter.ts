/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { Cartesian3, Color, ColorGeometryInstanceAttribute, GeometryInstance, PerInstanceColorAppearance, PolygonGeometry, PolygonHierarchy, Primitive, PrimitiveCollection } from "cesium";
import { GraphicList, IModelConnection } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { CesiumScene } from "../CesiumScene.js";
import { PrimitiveConverter } from "./PrimitiveConverter.js";
import { ColorDef } from "@itwin/core-common";

export class ShapePrimitiveConverter extends PrimitiveConverter {
  protected readonly primitiveType = 'shape';


  protected override getCollection(scene: CesiumScene): any {
    return scene.primitivesCollection;
  }


  protected override createPrimitiveFromGraphic(
    graphic: any, 
    primitiveId: string, 
    index: number, 
    collection: any, 
    iModel?: IModelConnection, 
    originalData?: Point3d[][], 
    type?: string
  ): any {
    return this.createPolygonFromGraphic(graphic, primitiveId, index, collection, iModel, originalData, type);
  }

  protected override getPrimitiveTypeName(): string {
    return 'shape';
  }

  protected override shouldSkipEmptyGraphics(): boolean {
    return true;
  }

  protected override getDepthOptions(decorationType: string): any {
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
    graphic: any,
    shapeId: string,
    index: number,
    primitivesCollection: any,
    iModel?: IModelConnection,
    originalShapes?: Point3d[][],
    type?: string
  ): Primitive | null {
    if (!graphic) {
      console.warn(`Null graphic for ${shapeId}`);
      return null;
    }

    try {
      if (graphic.geometries && graphic.geometryType) {
        return this.createPolygonFromGeometry(graphic.geometries, graphic.geometryType, shapeId, index, primitivesCollection, iModel, originalShapes, type, graphic);
      }

      return null;

    } catch (error) {
      console.error(`Error in createPolygonFromGraphic for ${shapeId}:`, error);
      return null;
    }
  }

  private createPolygonFromGeometry(
    geometries: any[],
    geometryType: string,
    shapeId: string,
    _index: number,
    primitivesCollection: any,
    iModel?: IModelConnection,
    originalShapes?: Point3d[][],
    _type?: string,
    _graphic?: any
  ): Primitive | null {
    if (!geometries || !geometryType || !primitivesCollection) {
      return null;
    }

    try {
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
        if (geometry && geometry.coordinateData && geometry.coordinateData.length > 0) {
          const points = geometry.coordinateData.map((coord: any) => 
            new Point3d(coord.x, coord.y, coord.z)
          );
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
        console.warn(`Shape requires at least 3 points, got ${positions.length}`);
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
          const color = this.extractFillColorFromGraphic(_graphic);
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
    } catch (error) {
      console.error(`Error in createPolygonFromGeometry for ${shapeId}:`, error);
      return null;
    }
  }

  private getShapeColor(type?: string): Color {
    switch (type) {
      case 'worldOverlay':
        return Color.MAGENTA;
      case 'viewOverlay':
        return Color.CYAN;
      case 'world':
      default:
        return Color.GREEN;
    }
  }

  private extractFillColorFromGraphic(graphic?: any): Color | undefined {
    const toCesium = (cd?: ColorDef) => {
      if (!cd) return undefined;
      const c = cd.colors;
      const alpha = 255 - (c.t ?? 0);
      return Color.fromBytes(c.r, c.g, c.b, alpha);
    };

    // Prefer symbology captured in coordinateData
    const coordData = (graphic as any)?._coordinateData as any[] | undefined;
    const entry = coordData?.find((e) => e?.type === 'shape' && (e.symbology?.fillColor || e.symbology?.lineColor));
    if (entry) {
      const fill = toCesium(entry.symbology?.fillColor as ColorDef | undefined) ?? toCesium(entry.symbology?.lineColor as ColorDef | undefined);
      if (fill)
        return fill;
    }

    // Otherwise use graphic.symbology
    const symbology = (graphic as any)?.symbology;
    const fillDef = (symbology?.fillColor ?? symbology?.color) as ColorDef | undefined;
    return toCesium(fillDef);
  }

}

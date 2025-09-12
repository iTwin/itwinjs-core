/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ColorDef } from "@itwin/core-common";
import { GraphicList, IModelConnection } from "@itwin/core-frontend";
import { Arc3d, LineString3d, Path, Point3d } from "@itwin/core-geometry";
import { Cartesian3, Color } from "cesium";
import { CesiumScene } from "./Scene";
import { PrimitiveConverter } from "./PrimitiveConverter";
import { CesiumCoordinateConverter } from "./CesiumCoordinateConverter";

export class PathPrimitiveConverter extends PrimitiveConverter {
  public convertDecorations(graphics: GraphicList, type: string, scene: CesiumScene, iModel?: IModelConnection): void {
    const pathGraphics = graphics.filter(graphic => {
      const coordinateData = (graphic as any)._coordinateData;
      const hasPathData = coordinateData && coordinateData.some((entry: any) => entry.type === 'path');
      return hasPathData || (graphic as any).geometryType === 'path';
    });

    pathGraphics.forEach((graphic, index) => {
      const coordinateData = (graphic as any)._coordinateData;
      const originalPaths = this.extractPathData(coordinateData);
      this.createPolylineFromPath(graphic, `${type}_path_${index}`, scene, iModel, originalPaths);
    });
  }

  public clearDecorations(scene: CesiumScene): void {
    if (scene?.polylineCollection) {
      const pathPolylines = [];
      for (let i = scene.polylineCollection.length - 1; i >= 0; i--) {
        const polyline = scene.polylineCollection.get(i);
        if (polyline && polyline.id && typeof polyline.id === 'string' && polyline.id.includes('path')) {
          pathPolylines.push(polyline);
        }
      }
      pathPolylines.forEach(polyline => scene.polylineCollection.remove(polyline));
    }
  }

  private extractPathData(coordinateData: any): Path[] {
    const paths: Path[] = [];
    if (coordinateData && Array.isArray(coordinateData)) {
      coordinateData.forEach((entry: any) => {
        if (entry.type === 'path' && entry.path) {
          paths.push(entry.path);
        }
      });
    }
    return paths;
  }

  private createPolylineFromPath(
    graphic: any, 
    pathId: string, 
    scene: CesiumScene, 
    iModel?: IModelConnection, 
    originalPaths?: Path[]
  ): void {
    if (!scene?.polylineCollection) return;

    let pathsToProcess = originalPaths;
    
    if (!pathsToProcess || pathsToProcess.length === 0) {
      const fallbackPaths = this.extractFallbackPaths(graphic);
      if (fallbackPaths.length === 0) return;
      pathsToProcess = fallbackPaths;
    }

    pathsToProcess.forEach((path, pathIndex) => {
      try {
        const allPositions = this.convertPathToPositions(path, iModel);
        if (allPositions.length < 2) return;

        const color = this.extractColorFromGraphic(graphic);
        const primitiveId = `${pathId}_${pathIndex}_${Date.now()}`;

        scene.polylineCollection.add({
          id: primitiveId,
          positions: allPositions,
          width: 3.0,
          color: color,
          clampToGround: false
        });
      } catch (error) {
        console.error('Error creating polyline from path:', error);
      }
    });
  }

  private convertPathToPositions(path: Path, iModel?: IModelConnection): Cartesian3[] {
    const allPoints: Point3d[] = [];
    
    // Process each curve in the path manually for better reliability
    if (path.children && Array.isArray(path.children)) {
      for (const curve of path.children) {
        if (curve instanceof LineString3d) {
          // Add all points from line string
          allPoints.push(...curve.points);
        } else if (curve instanceof Arc3d) {
          // Sample points from arc using a simple approach
          try {
            const numSamples = 20; // Fixed number of samples for arc
            for (let i = 0; i <= numSamples; i++) {
              const fraction = i / numSamples;
              const point = curve.fractionToPoint(fraction);
              allPoints.push(point);
            }
          } catch (arcError) {
            console.warn('Arc sampling failed, using start and end points:', arcError);
            // Fallback: just use start and end points
            allPoints.push(curve.startPoint());
            allPoints.push(curve.endPoint());
          }
        }
      }
    }

    return this.convertPointsToCartesian3(allPoints, iModel);
  }

  private convertPointsToCartesian3(points: Point3d[], iModel?: IModelConnection): Cartesian3[] {
    if (!points || points.length === 0) return [];

    if (iModel) {
      const converter = new CesiumCoordinateConverter(iModel);
      return points.map(point => converter.spatialToCesiumCartesian3(point));
    } else {
      return points.map(point => new Cartesian3(point.x, point.y, point.z));
    }
  }

  private extractColorFromGraphic(graphic: any): Color {
    try {
      const symbology = graphic.symbology;
      if (symbology && symbology.color) {
        const colorDef = symbology.color as ColorDef;
        const colors = colorDef.colors;
        return Color.fromBytes(colors.r, colors.g, colors.b, Math.floor(colors.t * 255));
      }
    } catch (error) {
      console.warn('Could not extract color from graphic:', error);
    }
    
    return Color.YELLOW; // Default color for paths
  }

  private extractFallbackPaths(graphic: any): Path[] {
    const paths: Path[] = [];
    
    try {
      if (graphic.geometries && Array.isArray(graphic.geometries)) {
        graphic.geometries.forEach((geometry: any) => {
          if (geometry && geometry.path) {
            paths.push(geometry.path);
          }
        });
      }
    } catch (error) {
      console.warn('Could not extract fallback paths:', error);
    }
    
    return paths;
  }
}
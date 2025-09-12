/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ColorDef } from "@itwin/core-common";
import { GraphicList, IModelConnection } from "@itwin/core-frontend";
import { LineString3d, Loop, Point3d } from "@itwin/core-geometry";
import { Cartesian3, Color, ColorGeometryInstanceAttribute, GeometryInstance, PerInstanceColorAppearance, PolygonGeometry, PolygonHierarchy, Primitive } from "cesium";
import { CesiumScene } from "./Scene";
import { PrimitiveConverter } from "./PrimitiveConverter";
import { CesiumCoordinateConverter } from "./CesiumCoordinateConverter";

export class LoopPrimitiveConverter extends PrimitiveConverter {
  public convertDecorations(graphics: GraphicList, type: string, scene: CesiumScene, iModel?: IModelConnection): void {
    const loopGraphics = graphics.filter(graphic => {
      const coordinateData = (graphic as any)._coordinateData;
      const hasLoopData = coordinateData && coordinateData.some((entry: any) => entry.type === 'loop');
      return hasLoopData || (graphic as any).geometryType === 'loop';
    });

    loopGraphics.forEach((graphic, index) => {
      const coordinateData = (graphic as any)._coordinateData;
      const originalLoops = this.extractLoopData(coordinateData);
      this.createPolygonFromLoop(graphic, `${type}_loop_${index}`, scene, iModel, originalLoops);
    });
  }

  public clearDecorations(scene: CesiumScene): void {
    // Clear from polylineCollection (temporary test)
    if (scene?.polylineCollection) {
      const loopPolylines = [];
      for (let i = scene.polylineCollection.length - 1; i >= 0; i--) {
        const polyline = scene.polylineCollection.get(i);
        if (polyline && polyline.id && typeof polyline.id === 'string' && polyline.id.includes('loop')) {
          loopPolylines.push(polyline);
        }
      }
      loopPolylines.forEach(polyline => scene.polylineCollection.remove(polyline));
    }

    // Clear from primitives (for future polygon rendering)
    if (scene?.cesiumScene?.primitives) {
      const loopPrimitives = [];
      for (let i = scene.cesiumScene.primitives.length - 1; i >= 0; i--) {
        const primitive = scene.cesiumScene.primitives.get(i);
        if (primitive && primitive.id && typeof primitive.id === 'string' && primitive.id.includes('loop')) {
          loopPrimitives.push(primitive);
        }
      }
      loopPrimitives.forEach(primitive => scene.cesiumScene.primitives.remove(primitive));
    }
  }

  private extractLoopData(coordinateData: any): Loop[] {
    const loops: Loop[] = [];
    if (coordinateData && Array.isArray(coordinateData)) {
      coordinateData.forEach((entry: any) => {
        if (entry.type === 'loop' && entry.loop) {
          loops.push(entry.loop);
        }
      });
    }
    return loops;
  }

  private createPolygonFromLoop(
    graphic: any, 
    loopId: string, 
    scene: CesiumScene, 
    iModel?: IModelConnection, 
    originalLoops?: Loop[]
  ): void {
    if (!scene?.cesiumScene?.primitives) {
      console.warn('LoopPrimitiveConverter: No scene.cesiumScene.primitives');
      return;
    }
    let loopsToProcess = originalLoops;
    
    if (!loopsToProcess || loopsToProcess.length === 0)
      return;
    loopsToProcess.forEach((loop, loopIndex) => {
      const positions = this.convertLoopToPositions(loop, iModel);

      if (positions.length < 3)
        return;

      const colors = this.extractColorsFromGraphic(graphic);
      if (!colors)
        return;
      const { fillColor, lineColor, outlineWanted } = colors;

      const primitiveId = `${loopId}_${loopIndex}_${Date.now()}`;

      if (outlineWanted) {
        scene.polylineCollection.add({
          id: `${primitiveId}_outline`,
          positions,
          width: 2.5,
          color: lineColor,
          clampToGround: false,
        });
      }

      const positionsNoClose = this.removeDuplicateClosingPoint(positions);
      if (positionsNoClose.length >= 3) {
        const polygonGeometry = new PolygonGeometry({
          polygonHierarchy: new PolygonHierarchy(positionsNoClose),
        });

        const translucent = fillColor.alpha < 1.0;
        const geometryInstance = new GeometryInstance({
          geometry: polygonGeometry,
          id: primitiveId,
          attributes: {
            color: ColorGeometryInstanceAttribute.fromColor(fillColor),
          },
        });

        const primitive = new Primitive({
          geometryInstances: geometryInstance,
          appearance: new PerInstanceColorAppearance({ flat: true, translucent }),
          asynchronous: false,
        });

        scene.primitivesCollection.add(primitive);
      }
    });
  }

  private convertLoopToPositions(loop: Loop, iModel?: IModelConnection): Cartesian3[] {
    const points: Point3d[] = [];
    
    // Process each child curve in the loop
    if (loop.children && Array.isArray(loop.children)) {
      for (const curve of loop.children) {
        if (curve instanceof LineString3d) {
          const curvePoints = curve.points;
          if (curvePoints.length > 0) {
            for (let i = 0; i < curvePoints.length - 1; i++)
              points.push(curvePoints[i]);
          }
        } else {
          const numSamples = 20;
          for (let i = 0; i < numSamples; i++) {
            const fraction = i / numSamples;
            const point = curve.fractionToPoint(fraction);
            points.push(point);
          }
        }
      }
    }

    // Ensure the loop is closed by adding the first point at the end if needed
    if (points.length > 2) {
      const firstPoint = points[0];
      const lastPoint = points[points.length - 1];
      if (!firstPoint.isAlmostEqual(lastPoint))
        points.push(firstPoint.clone());
    }

    return this.convertPointsToCartesian3(points, iModel);
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

  private extractColorFromGraphic(graphic: any): Color | undefined {
    const symbology = graphic.symbology;
    const colorDef = symbology?.color as ColorDef | undefined;
    if (!colorDef)
      return undefined;
    const colors = colorDef.colors;
    const alpha = 255 - (colors.t ?? 0);
    return Color.fromBytes(colors.r, colors.g, colors.b, alpha);
  }

  private extractFallbackLoops(graphic: any): Loop[] {
    const loops: Loop[] = [];
    
    try {
      if (graphic.geometries && Array.isArray(graphic.geometries)) {
        graphic.geometries.forEach((geometry: any) => {
          if (geometry && geometry.loop) {
            loops.push(geometry.loop);
          }
        });
      }
    } catch (error) {
      console.warn('Could not extract fallback loops:', error);
    }
    
    return loops;
  }

  private removeDuplicateClosingPoint(positions: Cartesian3[]): Cartesian3[] {
    if (positions.length < 2)
      return positions;
    const first = positions[0];
    const last = positions[positions.length - 1];
    if (Cartesian3.equals(first, last))
      return positions.slice(0, -1);
    return positions;
  }

  private extractColorsFromGraphic(graphic: any): { fillColor: Color; lineColor: Color; outlineWanted: boolean } | undefined {
    const symbology = graphic?.symbology;
    const lineDef = symbology?.color as ColorDef | undefined;
    const fillDef = (symbology?.fillColor ?? symbology?.color) as ColorDef | undefined;

    const toCesium = (cd?: ColorDef) => {
      if (!cd) return undefined;
      const c = cd.colors;
      const alpha = 255 - (c.t ?? 0);
      return Color.fromBytes(c.r, c.g, c.b, alpha);
    };

    const lineColor = toCesium(lineDef);
    const fillColor = toCesium(fillDef);
    if (!lineColor || !fillColor)
      return undefined;
    const outlineWanted = !Color.equals(lineColor, fillColor);
    return { fillColor, lineColor, outlineWanted };
  }
}

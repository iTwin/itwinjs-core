/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ColorDef } from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";
import { LineString3d, Loop, Point3d } from "@itwin/core-geometry";
import { Cartesian3, Color, ColorGeometryInstanceAttribute, GeometryInstance, PerInstanceColorAppearance, PolygonGeometry, PolygonHierarchy, Primitive } from "cesium";
import { CesiumScene } from "../CesiumScene.js";
import { PrimitiveConverter } from "./PrimitiveConverter.js";

export class LoopPrimitiveConverter extends PrimitiveConverter {
  protected readonly primitiveType = 'loop' as const;
  private _currentScene?: CesiumScene;

  protected override getCollection(scene: CesiumScene): any {
    this._currentScene = scene;
    return scene.primitivesCollection;
  }

  protected override extractPrimitiveData(coordinateData: any[] | undefined, primitiveType: string): any[] | undefined {
    if (!coordinateData || !Array.isArray(coordinateData))
      return undefined;
    return coordinateData.filter((entry: any) => entry.type === primitiveType);
  }

  protected override createPrimitiveFromGraphic(
    graphic: any,
    primitiveId: string,
    _index: number,
    _collection: any,
    iModel?: IModelConnection,
    originalData?: any[],
    _type?: string
  ): any {
    const loopEntry = Array.isArray(originalData) ? originalData.find((e) => e && e.loop instanceof Loop) : undefined;
    const loop: Loop | undefined = loopEntry?.loop as Loop | undefined;
    if (!loop)
      return null;

    const positions = this.convertLoopToPositions(loop, iModel);
    if (positions.length < 3)
      return null;

    const colors = this.extractColorsFromGraphic(graphic);
    if (!colors)
      return null;
    const { fillColor, lineColor, outlineWanted } = colors;

    if (outlineWanted && this._currentScene) {
      this._currentScene.polylineCollection.add({
        id: `${primitiveId}_outline`,
        positions,
        width: 2.5,
        color: lineColor,
        clampToGround: false,
      });
    }

    const positionsNoClose = this.removeDuplicateClosingPoint(positions);
    if (positionsNoClose.length < 3)
      return null;

    const polygonGeometry = new PolygonGeometry({ polygonHierarchy: new PolygonHierarchy(positionsNoClose) });
    const translucent = fillColor.alpha < 1.0;
    const geometryInstance = new GeometryInstance({
      geometry: polygonGeometry,
      id: primitiveId,
      attributes: { color: ColorGeometryInstanceAttribute.fromColor(fillColor) },
    });

    const primitive = new Primitive({
      geometryInstances: geometryInstance,
      appearance: new PerInstanceColorAppearance({ flat: true, translucent }),
      asynchronous: false,
    });

    return primitive;
  }

  public override clearDecorations(scene: CesiumScene): void {
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
    
    if (!originalLoops || originalLoops.length === 0)
      return;
    originalLoops.forEach((loop, loopIndex) => {
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

  // Use base class convertPointsToCartesian3

  private extractColorFromGraphic(graphic: any): Color | undefined {
    const symbology = graphic.symbology;
    const colorDef = symbology?.color as ColorDef | undefined;
    if (!colorDef)
      return undefined;
    const colors = colorDef.colors;
    const alpha = 255 - (colors.t ?? 0);
    return Color.fromBytes(colors.r, colors.g, colors.b, alpha);
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
    // Prefer symbology captured in coordinateData (from CoordinateBuilder)
    const coordData = (graphic as any)?._coordinateData as any[] | undefined;
    const entry = coordData?.find((e) => e?.type === 'loop' && e.symbology?.lineColor);
    const toCesium = (cd?: ColorDef) => {
      if (!cd) return undefined;
      const c = cd.colors;
      const alpha = 255 - (c.t ?? 0);
      return Color.fromBytes(c.r, c.g, c.b, alpha);
    };
    if (entry) {
      const lineColor = toCesium(entry.symbology.lineColor as ColorDef | undefined);
      const fillColor = toCesium(entry.symbology.fillColor as ColorDef | undefined);
      if (lineColor && fillColor) {
        const outlineWanted = !Color.equals(lineColor, fillColor);
        return { fillColor, lineColor, outlineWanted };
      }
    }

    // Otherwise, use graphic.symbology as provided
    const symbology = graphic?.symbology;
    const lineDef = symbology?.color as ColorDef | undefined;
    const fillDef = (symbology?.fillColor ?? symbology?.color) as ColorDef | undefined;
    const lineColor2 = toCesium(lineDef);
    const fillColor2 = toCesium(fillDef);
    if (!lineColor2 || !fillColor2)
      return undefined;
    const outlineWanted2 = !Color.equals(lineColor2, fillColor2);
    return { fillColor: fillColor2, lineColor: lineColor2, outlineWanted: outlineWanted2 };
  }
}

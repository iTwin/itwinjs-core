/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelConnection } from "@itwin/core-frontend";
import { LineString3d, Loop, Point3d } from "@itwin/core-geometry";
import { Cartesian3, ColorGeometryInstanceAttribute, GeometryInstance, PerInstanceColorAppearance, PolygonGeometry, PolygonHierarchy, Primitive, PrimitiveCollection } from "cesium";
import { CesiumScene } from "../CesiumScene.js";
import { PrimitiveConverter, RenderGraphicWithCoordinates } from "./PrimitiveConverter.js";
import type { DecorationPrimitiveEntry, LoopEntry } from "./DecorationTypes.js";

export class LoopPrimitiveConverter extends PrimitiveConverter {
  protected readonly primitiveType = 'loop' as const;
  private _currentScene?: CesiumScene;

  protected override getCollection(scene: CesiumScene): PrimitiveCollection {
    this._currentScene = scene;
    return scene.primitivesCollection;
  }

  protected override extractPrimitiveData(coordinateData: DecorationPrimitiveEntry[], primitiveType: string): DecorationPrimitiveEntry[] | undefined {
    if (!Array.isArray(coordinateData))
      return undefined;
    return coordinateData.filter((entry: DecorationPrimitiveEntry) => entry.type === primitiveType);
  }

  protected override createPrimitiveFromGraphic(
    graphic: RenderGraphicWithCoordinates,
    primitiveId: string,
    _index: number,
    _collection: PrimitiveCollection,
    iModel?: IModelConnection,
    originalData?: DecorationPrimitiveEntry[],
    _type?: string
  ): Primitive | undefined {
    const isLoopEntry = (e: DecorationPrimitiveEntry): e is LoopEntry => e.type === 'loop';
    const loopEntry = originalData?.find((e): e is LoopEntry => isLoopEntry(e));
    const loop: Loop | undefined = loopEntry?.loop;
    if (!loop)
      return undefined;

    const positions = this.convertLoopToPositions(loop, iModel);
    if (positions.length < 3)
      return undefined;

    const colors = this.extractFillAndLineColorsFromGraphic(graphic, 'loop');
    if (!colors)
      return undefined;
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
      return undefined;

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

  private removeDuplicateClosingPoint(positions: Cartesian3[]): Cartesian3[] {
    if (positions.length < 2)
      return positions;
    const first = positions[0];
    const last = positions[positions.length - 1];
    if (Cartesian3.equals(first, last))
      return positions.slice(0, -1);
    return positions;
  }
}

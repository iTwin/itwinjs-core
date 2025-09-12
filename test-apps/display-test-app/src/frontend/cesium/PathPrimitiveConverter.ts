/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { Cartesian3, Color, Material, Polyline, PolylineCollection } from "cesium";
import { IModelConnection } from "@itwin/core-frontend";
import { Path, Point3d, StrokeOptions } from "@itwin/core-geometry";
import { GraphicPrimitive } from "@itwin/core-frontend/lib/cjs/common/render/GraphicPrimitive";
import { CesiumScene } from "./Scene";
import { PrimitiveConverter } from "./PrimitiveConverter";

/** Converts iTwin.js Path decorations to Cesium Polyline primitives */
export class PathPrimitiveConverter extends PrimitiveConverter {
  protected readonly primitiveType = "path" as const;

  protected override getCollection(scene: CesiumScene): PolylineCollection {
    return scene.polylineCollection;
  }

  // For paths, keep the full primitive entries so we can access the Path object
  protected override extractPrimitiveData(coordinateData: GraphicPrimitive[] | undefined, primitiveType: string): any[] | undefined {
    if (!coordinateData || !Array.isArray(coordinateData)) return undefined;
    return coordinateData.filter((entry: GraphicPrimitive) => entry.type === primitiveType);
  }

  protected override createPrimitiveFromGraphic(
    _graphic: any,
    primitiveId: string,
    _index: number,
    collection: PolylineCollection,
    iModel?: IModelConnection,
    originalData?: any[],
    type?: string
  ): Polyline | null {
    try {
      // Prefer the captured Path object from coordinate data
      const pathEntry = Array.isArray(originalData)
        ? originalData.find((e) => e && e.type === "path" && e.path instanceof Path)
        : undefined;

      const path: Path | undefined = pathEntry?.path as Path | undefined;
      if (!path) {
        // No valid path found; nothing to draw
        return null;
      }

      // Densify the path to a point array using iTwin stroke options
      const strokeOptions = StrokeOptions.createForCurves();
      strokeOptions.chordTol = 0.01;
      const strokes = path.getPackedStrokes(strokeOptions);
      const pts: Point3d[] | undefined = strokes?.getPoint3dArray();
      if (!pts || pts.length === 0) return null;

      // Convert to Cesium coordinates using base helper
      const positions: Cartesian3[] = this.convertPointsToCartesian3(pts, iModel);

      // Choose a material color by decoration type for quick debugging
      const matColor = type === "worldOverlay" || type === "viewOverlay" ? Color.CYAN : Color.ORANGE;

      return collection.add({
        id: primitiveId,
        positions,
        width: 3,
        material: Material.fromType(Material.ColorType, { color: matColor }),
        ...this.getDepthOptions(type ?? "world"),
      });
    } catch (err) {
      console.error(`Error creating path primitive ${primitiveId}:`, err);
      return null;
    }
  }

  protected override getPrimitiveTypeName(): string {
    return "path";
  }

  protected override shouldSkipEmptyGraphics(): boolean {
    return true;
  }

  protected override getDepthOptions(decorationType: string): any {
    const base = super.getDepthOptions(decorationType);
    const isOverlay = decorationType === "worldOverlay" || decorationType === "viewOverlay";
    if (isOverlay) {
      return {
        ...base,
        clampToGround: false,
        distanceDisplayCondition: undefined,
      };
    }
    return base;
  }
}


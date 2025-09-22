/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Cartesian3, Material, Polyline, PolylineCollection } from "cesium";
import { IModelConnection } from "@itwin/core-frontend";
import { Path, Point3d, StrokeOptions } from "@itwin/core-geometry";
import { CesiumScene } from "../CesiumScene.js";
import { PrimitiveConverter, RenderGraphicWithCoordinates } from "./PrimitiveConverter.js";
import { DecorationPrimitiveEntry } from "./DecorationTypes.js";

/** Converts iTwin.js Path decorations to Cesium Polyline primitives */
export class PathPrimitiveConverter extends PrimitiveConverter {
  protected readonly primitiveType = "path" as const;

  protected override getCollection(scene: CesiumScene): PolylineCollection {
    return scene.polylineCollection;
  }

  // For paths, keep the full primitive entries so we can access the Path object
  protected override extractPrimitiveData(coordinateData: DecorationPrimitiveEntry[] | undefined, primitiveType: string): DecorationPrimitiveEntry[] | undefined {
    if (!coordinateData || !Array.isArray(coordinateData)) return undefined;
    return coordinateData.filter((entry: DecorationPrimitiveEntry) => entry.type === primitiveType);
  }

  protected override createPrimitiveFromGraphic(
    _graphic: RenderGraphicWithCoordinates,
    primitiveId: string,
    _index: number,
    collection: PolylineCollection,
    iModel?: IModelConnection,
    originalData?: unknown,
    type?: string
  ): Polyline | null {
      // Prefer the captured Path object from coordinate data
      const data = Array.isArray(originalData) ? (originalData as DecorationPrimitiveEntry[]) : undefined;
      const isPathEntry = (e: DecorationPrimitiveEntry): e is import('./DecorationTypes.js').PathEntry => e.type === 'path';
      const pathEntry = Array.isArray(data) ? data.find((e): e is import('./DecorationTypes.js').PathEntry => isPathEntry(e)) : undefined;
      const path: Path | undefined = pathEntry?.path;
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

      // Use symbology color when available
      const matColor = this.extractLineColorFromGraphic(_graphic, 'path');
      if (!matColor)
        return null;

      return collection.add({
        id: primitiveId,
        positions,
        width: 3,
        material: Material.fromType(Material.ColorType, { color: matColor }),
        ...this.getDepthOptions(type ?? "world"),
      });
    return null;
  }

  protected override getPrimitiveTypeName(): string {
    return "path";
  }

  protected override shouldSkipEmptyGraphics(): boolean {
    return true;
  }

  protected override getDepthOptions(decorationType: string): Record<string, unknown> {
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

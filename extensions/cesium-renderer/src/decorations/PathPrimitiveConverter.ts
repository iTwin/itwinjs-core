/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Cartesian3, Material, Polyline, PolylineCollection } from "@cesium/engine";
import { IModelConnection } from "@itwin/core-frontend";
import { Path, Point3d, StrokeOptions } from "@itwin/core-geometry";
import { CesiumScene } from "../CesiumScene.js";
import { type DepthOptions, PrimitiveConverter, type RenderGraphicWithCoordinates } from "./PrimitiveConverter.js";
import type { DecorationPrimitiveEntry, PathEntry } from "./DecorationTypes.js";

/** Converts iTwin.js Path decorations to Cesium Polyline primitives */
export class PathPrimitiveConverter extends PrimitiveConverter {
  protected readonly primitiveType = "path" as const;

  protected override getCollection(scene: CesiumScene): PolylineCollection {
    return scene.polylineCollection;
  }

  // For paths, keep the full primitive entries so we can access the Path object
  protected override extractPrimitiveData(coordinateData: DecorationPrimitiveEntry[], primitiveType: string): DecorationPrimitiveEntry[] | undefined {
    if (!Array.isArray(coordinateData)) return undefined;
    return coordinateData.filter((entry: DecorationPrimitiveEntry) => entry.type === primitiveType);
  }

  protected override createPrimitiveFromGraphic(
    _graphic: RenderGraphicWithCoordinates,
    primitiveId: string,
    _index: number,
    collection: PolylineCollection,
    iModel?: IModelConnection,
    originalData?: DecorationPrimitiveEntry[],
    type?: string
  ): Polyline | undefined {
      // Prefer the captured Path object from coordinate data
      const isPathEntry = (e: DecorationPrimitiveEntry): e is PathEntry => e.type === 'path';
      const pathEntry = originalData?.find((e): e is PathEntry => isPathEntry(e));
      const path: Path | undefined = pathEntry?.path;
      if (!path) {
        // No valid path found; nothing to draw
        return undefined;
      }

      // Densify the path to a point array using iTwin stroke options
      const strokeOptions = StrokeOptions.createForCurves();
      strokeOptions.chordTol = 0.01;
      const strokes = path.getPackedStrokes(strokeOptions);
      const pts: Point3d[] | undefined = strokes?.getPoint3dArray();
      if (!pts || pts.length === 0) return undefined;

      // Convert to Cesium coordinates using base helper
      const positions: Cartesian3[] = this.convertPointsToCartesian3(pts, iModel);

      // Use symbology color when available
      const matColor = this.extractLineColorFromGraphic(_graphic, 'path');
      if (!matColor)
        return undefined;

      return collection.add({
        id: primitiveId,
        positions,
        width: 3,
        material: Material.fromType(Material.ColorType, { color: matColor }),
        ...this.getDepthOptions(type ?? "world"),
      });
  }

  protected override getPrimitiveTypeName(): string {
    return "path";
  }

  protected override shouldSkipEmptyGraphics(): boolean {
    return true;
  }

  protected override getDepthOptions(decorationType: string): DepthOptions {
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

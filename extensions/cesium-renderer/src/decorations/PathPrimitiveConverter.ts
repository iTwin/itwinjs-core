/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { Cartesian3, Color, Material, Polyline, PolylineCollection } from "cesium";
import { ColorDef } from "@itwin/core-common";
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
      const matColor = this.extractColorFromGraphic(_graphic);
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

  private extractColorFromGraphic(graphic: RenderGraphicWithCoordinates): Color | undefined {
    // Prefer symbology captured in coordinateData entry
    const coordData = graphic?._coordinateData;
    const isPath = (e: DecorationPrimitiveEntry): e is import('./DecorationTypes.js').PathEntry => e.type === 'path';
    const entry = coordData?.find((e) => isPath(e) && !!e.symbology?.lineColor);
    const colorDefFromEntry = entry?.symbology?.lineColor;
    if (colorDefFromEntry) {
      const c1 = colorDefFromEntry.colors;
      const alpha = 255 - (c1.t ?? 0);
      return Color.fromBytes(c1.r, c1.g, c1.b, alpha);
    }

    interface HasSymbology { symbology?: { color?: ColorDef } }
    const hasSymbology = (g: unknown): g is HasSymbology => typeof g === 'object' && g !== null && ('symbology' in g);
    const symbology = hasSymbology(graphic) ? graphic.symbology : undefined;
    const colorDef = symbology?.color;
    if (colorDef) {
      const c = colorDef.colors;
      const alpha = 255 - (c.t ?? 0);
      return Color.fromBytes(c.r, c.g, c.b, alpha);
    }

    return undefined;
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

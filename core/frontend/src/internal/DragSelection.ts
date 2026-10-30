/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SelectionSet
 */

import { BentleyStatus, Id64, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import { ClipPlane, ClipPlaneContainment, ClipPrimitive, ClipUtilities, ClipVector, ConvexClipPlaneSet, Point2d, Point3d, Range2d, Range3d, Vector3d, XAndY } from "@itwin/core-geometry";
import { GeometryContainmentRequestProps, QueryRowFormat } from "@itwin/core-common";
import { Viewport } from "../Viewport";
import { ViewRect } from "../common/ViewRect";
import { Pixel } from "../render/Pixel";
import { ToolSettings } from "../tools/ToolSettings";
import { SelectionMethod } from "../tools/SelectTool";
import { AccuDrawHintBuilder } from "../AccuDraw";
import { IModelDisplayReference, SpatialIModelDisplayReference } from "../IModelDisplayReference";

type ElementIdsByIModelDisplayRef = Map<IModelDisplayReference, Id64Set>;
/** @internal */
export interface SelectionCandidate {
  id: Id64String;
  iModelRef: IModelDisplayReference;
}

class ElementSet {
  private readonly _ids: ElementIdsByIModelDisplayRef = new Map();

  public insert(elem: SelectionCandidate): void {
    let ids = this._ids.get(elem.iModelRef);
    if (!ids)
      this._ids.set(elem.iModelRef, ids = new Set());

    ids.add(elem.id);
  }

  public contains(elem: SelectionCandidate): boolean {
    return this._ids.get(elem.iModelRef)?.has(elem.id) ?? false;
  }

  public forEach(func: (elem: SelectionCandidate) => void): void {
    for (const [iModelRef, ids] of this._ids)
      for (const id of ids)
        func({ id, iModelRef });
  }

  public toElementIdsByIModelDisplayRef(): ElementIdsByIModelDisplayRef {
    return this._ids;
  }
}

function getAreaSelectionCandidates(vp: Viewport, origin: XAndY, corner: XAndY, method: SelectionMethod, allowOverlaps: boolean, allowExternalIModels: boolean, filter?: (elem: SelectionCandidate) => boolean): ElementIdsByIModelDisplayRef {
  let result: ElementIdsByIModelDisplayRef | undefined;

  const pts: Point2d[] = [];
  pts[0] = new Point2d(Math.floor(origin.x + 0.5), Math.floor(origin.y + 0.5));
  pts[1] = new Point2d(Math.floor(corner.x + 0.5), Math.floor(corner.y + 0.5));
  const range = Range2d.createArray(pts);

  const rect = new ViewRect();
  rect.initFromRange(range);
  vp.readPixels(rect, Pixel.Selector.Feature, (pixels) => {
    let contents: ElementSet = new ElementSet();
    if (undefined === pixels)
      return;

    const sRange = Range2d.createNull();
    sRange.extendPoint(Point2d.create(vp.cssPixelsToDevicePixels(range.low.x), vp.cssPixelsToDevicePixels(range.low.y)));
    sRange.extendPoint(Point2d.create(vp.cssPixelsToDevicePixels(range.high.x), vp.cssPixelsToDevicePixels(range.high.y)));

    pts[0].x = vp.cssPixelsToDevicePixels(pts[0].x);
    pts[0].y = vp.cssPixelsToDevicePixels(pts[0].y);

    pts[1].x = vp.cssPixelsToDevicePixels(pts[1].x);
    pts[1].y = vp.cssPixelsToDevicePixels(pts[1].y);

    const testPoint = Point2d.createZero();

    const getPixelElement = (pixel: Pixel.Data): SelectionCandidate | undefined => {
      if (undefined === pixel.elementId || Id64.isInvalid(pixel.elementId))
        return undefined; // no geometry at this location...

      const feature = pixel.feature;
      if (undefined === feature || !vp.isPixelSelectable(pixel))
        return undefined; // reality model, terrain, etc - not selectable

      if (!allowExternalIModels) {
        if (feature.iModelRef.iModel !== vp.iModel)
          return undefined;

        // Attachments use their own view's reference; allow their geometry from the primary connection, but exclude ordinary linked references.
        if (feature.iModelRef !== vp.primaryIModelRef && !pixel.viewAttachmentId && !pixel.inSectionDrawingAttachment)
          return undefined;
      }

      const element = {
        iModelRef: allowExternalIModels ? feature.iModelRef : vp.primaryIModelRef,
        id: pixel.elementId,
      };

      if (undefined !== filter && !filter(element))
        return undefined;

      return element;
    };

    if (SelectionMethod.Box === method) {
      const outline = allowOverlaps ? undefined : new ElementSet();
      const offset = sRange.clone();
      offset.expandInPlace(-2);
      for (testPoint.x = sRange.low.x; testPoint.x <= sRange.high.x; ++testPoint.x) {
        for (testPoint.y = sRange.low.y; testPoint.y <= sRange.high.y; ++testPoint.y) {
          const pixel = pixels.getPixel(testPoint.x, testPoint.y);
          const element = getPixelElement(pixel);
          if (undefined === element)
            continue;

          if (undefined !== outline && !offset.containsPoint(testPoint))
            outline.insert(element);
          else
            contents.insert(element);
        }
      }
      if (undefined !== outline) {
        const inside = new ElementSet();
        contents.forEach((id) => {
          if (!outline.contains(id))
            inside.insert(id);
        });

        contents = inside;
      }
    } else {
      const closePoint = Point2d.createZero();
      for (testPoint.x = sRange.low.x; testPoint.x <= sRange.high.x; ++testPoint.x) {
        for (testPoint.y = sRange.low.y; testPoint.y <= sRange.high.y; ++testPoint.y) {
          const pixel = pixels.getPixel(testPoint.x, testPoint.y);
          const element = getPixelElement(pixel);
          if (undefined === element)
            continue;

          const fraction = testPoint.fractionOfProjectionToLine(pts[0], pts[1], 0.0);
          pts[0].interpolate(fraction, pts[1], closePoint);
          if (closePoint.distance(testPoint) < 1.5)
            contents.insert(element);
        }
      }
    }

    result = contents.toElementIdsByIModelDisplayRef();
  }, true);

  return result ?? new Map();
}

async function getVolumeSelectionCandidates(vp: Viewport, origin: XAndY, corner: XAndY, allowOverlaps: boolean, allowExternalIModels: boolean, filter?: (elem: SelectionCandidate) => boolean): Promise<ElementIdsByIModelDisplayRef> {
  const result: ElementIdsByIModelDisplayRef = new Map();
  if (!vp.view.isSpatialView())
    return result;

  const boxRange = Range2d.createXYXY(origin.x, origin.y, corner.x, corner.y);
  if (boxRange.isNull || boxRange.isAlmostZeroX || boxRange.isAlmostZeroY)
    return result;

  const getClipPlane = (viewPt: Point2d, viewDir: Vector3d, negate: boolean): ClipPlane | undefined => {
    const point = vp.viewToWorld(Point3d.createFrom(viewPt));
    const boresite = AccuDrawHintBuilder.getBoresite(point, vp);
    const normal = viewDir.crossProduct(boresite.direction);

    if (negate)
      normal.negate(normal);

    return ClipPlane.createNormalAndPoint(normal, point)
  };

  const planeSet = ConvexClipPlaneSet.createEmpty();

  planeSet.addPlaneToConvexSet(getClipPlane(boxRange.low, vp.rotation.rowX(), true));
  planeSet.addPlaneToConvexSet(getClipPlane(boxRange.low, vp.rotation.rowY(), true));
  planeSet.addPlaneToConvexSet(getClipPlane(boxRange.high, vp.rotation.rowX(), false));
  planeSet.addPlaneToConvexSet(getClipPlane(boxRange.high, vp.rotation.rowY(), false));

  if (0 === planeSet.planes.length)
    return result;

  const clip = ClipVector.createCapture([ClipPrimitive.createCapture(planeSet)]);
  const viewRange = vp.computeViewRange();
  const range = ClipUtilities.rangeOfClipperIntersectionWithRange(clip, viewRange);

  if (range.isNull)
    return result;

  // TODO: Possible to make UnionOfComplexClipPlaneSets from view clip and planes work and remove 2nd containment check?
  const viewClip = (vp.viewFlags.clipVolume ? vp.view.getViewClip()?.clone() : undefined);
  if (viewClip) {
    const viewClipRange = ClipUtilities.rangeOfClipperIntersectionWithRange(viewClip, viewRange);
    if (viewClipRange.isNull || !viewClipRange.intersectsRange(range))
      return result;
  }

  const queries = [];
  for (const ref of vp.iModelRefs) {
    if (!ref.isSpatial() || (!allowExternalIModels && ref !== vp.primaryIModelRef))
      continue;

    queries.push((async () => {
      const elemFilter = filter ? (id: Id64String) => filter({ id, iModelRef: ref }) : undefined;

      const ids = await getVolumeSelectionCandidatesForIModel(ref, allowOverlaps, clip, range, viewClip, elemFilter);
      return { ids, iModelRef: ref };
    })());
  }

  const queryResults = await Promise.allSettled(queries);
  for (const queryResult of queryResults) {
    if (queryResult.status !== "fulfilled")
      continue;

    const value = queryResult.value;
    if (value.ids.size > 0)
      result.set(value.iModelRef, value.ids);
  }

  return result;
}

async function getVolumeSelectionCandidatesForIModel(ref: SpatialIModelDisplayReference, allowOverlaps: boolean, clip: ClipVector, range: Range3d, viewClip?: ClipVector, filter?: (elem: Id64String) => boolean): Promise<Id64Set> {
  const contents = new Set<Id64String>();
  const toIModel = ref.linearTransformToParent.inverse();
  if (!toIModel)
    return contents;

  clip = clip.clone();
  clip.transformInPlace(toIModel);
  range = toIModel.multiplyRange(range);

  const candidates: Id64Array = [];
  const categories = new Set<Id64String>();

  try {
    const viewedModels = Array.from(ref.viewedModels).join(",");
    const viewedCategories = Array.from(ref.viewedCategories).join(",");
    const ecsql = `SELECT e.ECInstanceId, Category.Id as category FROM bis.SpatialElement e JOIN bis.SpatialIndex i ON e.ECInstanceId=i.ECInstanceId WHERE Model.Id IN (${viewedModels}) AND Category.Id IN (${viewedCategories}) AND i.MinX <= ${range.xHigh} AND i.MinY <= ${range.yHigh} AND i.MinZ <= ${range.zHigh} AND i.MaxX >= ${range.xLow} AND i.MaxY >= ${range.yLow} AND i.MaxZ >= ${range.zLow}`;
    const reader = ref.iModel.createQueryReader(ecsql, undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyNames });

    for await (const row of reader) {
      candidates.push(row.ECInstanceId);
      categories.add(row.category);
    }
  } catch { }

  if (0 === candidates.length)
    return contents;

  let offSubCategories: Id64Array | undefined;
  if (0 !== categories.size) {
    for (const categoryId of categories) {
      const subcategories = ref.iModel.subcategories.getSubCategories(categoryId);
      if (undefined === subcategories)
        continue;

      for (const subCategoryId of subcategories) {
        const appearance = ref.getSubCategoryAppearance(subCategoryId);
        if (undefined === appearance || (!appearance.invisible && !appearance.dontLocate))
          continue;

        if (undefined === offSubCategories)
          offSubCategories = new Array<Id64String>;
        offSubCategories.push(subCategoryId);
      }
    }
  }

  const requestProps: GeometryContainmentRequestProps = {
    candidates,
    clip: clip.toJSON(),
    allowOverlaps,
    viewFlags: ref.activeViewFlags.toJSON(),
    offSubCategories,
  };

  const result = await ref.iModel.getGeometryContainment(requestProps);
  if (BentleyStatus.SUCCESS !== result.status || undefined === result.candidatesContainment)
    return contents;

  result.candidatesContainment.forEach((status: ClipPlaneContainment, index: number) => {
    if (ClipPlaneContainment.StronglyOutside !== status && (undefined === filter || filter(candidates[index])))
      contents.add(candidates[index]);
  });

  if (0 !== contents.size && viewClip) {
    viewClip = viewClip.clone();
    viewClip.transformInPlace(toIModel);

    requestProps.clip = viewClip.toJSON();
    requestProps.candidates.length = 0;
    for (const id of contents)
      requestProps.candidates.push(id);
    contents.clear();

    const resultViewClip = await ref.iModel.getGeometryContainment(requestProps);
    if (BentleyStatus.SUCCESS !== resultViewClip.status || undefined === resultViewClip.candidatesContainment)
      return contents;

    resultViewClip.candidatesContainment.forEach((status: ClipPlaneContainment, index: number) => {
      if (ClipPlaneContainment.StronglyOutside !== status)
        contents.add(requestProps.candidates[index]);
    });
  }

  return contents;
}

/** @internal */
export async function getAreaOrVolumeSelectionCandidates(vp: Viewport, origin: XAndY, corner: XAndY, method: SelectionMethod, allowOverlaps: boolean, allowExternalIModels: boolean, filter?: (elem: SelectionCandidate) => boolean, includeDecorationsForVolume?: boolean): Promise<ElementIdsByIModelDisplayRef> {
  let contents;

  if (ToolSettings.enableVolumeSelection && SelectionMethod.Box === method && vp.view.isSpatialView()) {
    contents = await getVolumeSelectionCandidates(vp, origin, corner, allowOverlaps, allowExternalIModels, filter);

    // Use area select to identify pickable transients...
    if (includeDecorationsForVolume) {
      const acceptTransientsFilter = (elem: SelectionCandidate) => { return Id64.isTransient(elem.id) && (undefined === filter || filter(elem)); };
      const transients = getAreaSelectionCandidates(vp, origin, corner, method, allowOverlaps, allowExternalIModels, acceptTransientsFilter);
      for (const [iModelRef, ids] of transients) {
        let set = contents.get(iModelRef);
        if (!set)
          contents.set(iModelRef, set = new Set<string>());

        for (const id of ids)
          set.add(id);
      }
    }
  } else {
    contents = getAreaSelectionCandidates(vp, origin, corner, method, allowOverlaps, allowExternalIModels, filter);
  }

  return contents;
}

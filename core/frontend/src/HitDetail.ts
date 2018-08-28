/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module LocatingElements */
import { Point3d, Vector3d, CurvePrimitive, XYZProps, Transform, Arc3d, LineSegment3d, LineString3d, Path } from "@bentley/geometry-core";
import { ScreenViewport } from "./Viewport";
import { Sprite, IconSprites } from "./Sprites";
import { IModelApp } from "./IModelApp";
import { Id64 } from "@bentley/bentleyjs-core";
import { DecorateContext } from "./ViewContext";
import { GraphicType } from "./render/GraphicBuilder";

export const enum SnapMode { // TODO: Don't intend to use this as a mask, maybe remove in favor of using KeypointType native equivalent...
  Nearest = 1,
  NearestKeypoint = 1 << 1,
  MidPoint = 1 << 2,
  Center = 1 << 3,
  Origin = 1 << 4,
  Bisector = 1 << 5,
  Intersection = 1 << 6,
}

export const enum SnapHeat {
  None = 0,
  NotInRange = 1,   // "of interest", but out of range
  InRange = 2,
}

/** The procedure that generated this Hit. */
export const enum HitSource {
  None = 0,
  FromUser = 1,
  MotionLocate = 2,
  AccuSnap = 3,
  TentativeSnap = 4,
  DataPoint = 5,
  Application = 6,
  EditAction = 7,
  EditActionSS = 8,
}

/**
 * What was being tested to generate this hit. This is not the element or
 * GeometricPrimitive that generated the Hit, it is an indication of whether it is an
 * edge or interior hit.
 */
export const enum HitGeomType {
  None = 0,
  Point = 1,
  Segment = 2,
  Curve = 3,
  Arc = 4,
  Surface = 5,
}

export const enum HitPriority {
  WireEdge = 0,
  PlanarEdge = 1,
  NonPlanarEdge = 2,
  SilhouetteEdge = 3,
  PlanarSurface = 4,
  NonPlanarSurface = 5,
  Unknown = 6,
}

export const enum HitDetailType {
  Hit = 1,
  Snap = 2,
  Intersection = 3,
}

/**
 * A HitDetail stores the result when locating geometry displayed in a view.
 * It holds an approximate location on an element (or decoration) from a *pick*.
 */
export class HitDetail {
  /**
   * Create a new HitDetail from the inputs to and results of a locate operation.
   * @param testPoint The world coordinate space point that was used as the locate point.
   * @param viewport The view the locate operation was performed in.
   * @param hitSource The procedure that requested the locate operation.
   * @param hitPoint The approximate world coordinate location on the geometry identified by this HitDetail.
   * @param sourceId The source of the geometry, either a persistent element id or pickable decoration id.
   * @param priority The hit geometry priority/classification.
   * @param distXY The xy distance to hit in view coordinates.
   * @param distFraction The near plane distance fraction to hit.
   */
  public constructor(public readonly testPoint: Point3d, public readonly viewport: ScreenViewport, public readonly hitSource: HitSource,
    public readonly hitPoint: Point3d, public readonly sourceId: string, public readonly priority: HitPriority, public readonly distXY: number, public readonly distFraction: number) { }

  /** Get the type of HitDetail.
   * @returns HitDetailType.Hit if this is a HitDetail, HitDetailType.Snap if it is a SnapDetail
   */
  public getHitType(): HitDetailType { return HitDetailType.Hit; }

  /** Get the *hit point* for this HitDetail. If this is a HitDetail, it returns the approximate point on the element that cause the hit.
   * If this is a SnapDetail, and if the snap is *hot*, returns the *exact* point on the Element for the snap mode.
   */
  public getPoint(): Point3d { return this.hitPoint; }

  /** Determine if this HitPoint is from the same source as another HitDetail. */
  public isSameHit(otherHit?: HitDetail): boolean { return (undefined !== otherHit && this.sourceId === otherHit.sourceId); }
  /** Return whether sourceId is for a persistent element and not a pickable decoration. */
  public get isElementHit(): boolean { return !Id64.isInvalidId(this.sourceId) && !Id64.isTransientId(this.sourceId); }
  /** Create a deep copy of this HitDetail */
  public clone(): HitDetail { const val = new HitDetail(this.testPoint, this.viewport, this.hitSource, this.hitPoint, this.sourceId, this.priority, this.distXY, this.distFraction); return val; }

  /** Draw this HitDetail as a Decoration. Causes the picked element to *flash* */
  public draw(_context: DecorateContext) { this.viewport.setFlashed(this.sourceId, 0.25); }

  /**
   * Get the tooltip string for this HitDetail.
   * Calls the backend method [Element.getToolTipMessage]($backend), and replaces all instances of `${localizeTag}` with localized string from IModelApp.i18n.
   */
  public async getToolTip(): Promise<string> {
    if (!this.isElementHit)
      return IModelApp.viewManager.getDecorationToolTip(this);

    const msg: string[] = await this.viewport.iModel.getToolTipMessage(this.sourceId); // wait for the locate message(s) from the backend
    // now combine all the lines into one string, replacing any instances of ${tag} with the translated versions.
    // Add "<br>" at the end of each line to cause them to come out on separate lines in the tooltip.
    let out = "";
    msg.forEach((line) => out += IModelApp.i18n.translateKeys(line) + "<br>");
    return out;
  }
}

/** A SnapDetail is generated from the result of [IModelDb.requestSnap]($backend) call. In addition to the HitDetail about the reason the element was *picked*,
 * it holds the *exact* point on the element from the snapping logic, plus additional information that varies with the type of element and snap mode.
 */
export class SnapDetail extends HitDetail {
  /** A sprite to show the user the type of snap performed */
  public sprite?: Sprite;
  /** HitPoint adjusted by snap */
  public readonly snapPoint: Point3d;
  /** AccuSnap/AccuDraw can adjust the point after the snap. */
  public readonly adjustedPoint: Point3d;
  /** Curve primitive for snap. */
  public primitive?: CurvePrimitive;
  /** Surface normal at snapPoint */
  public normal?: Vector3d;
  /** The HitGeomType of this SnapDetail */
  public geomType?: HitGeomType;

  /** Constructor for SnapDetail.
   * @param from The HitDetail that created this snap
   * @param snapMode The SnapMode used to create this SnapDetail
   * @param heat The SnapHeat of this SnapDetail
   * @param snapPoint The snapped point in the element
   */
  public constructor(from: HitDetail, public snapMode: SnapMode = SnapMode.Nearest, public heat: SnapHeat = SnapHeat.None, snapPoint?: XYZProps) {
    super(from.testPoint, from.viewport, from.hitSource, from.hitPoint, from.sourceId, from.priority, from.distXY, from.distFraction);
    this.snapPoint = Point3d.fromJSON(snapPoint ? snapPoint : from.hitPoint);
    this.adjustedPoint = this.snapPoint.clone();
    this.sprite = IconSprites.getSprite(SnapDetail.getSnapSprite(snapMode), from.viewport);
  }

  /** Returns `HitDetailType.Snap` */
  public getHitType(): HitDetailType { return HitDetailType.Snap; }
  /** Get the snap point if this SnapDetail is *hot*, the pick point otherwise. */
  public getPoint(): Point3d { return this.isHot ? this.snapPoint : super.getPoint(); }
  /** Return true if the pick point was closer than [SnapRequestProps.snapAperture]($common) from the generated snap point. */
  public get isHot(): boolean { return this.heat !== SnapHeat.None; }
  /** Determine whether the [[adjustedPoint]] is different than the [[snapPoint]]. This happens, for example, when points are adjusted for grids, acs plane snap, and AccuDraw. */
  public get isPointAdjusted(): boolean { return !this.adjustedPoint.isExactEqual(this.snapPoint); }
  /** Change the snap point. */
  public setSnapPoint(point: Point3d, heat: SnapHeat) { this.snapPoint.setFrom(point); this.adjustedPoint.setFrom(point); this.heat = heat; }

  /** Set curve primitive and HitGeometryType for this SnapDetail. */
  public setCurvePrimitive(primitive?: CurvePrimitive, localToWorld?: Transform, geomType?: HitGeomType): void {
    this.primitive = primitive;
    this.geomType = undefined;

    // Only HitGeomType.Point and HitGeomType.Surface are valid without a curve primitive.
    if (undefined === this.primitive) {
      if (HitGeomType.Point === geomType || HitGeomType.Surface === geomType)
        this.geomType = geomType;
      return;
    }

    if (undefined !== localToWorld)
      this.primitive.tryTransformInPlace(localToWorld);

    if (this.primitive instanceof Arc3d)
      this.geomType = HitGeomType.Arc;
    else if (this.primitive instanceof LineSegment3d)
      this.geomType = HitGeomType.Segment;
    else if (this.primitive instanceof LineString3d)
      this.geomType = HitGeomType.Segment;
    else
      this.geomType = HitGeomType.Curve;

    // Set curve primitive geometry type override...
    //  - HitGeomType.Point with arc/ellipse denotes center.
    //  - HitGeomType.Surface with any curve primitive denotes an interior hit.
    if (undefined !== geomType && HitGeomType.None !== geomType)
      this.geomType = geomType;
  }

  /** Make a copy of this SnapDetail. */
  public clone(): SnapDetail {
    const val = new SnapDetail(this, this.snapMode, this.heat, this.snapPoint);
    val.sprite = this.sprite;
    val.geomType = this.geomType;
    val.adjustedPoint.setFrom(this.adjustedPoint);
    if (undefined !== this.primitive)
      val.primitive = this.primitive.clone() as CurvePrimitive;
    if (undefined !== this.normal)
      val.normal = this.normal.clone();
    return val;
  }

  public draw(context: DecorateContext) {
    if (undefined !== this.primitive) {
      const builder = context.createGraphicBuilder(GraphicType.WorldOverlay);
      builder.setSymbology(context.viewport.hilite.color, context.viewport.hilite.color, 2); // ### TODO Get weight from SnapResponse + SubCategory Appearance...

      switch (this.snapMode) {
        case SnapMode.Center:
        case SnapMode.Origin:
        case SnapMode.Bisector:
          break; // Snap point for these is computed using entire linestring, not just the hit segment...

        default: {
          if (this.primitive instanceof LineString3d) {
            const ls = this.primitive as LineString3d;
            if (ls.points.length > 2) {
              const loc = ls.closestPoint(this.snapPoint, false);
              const nSegments = ls.points.length - 1;
              const uSegRange = (1.0 / nSegments);
              let segmentNo = Math.floor(loc.fraction / uSegRange);
              if (segmentNo >= nSegments)
                segmentNo = nSegments - 1;
              const points: Point3d[] = [ls.points[segmentNo].clone(), ls.points[segmentNo + 1].clone()];
              builder.addLineString(points);
              context.addDecorationFromBuilder(builder);
              return;
            }
          }
          break;
        }
      }

      builder.addPath(Path.create(this.primitive));
      context.addDecorationFromBuilder(builder);
      return;
    }
    super.draw(context);
  }

  /**  */
  private static getSnapSprite(snapType: SnapMode): string {
    switch (snapType) {
      case SnapMode.Nearest: return "SnapPointOn";
      case SnapMode.NearestKeypoint: return "SnapKeypoint";
      case SnapMode.MidPoint: return "SnapMidpoint";
      case SnapMode.Center: return "SnapCenter";
      case SnapMode.Origin: return "SnapOrigin";
      case SnapMode.Bisector: return "SnapBisector";
      case SnapMode.Intersection: return "SnapIntersection";
    }
    return "";
  }
}

export class IntersectDetail extends SnapDetail {
  public secondHit?: SnapDetail;
}

/**
 * The result of a "locate" is a sorted list of objects that satisfied the search criteria (a HitList). Earlier hits in the list
 *  are somehow *better* than those later on.
 */
export class HitList<T extends HitDetail> {
  public hits: T[] = [];
  public currHit = -1;
  public get length(): number { return this.hits.length; }
  public empty(): void { this.hits.length = 0; this.currHit = -1; }
  public resetCurrentHit(): void { this.currHit = -1; }

  /**
   * get a hit from a particular index into a HitList
   * return the requested hit from the HitList or undefined
   */
  public getHit(hitNum: number): T | undefined {
    if (hitNum < 0) hitNum = this.length - 1;
    return (hitNum >= this.length) ? undefined : this.hits[hitNum];
  }

  /** When setting one or more indices to undefined you must call dropNulls afterwards */
  public setHit(i: number, p: T | undefined): void {
    if (i < 0 || i >= this.length)
      return;
    this.hits[i] = p!;
  }

  public dropNulls(): void {
    const hits = this.hits;
    this.hits = [];
    for (const hit of hits)
      this.hits.push(hit);
  }

  public getNextHit(): T | undefined { this.currHit++; return this.getCurrentHit(); }
  public getCurrentHit(): T | undefined { return -1 === this.currHit ? undefined : this.getHit(this.currHit); }

  public setCurrentHit(hit: T): void {
    this.resetCurrentHit();
    for (let thisHit; undefined !== (thisHit = this.getNextHit());) {
      if (thisHit === hit)
        return;
    }
  }

  /** remove the current hit from the list. */
  public removeCurrentHit() { this.removeHit(this.currHit); }

  /** remove a hit in the list. */
  public removeHit(hitNum: number) {
    if (hitNum < 0)                   // Support -1 == END
      hitNum = this.length - 1;

    if (hitNum <= this.currHit)
      this.currHit = -1;

    if (hitNum >= this.length)        // Locate calls GetNextHit, which increments currHit, until it goes beyond the end of size of the array.
      return;                         // Then Reset call RemoteCurrentHit, which passes in currHit. When it is out of range, we do nothing.

    this.hits.splice(hitNum, 1);
  }

  /** search through list and remove any hits that contain a specified element id. */
  public removeHitsFrom(sourceId: string): boolean {
    let removedOne = false;

    // walk backwards through list so we don't have to worry about what happens on remove
    for (let i = this.length - 1; i >= 0; i--) {
      const thisHit = this.hits[i];
      if (thisHit && sourceId === thisHit.sourceId) {
        removedOne = true;
        this.removeHit(i);
      }
    }
    return removedOne;
  }

  private getPriorityZOverride(priority: HitPriority): number {
    switch (priority) {
      case HitPriority.WireEdge:
      case HitPriority.PlanarEdge:
      case HitPriority.NonPlanarEdge:
        return 0;
      case HitPriority.SilhouetteEdge:
        return 1;
      case HitPriority.PlanarSurface:
      case HitPriority.NonPlanarSurface:
        return 2;
      default:
        return 3;
    }
  }

  /** compare two hits for insertion into list. */
  public compare(hit1: HitDetail | undefined, hit2: HitDetail | undefined): -1 | 1 | 0 {
    if (!hit1 || !hit2)
      return 0;

    const zOverride1 = this.getPriorityZOverride(hit1.priority);
    const zOverride2 = this.getPriorityZOverride(hit2.priority);

    // Prefer edges over surfaces, this is more important than z because we know the edge isn't obscured...
    if (zOverride1 < zOverride2) return -1;
    if (zOverride1 > zOverride2) return 1;

    // Compare xy distance from pick point, prefer hits closer to center...
    if (hit1.distXY < hit2.distXY) return -1;
    if (hit1.distXY > hit2.distXY) return 1;

    // Compare distance fraction, prefer hits closer to eye...
    if (hit1.distFraction > hit2.distFraction) return -1;
    if (hit1.distFraction < hit2.distFraction) return 1;

    // Compare geometry class, prefer path/region hits over surface hits when all else is equal...
    if (hit1.priority < hit2.priority) return -1;
    if (hit1.priority > hit2.priority) return 1;

    return 0;
  }

  /** Add a new hit to the list. Hits are sorted according to their priority and distance. */
  public addHit(newHit: T): number {
    if (0 === this.hits.length) {
      this.hits.push(newHit);
      return 0;
    }
    let index = 0;
    for (; index < this.hits.length; ++index) {
      const oldHit = this.hits[index];
      const comparison = this.compare(newHit, oldHit);
      if (comparison < 0)
        break;
    }

    this.hits.splice(index, 0, newHit);
    return index;
  }

  /** Insert a new hit into the list at the supplied index. */
  public insertHit(i: number, hit: T): void {
    if (i < 0 || i >= this.length)
      this.hits.push(hit);
    else
      this.hits.splice(i, 0, hit);
  }
}

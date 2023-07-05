/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module LocatingElements
 */
import { assert, Id64, Id64String } from "@itwin/core-bentley";
import { Arc3d, CurvePrimitive, LineSegment3d, LineString3d, Path, Point3d, Transform, Vector3d, XYZProps } from "@itwin/core-geometry";
import { GeometryClass, LinePixels } from "@itwin/core-common";
import { IModelApp } from "./IModelApp";
import { IModelConnection } from "./IModelConnection";
import { GraphicType } from "./render/GraphicBuilder";
import { IconSprites, Sprite } from "./Sprites";
import { DecorateContext } from "./ViewContext";
import { ScreenViewport, Viewport } from "./Viewport";

/**
 * @public
 * @extensions
 */
export enum SnapMode {
  Nearest = 1,
  NearestKeypoint = 1 << 1,
  MidPoint = 1 << 2,
  Center = 1 << 3,
  Origin = 1 << 4,
  Bisector = 1 << 5,
  Intersection = 1 << 6,
}

/**
 * @public
 * @extensions
 */
export enum SnapHeat {
  None = 0,
  NotInRange = 1,   // "of interest", but out of range
  InRange = 2,
}

/** The procedure that generated this Hit.
 * @public
 * @extensions
 */
export enum HitSource {
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

/** What was being tested to generate this hit. This is not the element or
 * GeometricPrimitive that generated the Hit, it is an indication of whether it is an edge or interior hit.
 * @public
 * @extensions
 */
export enum HitGeomType {
  None = 0,
  Point = 1,
  Segment = 2,
  Curve = 3,
  Arc = 4,
  Surface = 5,
}

/** Classification of GeometricPrimitive that generated the Hit.
 * @public
 * @extensions
 */
export enum HitParentGeomType {
  None = 0,
  Wire = 1,
  Sheet = 2,
  Solid = 3,
  Mesh = 4,
  Text = 5,
}

/**
 * @public
 * @extensions
 */
export enum HitPriority {
  WireEdge = 0,
  PlanarEdge = 1,
  NonPlanarEdge = 2,
  SilhouetteEdge = 3,
  PlanarSurface = 4,
  NonPlanarSurface = 5,
  Unknown = 6,
}

/**
 * @public
 * @extensions
 */
export enum HitDetailType {
  Hit = 1,
  Snap = 2,
  Intersection = 3,
}

/** Describes the [ViewAttachment]($backend), if any, from which the hit represented by a [[HitDetail]] originated.
 * @note Only [[SheetViewState]]s contain view attachments.
 * @beta
 */
export interface ViewAttachmentHitInfo {
  /** The element Id of the [ViewAttachment]($backend) from which the hit originated. */
  readonly id: Id64String;
  /** The viewport that renders the contents of the attached view into the [[ScreenViewport]].
   * @alpha
   */
  readonly viewport: Viewport;
}

/** Arguments supplied to the [[HitDetail]] constructor.
 * @public
 */
export interface HitDetailProps {
  /** The point in world coordinates that was used as the initial locate point. */
  readonly testPoint: Point3d;
  /** The viewport in which the locate operation was performed. */
  readonly viewport: ScreenViewport;
  /** The procedure that requested the locate operation. */
  readonly hitSource: HitSource;
  /** The approximate location in world coordinates on the geometry identified by this HitDetail. */
  readonly hitPoint: Point3d;
  /** The source of the geometry. This may be a persistent element Id, or a transient Id used for, e.g., pickable decorations. */
  readonly sourceId: Id64String;
  /** The hit geometry priority/classification. */
  readonly priority: HitPriority;
  /** The xy distance to the hit in view coordinates. */
  readonly distXY: number;
  /** The distance in view coordinates between the hit and the near plane. */
  readonly distFraction: number;
  /** The [SubCategory]($backend) to which the hit geometry belongs. */
  readonly subCategoryId?: Id64String;
  /** The class of the hit geometry. */
  readonly geometryClass?: GeometryClass;
  /** The Id of the [[ModelState]] from which the hit originated. */
  readonly modelId?: string;
  /** The IModelConnection from which the hit originated.
   * This should almost always be left undefined, unless the hit is known to have originated from an iModel
   * other than the one associated with the viewport.
   * @internal
   */
  readonly sourceIModel?: IModelConnection;
  /** @internal chiefly for debugging */
  readonly tileId?: string;
  /** True if the hit originated from a reality model classifier.
   * @alpha
   */
  readonly isClassifier?: boolean;
  /** Information about the [ViewAttachment]($backend) within which the hit geometry resides, if any.
   * @note Only [[SheetViewState]]s can have view attachments.
   * @beta
   */
  readonly viewAttachment?: ViewAttachmentHitInfo;
}

/** A HitDetail stores the result when locating geometry displayed in a view.
 * It holds an approximate location on an element (or decoration) from a *pick*.
 * @public
 * @extensions
 */
export class HitDetail {
  private readonly _props: HitDetailProps;

  /** The point in world coordinates that was used as the initial locate point. */
  public get testPoint(): Point3d { return this._props.testPoint; }
  /** The viewport in which the locate operation was performed. */
  public get viewport(): ScreenViewport { return this._props.viewport; }
  /** The procedure that requested the locate operation. */
  public get hitSource(): HitSource { return this._props.hitSource; }
  /** The approximate location in world coordinates on the geometry identified by this HitDetail. */
  public get hitPoint(): Point3d { return this._props.hitPoint; }
  /** The source of the geometry. This may be a persistent element Id, or a transient Id used for, e.g., pickable decorations. */
  public get sourceId(): Id64String { return this._props.sourceId; }
  /** The hit geometry priority/classification. */
  public get priority(): HitPriority { return this._props.priority; }
  /** The xy distance to the hit in view coordinates. */
  public get distXY(): number { return this._props.distXY; }
  /** The distance in view coordinates between the hit and the near plane. */
  public get distFraction(): number { return this._props.distFraction; }
  /** The [SubCategory]($backend) to which the hit geometry belongs. */
  public get subCategoryId(): Id64String | undefined { return this._props.subCategoryId; }
  /** The class of the hit geometry. */
  public get geometryClass(): GeometryClass | undefined { return this._props.geometryClass; }
  /** The Id of the [[ModelState]] from which the hit originated. */
  public get modelId(): string | undefined { return this._props.modelId; }
  /** The IModelConnection from which the hit originated.
   * This should almost always be left undefined, unless the hit is known to have originated from an iModel
   * other than the one associated with the viewport.
   * @internal
   */
  public get sourceIModel(): IModelConnection | undefined { return this._props.sourceIModel; }
  /** @internal chiefly for debugging */
  public get tileId(): string | undefined { return this._props.tileId; }
  /** True if the hit originated from a reality model classifier.
   * @alpha
   */
  public get isClassifier(): boolean | undefined { return this._props.isClassifier; }
  /** Information about the [ViewAttachment]($backend) within which the hit geometry resides, if any.
   * @note Only [[SheetViewState]]s can have view attachments.
   * @beta
   */
  public get viewAttachment(): ViewAttachmentHitInfo | undefined { return this._props.viewAttachment; }

  /** Create a new HitDetail from the inputs to and results of a locate operation. */
  public constructor(props: HitDetailProps);

  /** @deprecated in 4.1. Use the overload that takes a [[HitDetailProps]]. */
  public constructor(testPoint: Point3d, viewport: ScreenViewport, hitSource: HitSource, hitPoint: Point3d, sourceId: string, priority: HitPriority, distXY: number, distFraction: number, subCategoryId?: string, geometryClass?: GeometryClass, modelId?: string, sourceIModel?: IModelConnection, tileId?: string, isClassifier?: boolean);

  /** @internal */
  public constructor(arg0: Point3d | HitDetailProps, viewport?: ScreenViewport, hitSource?: HitSource, hitPoint?: Point3d, sourceId?: string, priority?: HitPriority, distXY?: number, distFraction?: number, subCategoryId?: string, geometryClass?: GeometryClass, modelId?: string, sourceIModel?: IModelConnection, tileId?: string, isClassifier?: boolean) {
    if (arg0 instanceof Point3d) {
      assert(undefined !== viewport && undefined !== hitSource && undefined !== hitPoint && undefined !== sourceId);
      assert(undefined !== priority && undefined !== distXY && undefined !== distFraction);

      this._props = {
        testPoint: arg0,
        viewport,
        hitSource,
        hitPoint,
        sourceId,
        priority,
        distXY,
        distFraction,
        subCategoryId,
        geometryClass,
        modelId,
        sourceIModel,
        tileId,
        isClassifier,
      };
    } else {
      // Tempting to use { ...arg0 } but spread operator omits getters so, e.g., if input is a HitDetail we would lose all the properties.
      this._props = {
        testPoint: arg0.testPoint,
        viewport: arg0.viewport,
        hitSource: arg0.hitSource,
        hitPoint: arg0.hitPoint,
        sourceId: arg0.sourceId,
        priority: arg0.priority,
        distXY: arg0.distXY,
        distFraction: arg0.distFraction,
        subCategoryId: arg0.subCategoryId,
        geometryClass: arg0.geometryClass,
        modelId: arg0.modelId,
        sourceIModel: arg0.sourceIModel,
        tileId: arg0.tileId,
        isClassifier: arg0.isClassifier,
        viewAttachment: arg0.viewAttachment,
      };
    }
  }

  /** Get the type of HitDetail.
   * @returns HitDetailType.Hit if this is a HitDetail, HitDetailType.Snap if it is a SnapDetail
   */
  public getHitType(): HitDetailType { return HitDetailType.Hit; }

  /** Get the *hit point* for this HitDetail. Returns the approximate point on the element that caused the hit when not a SnapDetail or IntersectDetail.
   * For a snap that is *hot*, the *exact* point on the Element for the snap mode is returned, otherwise the close point on the hit geometry is returned.
   */
  public getPoint(): Point3d { return this.hitPoint; }

  /** Determine if this HitPoint is from the same source as another HitDetail. */
  public isSameHit(otherHit?: HitDetail): boolean { return (undefined !== otherHit && this.sourceId === otherHit.sourceId && this.iModel === otherHit.iModel); }
  /** Return whether sourceId is for a persistent element and not a pickable decoration. */
  public get isElementHit(): boolean { return !Id64.isInvalid(this.sourceId) && !Id64.isTransient(this.sourceId); }
  // return whether the sourceId is for a model (reality models etc.)
  public get isModelHit(): boolean {
    return this.modelId === this.sourceId;
  }
  // return whether the hit point is from map.
  public get isMapHit(): boolean { return 0 !== this.viewport.mapLayerFromHit(this).length; }

  /** Create a deep copy of this HitDetail */
  public clone(): HitDetail {
    return new HitDetail(this);
  }

  /** Draw this HitDetail as a Decoration. Causes the picked element to *flash* */
  public draw(_context: DecorateContext) {
    this.viewport.flashedId = this.sourceId;
  }

  /** Get the tooltip content for this HitDetail. */
  public async getToolTip(): Promise<HTMLElement | string> {
    let toolTipPromise = this.isElementHit ? IModelApp.viewManager.overrideElementToolTip(this) : IModelApp.viewManager.getDecorationToolTip(this);
    for (const toolTipProvider of IModelApp.viewManager.toolTipProviders)
      toolTipPromise = toolTipProvider.augmentToolTip(this, toolTipPromise);
    return toolTipPromise;
  }

  /** The IModelConnection from which the hit originated. In some cases this may not be the same as the iModel associated with the Viewport -
   * for example, if a [[TiledGraphicsProvider]] is used to display graphics from a different iModel in the viewport.
   * This HitDetail's element, subcategory, and model Ids are defined in the context of this IModelConnection.
   */
  public get iModel(): IModelConnection {
    return this.sourceIModel ?? this.viewport.iModel;
  }

  /** Returns true if this hit originated from an [[IModelConnection]] other than the one associated with the [[Viewport]].
   * @see [[iModel]].
   */
  public get isExternalIModelHit(): boolean {
    return this.iModel !== this.viewport.iModel;
  }
}

/** A SnapDetail is generated from the result of a snap request. In addition to the HitDetail about the reason the element was *picked*,
 * it holds the *exact* point on the element from the snapping logic, plus additional information that varies with the type of element and snap mode.
 * @public
 * @extensions
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
  /** The HitGeomType of this SnapDetail */
  public parentGeomType?: HitParentGeomType;

  /** Constructor for SnapDetail.
   * @param from The HitDetail that created this snap
   * @param snapMode The SnapMode used to create this SnapDetail
   * @param heat The SnapHeat of this SnapDetail
   * @param snapPoint The snapped point in the element
   */
  public constructor(from: HitDetail, public snapMode: SnapMode = SnapMode.Nearest, public heat: SnapHeat = SnapHeat.None, snapPoint?: XYZProps) {
    super(from);
    this.snapPoint = Point3d.fromJSON(snapPoint ? snapPoint : from.hitPoint);
    this.adjustedPoint = this.snapPoint.clone();
    this.sprite = IconSprites.getSpriteFromUrl(SnapDetail.getSnapSpriteUrl(snapMode));
  }

  /** Returns `HitDetailType.Snap` */
  public override getHitType(): HitDetailType { return HitDetailType.Snap; }
  /** Get the snap point if this SnapDetail is *hot*, the pick point otherwise. */
  public override getPoint(): Point3d { return this.isHot ? this.snapPoint : super.getPoint(); }
  /** Return true if the pick point was closer than the snap aperture from the generated snap point. */
  public get isHot(): boolean { return this.heat !== SnapHeat.None; }
  /** Determine whether the [[adjustedPoint]] is different than the [[snapPoint]]. This happens, for example, when points are adjusted for grids, acs plane snap, and AccuDraw. */
  public get isPointAdjusted(): boolean { return !this.adjustedPoint.isExactEqual(this.snapPoint); }
  /** Change the snap point. */
  public setSnapPoint(point: Point3d, heat: SnapHeat) {
    this.snapPoint.setFrom(point);
    this.adjustedPoint.setFrom(point);
    this.heat = heat;
  }

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
  public override clone(): SnapDetail {
    const val = new SnapDetail(this, this.snapMode, this.heat, this.snapPoint);
    val.sprite = this.sprite;
    val.geomType = this.geomType;
    val.parentGeomType = this.parentGeomType;
    val.adjustedPoint.setFrom(this.adjustedPoint);
    if (undefined !== this.primitive)
      val.primitive = this.primitive.clone();
    if (undefined !== this.normal)
      val.normal = this.normal.clone();
    return val;
  }

  public getCurvePrimitive(singleSegment: boolean = true): CurvePrimitive | undefined {
    if (!singleSegment || undefined === this.primitive)
      return this.primitive;

    if (this.primitive instanceof LineString3d) {
      const ls = this.primitive;
      if (ls.points.length > 2) {
        const loc = ls.closestPoint(this.snapPoint, false);
        const nSegments = ls.points.length - 1;
        const uSegRange = (1.0 / nSegments);
        let segmentNo = Math.floor(loc.fraction / uSegRange);
        if (segmentNo >= nSegments)
          segmentNo = nSegments - 1;
        return LineSegment3d.create(ls.points[segmentNo], ls.points[segmentNo + 1]);
      }
    }

    return this.primitive;
  }

  public override draw(context: DecorateContext) {
    if (undefined !== this.primitive) {
      let singleSegment = false;
      switch (this.snapMode) {
        case SnapMode.Center:
        case SnapMode.Origin:
        case SnapMode.Bisector:
          break; // Snap point for these is computed using entire linestring, not just the hit segment...

        default: {
          singleSegment = true;
          break;
        }
      }

      const builder = context.createGraphicBuilder(GraphicType.WorldOverlay);
      const outline = context.viewport.hilite.color.adjustedForContrast(context.viewport.view.backgroundColor, 50);
      const centerLine = context.viewport.hilite.color.adjustedForContrast(outline, 175);
      const path = Path.create(this.getCurvePrimitive(singleSegment)!);

      builder.setSymbology(outline, outline, 6);
      builder.addPath(path);

      builder.setSymbology(centerLine, centerLine, 2);
      builder.addPath(path);

      context.addDecorationFromBuilder(builder);
      return;
    }
    super.draw(context);
  }

  private static getSnapSpriteUrl(snapType: SnapMode): string {
    switch (snapType) {
      case SnapMode.Nearest: return `${IModelApp.publicPath}sprites/SnapPointOn.png`;
      case SnapMode.NearestKeypoint: return `${IModelApp.publicPath}sprites/SnapKeypoint.png`;
      case SnapMode.MidPoint: return `${IModelApp.publicPath}sprites/SnapMidpoint.png`;
      case SnapMode.Center: return `${IModelApp.publicPath}sprites/SnapCenter.png`;
      case SnapMode.Origin: return `${IModelApp.publicPath}sprites/SnapOrigin.png`;
      case SnapMode.Bisector: return `${IModelApp.publicPath}sprites/SnapBisector.png`;
      case SnapMode.Intersection: return `${IModelApp.publicPath}sprites/SnapIntersection.png`;
    }
    return "";
  }
}

/**
 * @public
 * @extensions
 */
export class IntersectDetail extends SnapDetail {
  public constructor(from: SnapDetail, heat: SnapHeat = SnapHeat.None, snapPoint: XYZProps, public readonly otherPrimitive: CurvePrimitive, public readonly otherId: string) {
    super(from, SnapMode.Intersection, heat, snapPoint);
    this.primitive = from.primitive;
    this.normal = from.normal; // Preserve normal from primary snap location for AccuDraw smart rotation...
  }

  public override draw(context: DecorateContext) {
    if (undefined !== this.primitive && undefined !== this.otherPrimitive) {
      const builder = context.createGraphicBuilder(GraphicType.WorldOverlay);
      const outline = context.viewport.hilite.color.adjustedForContrast(context.viewport.view.backgroundColor, 50);
      const centerLine = context.viewport.hilite.color.adjustedForContrast(outline, 175);
      const path1 = Path.create(this.primitive);
      const path2 = Path.create(this.otherPrimitive);

      builder.setSymbology(outline, outline, 6);
      builder.addPath(path1);
      builder.addPath(path2);

      builder.setSymbology(centerLine, centerLine, 2);
      builder.addPath(path1);
      builder.setSymbology(centerLine, centerLine, 2, LinePixels.Code2);
      builder.addPath(path2);

      context.addDecorationFromBuilder(builder);
      return;
    }
    super.draw(context);
  }
}

/** The result of a "locate" is a sorted list of objects that satisfied the search criteria (a HitList). Earlier hits in the list
 * are somehow *better* than those later on.
 * @public
 * @extensions
 */
export class HitList<T extends HitDetail> {
  public hits: T[] = [];
  public currHit = -1;
  public get length(): number { return this.hits.length; }
  public empty(): void {
    this.hits.length = 0;
    this.currHit = -1;
  }

  public resetCurrentHit(): void { this.currHit = -1; }

  /** Get a hit from a particular index into a HitList
   * return the requested hit from the HitList or undefined
   */
  public getHit(hitNum: number): T | undefined {
    if (hitNum < 0)
      hitNum = this.length - 1;

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

  public getNextHit(): T | undefined {
    this.currHit++;
    return this.getCurrentHit();
  }

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
    if (zOverride1 < zOverride2)
      return -1;
    if (zOverride1 > zOverride2)
      return 1;

    // Compare xy distance from pick point, prefer hits closer to center...
    if (hit1.distXY < hit2.distXY)
      return -1;
    if (hit1.distXY > hit2.distXY)
      return 1;

    // Compare distance fraction, prefer hits closer to eye...
    if (hit1.distFraction > hit2.distFraction)
      return -1;
    if (hit1.distFraction < hit2.distFraction)
      return 1;

    // Compare geometry class, prefer path/region hits over surface hits when all else is equal...
    if (hit1.priority < hit2.priority)
      return -1;
    if (hit1.priority > hit2.priority)
      return 1;

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

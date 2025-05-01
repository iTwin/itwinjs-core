/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Editing
 */

import { DialogItem, DialogProperty, DialogPropertySyncItem, PropertyDescriptionHelper } from "@itwin/appui-abstract";
import { CompressedId64Set, Id64String } from "@itwin/core-bentley";
import { Code, ColorDef, ElementGeometry, ElementGeometryInfo, FlatBufferGeometryStream, GeometricElementProps, GeometryParams, GeometryStreamProps, isPlacement3dProps, JsonGeometryStream, LinePixels, PlacementProps } from "@itwin/core-common";
import { AccuDrawHintBuilder, BeButton, BeButtonEvent, BeModifierKeys, DecorateContext, DynamicsContext, EventHandled, GraphicType, HitDetail, IModelApp, NotifyMessageDetails, OutputMessagePriority, SnapDetail, TentativeOrAccuSnap, Viewport } from "@itwin/core-frontend";
import { Arc3d, BSplineCurve3d, CurveCollection, CurvePrimitive, FrameBuilder, Geometry, GeometryQuery, IModelJson, InterpolationCurve3d, LineString3d, Loop, Matrix3d, Path, Plane3dByOriginAndUnitNormal, Point3d, PointString3d, RegionOps, Vector3d, YawPitchRollAngles } from "@itwin/core-geometry";
import { editorBuiltInCmdIds } from "@itwin/editor-common";
import { basicManipulationIpc, CreateElementWithDynamicsTool, EditTools } from "@itwin/editor-frontend";

/** Values for [[CreateOrContinueTool.createCurvePhase] to support join and closure. */
enum CreateCurvePhase {
  /** Current tool phase changes CurvePrimitive startPoint.
   * ex. Arc defined by center, start would return this when accepted length is 1.
   */
  DefineStart,
  /** Current tool phase changes CurvePrimitive endPoint.
   * ex. Arc defined by start, end, mid would return this when accepted length is 1.
   */
  DefineEnd,
  /** Current tool phase does NOT change CurvePrimitive startPoint or endPoint.
   * ex. When defining arc mid point, or start and end tangents for a spline curve return this.
   */
  DefineOther,
}

namespace EditingTools {
  export function translate(str: string) { return str; }
}

namespace CheckedElementCache {
  export function getDefaultElementClass(is3d: boolean): string {
    return (is3d ? "Generic:PhysicalObject" : "BisCore:DrawingGraphic");
  }
}

namespace Sketch {
  export interface Assistant {
    /** Whether to allow the Path or CurvePrimitive, that is not physically closed, from the supplied element to be continued.
     * When returning a new GeometricElementProps, if the element id is undefined the tool will
     * use delete/insert instead of update in order to support an element class change (i.e. some arc class -> some path class).
     * @note By default, only "Generic:PhysicalObject" and "BisCore:DrawingGraphic" are allowed.
     */
    allowJoin?(props: Readonly<GeometricElementProps>): GeometricElementProps | undefined;
    /** Allow appearance and category overrides when creating a new element. Implement this method to specify a different sub-category
     * or to override sub-category appearance.
     * @note By default, a new element is created using the default sub-category appearance of the target category.
     */
    modifyGeometryParams?(params: GeometryParams): void;
    /** Allow a specific placement to be specified instead of using the default geometry frame logic when creating a new element.
     * @note Ny default, the placement origin is the curve start point, and x direction the curve start tangent.
     */
    getPlacementProps?(curve: CurvePrimitive, defaultUpVector: Vector3d | undefined): PlacementProps | undefined;
    /** Always called before getElementProps to provide additional context or to reject geometry that isn't suitable for
     * the specified element class from being accepted and inserted. Return a translated string with the reject reason
     * to be displayed to the user, or undefined to accept.
     * @note Not called when continuing an existing path as that is handled by allowJoin.
     */
    announceGeometry?(geometry: GeometryQuery): string | undefined;
    /** Allow a specific element class to be created when inserting a new element. Won't be called when continuing an existing Path
     * or CurvePrimitive.
     * @note By default, only "Generic:PhysicalObject" and "BisCore:DrawingGraphic" can be created.
     */
    getElementProps?(model: Id64String, category: Id64String, placement: PlacementProps): GeometricElementProps | undefined;
    /** Allow new elements to be created at a specific elevation. Returning a value overrides the z coordinate from
     * ButtonEvents. Implement to facilitate 2d display priority like behavior when sketching in 3d plan projection views.
     * Only called for 3d views that don't allow 3d rotation. Restricts continue of an existing Path or CurvePrimitive to this elevation.
     * @note Overrides normal point adjustment from ACS plane snap, AccuDraw, etc.
     */
    getElevationOverride?(vp: Viewport): number | undefined;
    /** Whether to create a Loop for a physically closed planar Path.
     * @note By default Loops are created.
     */
    createLoopForPhysicallyClosed?(): boolean;
  }
}

/** Base class for creating open and closed paths. */
abstract class CreateOrContinuePathTool extends CreateElementWithDynamicsTool {
  protected _createCurvePhase = CreateCurvePhase.DefineOther;
  protected readonly accepted: Point3d[] = [];
  protected current?: CurvePrimitive;
  protected params?: GeometryParams;
  protected continuationData?: { props: GeometricElementProps, path: Path, params: GeometryParams, originalId: Id64String };
  protected isClosed = false;
  protected isConstruction = false; // Sub-classes can set in createNewCurvePrimitive to bypass creating element graphics...
  protected isAccept = false;
  protected _snapGeomId?: Id64String;
  protected _startedCmd?: string;

  constructor(protected _creator3d?: Sketch.Assistant, protected _creator2d?: Sketch.Assistant) { super(); }

  public override requireWriteableTarget(): boolean {
      return false;
  }

  protected async startCommand(): Promise<string> {
    if (undefined !== this._startedCmd)
      return this._startedCmd;
    return EditTools.startCommand<string>({ commandId: editorBuiltInCmdIds.cmdBasicManipulation, iModelKey: this.iModel.key });
  }

  protected get wantJoin(): boolean { return false; }
  protected get wantClosure(): boolean { return false; }
  protected get wantSimplify(): boolean { return true; }

  protected get wantSmartRotation(): boolean { return this.isContinueExistingPath || this.isControlDown; }
  protected get wantPickableDynamics(): boolean { return false; }
  protected get allowEnterKeyToAccept(): boolean { return false; } // Allow Enter (as well as Reset) to create element...

  protected get showCurveConstructions(): boolean { return false; }
  protected get showJoin(): boolean { return this.isContinueExistingPath && CreateCurvePhase.DefineStart === this.createCurvePhase; }
  protected get showClosure(): boolean { return this.isClosed && CreateCurvePhase.DefineEnd === this.createCurvePhase; }
  protected get createCurvePhase(): CreateCurvePhase { return this._createCurvePhase; }

  /** Sub-classes should override unless they don't support join or closure. */
  protected updateCurvePhase(): void { }

  /** Implemented by sub-classes to create the new curve or construction curve for placement dynamics.
   * @param ev The current button event from a click or motion event.
   * @param isDynamics true when called for dynamics and the point from ev should be included in the result curve.
   * @internal
   */
  protected abstract createNewCurvePrimitive(ev: BeButtonEvent, isDynamics: boolean): CurvePrimitive | undefined;

  private doAnnounceGeometry(geometry: GeometryQuery, is3d: boolean): string | undefined {
    // Make it possible to create a different element class based on the geometry (ex. rectangle with sharp or rounded corners)...
    if (is3d) {
      if (undefined !== this._creator3d?.announceGeometry)
        return this._creator3d.announceGeometry(geometry);
    } else {
      if (undefined !== this._creator2d?.announceGeometry)
        return this._creator2d.announceGeometry(geometry);
    }
    return undefined;
  }

  private doCreateLoop(is3d: boolean): boolean {
    if (is3d) {
      if (undefined !== this._creator3d?.createLoopForPhysicallyClosed)
        return this._creator3d.createLoopForPhysicallyClosed();
    } else {
      if (undefined !== this._creator2d?.createLoopForPhysicallyClosed)
        return this._creator2d.createLoopForPhysicallyClosed();
    }

    return true;
  }

  private doCreateJoin(props: GeometricElementProps, is3d: boolean): GeometricElementProps | undefined {
    // Allow generic 2d/3d classes to be modified by default...
    if (props.classFullName === CheckedElementCache.getDefaultElementClass(is3d))
      return props;

    if (is3d) {
      if (undefined !== this._creator3d?.allowJoin)
        return this._creator3d.allowJoin(props);
    } else {
      if (undefined !== this._creator2d?.allowJoin)
        return this._creator2d.allowJoin(props);
    }

    return undefined;
  }

  private doCreateGeometryParams(is3d: boolean): GeometryParams {
    const params = new GeometryParams(this.targetCategory);

    if (is3d) {
      if (undefined !== this._creator3d?.modifyGeometryParams)
        this._creator3d.modifyGeometryParams(params);
    } else {
      if (undefined !== this._creator2d?.modifyGeometryParams)
        this._creator2d.modifyGeometryParams(params);
    }

    return params;
  }

  private doCreatePlacementProps(curve: CurvePrimitive, defaultUpVector: Vector3d | undefined, is3d: boolean): PlacementProps | undefined {
    let placement;
    if (is3d) {
      if (undefined !== this._creator3d?.getPlacementProps)
        placement = this._creator3d.getPlacementProps(curve, defaultUpVector);
    } else {
      if (undefined !== this._creator2d?.getPlacementProps)
        placement = this._creator2d.getPlacementProps(curve, defaultUpVector);
    }

    if (undefined !== placement)
      return placement;

    const localToWorld = FrameBuilder.createRightHandedFrame(defaultUpVector, curve);
    if (undefined === localToWorld)
      return;

    const origin = localToWorld.getOrigin();
    const angles = new YawPitchRollAngles();

    YawPitchRollAngles.createFromMatrix3d(localToWorld.matrix, angles);
    placement = (is3d ? { origin, angles } : { origin, angle: angles.yaw });

    return placement;
  }

  private doCreateElementProps(model: Id64String, category: Id64String, placement: PlacementProps, is3d: boolean): GeometricElementProps | undefined {
    let props;
    if (is3d) {
      if (undefined !== this._creator3d?.getElementProps)
        props = this._creator3d.getElementProps(model, category, placement);
    } else {
      if (undefined !== this._creator2d?.getElementProps)
        props = this._creator2d.getElementProps(model, category, placement);
    }

    if (undefined !== props)
      return props;

    // Create generic 2d/3d classes by default...
    props = { classFullName: CheckedElementCache.getDefaultElementClass(is3d), model, category, code: Code.createEmpty(), placement };

    return props;
  }

  protected getCurrentRotation(ev: BeButtonEvent): Matrix3d {
    const matrix = (undefined !== ev.viewport ? AccuDrawHintBuilder.getCurrentRotation(ev.viewport, true, true) : undefined);
    return (undefined !== matrix ? matrix : Matrix3d.createIdentity());
  }

  protected getUpVector(ev: BeButtonEvent): Vector3d {
    return this.getCurrentRotation(ev).getColumn(2);
  }

  protected getAdjustedPoint(ev: BeButtonEvent): Point3d {
    const point = ev.point.clone();

    // Allow 3d assistant to override z in plan projection views to emulate having display priority...
    if (undefined === ev.viewport || undefined === this._creator3d?.getElevationOverride)
      return point;

    if (!ev.viewport.view.is3d() || ev.viewport.view.allow3dManipulations())
      return point;

    const elevation = this._creator3d.getElevationOverride(ev.viewport);
    if (undefined === elevation)
      return point;

    point.z = elevation;

    return point;
  }

  protected async updateCurveAndContinuationData(ev: BeButtonEvent, isDynamics: boolean): Promise<void> {
    this.isConstruction = false;
    this.current = this.createNewCurvePrimitive(ev, isDynamics);

    if (CreateCurvePhase.DefineStart === this.createCurvePhase)
      await this.isValidForJoin(); // Updates this.continuationData...
    else if (CreateCurvePhase.DefineEnd === this.createCurvePhase)
      await this.isValidForClosure(); // Updates this.isClosed...

    if (isDynamics && undefined === this.current && undefined !== this._graphicsProvider)
      this._graphicsProvider.cleanupGraphic(); // Don't continue displaying a prior successful result...
  }

  protected override async updateElementData(ev: BeButtonEvent, isDynamics: boolean): Promise<void> {
    if (!isDynamics)
      this.accepted.push(this.getAdjustedPoint(ev));

    await this.updateCurveAndContinuationData(ev, isDynamics);

    if (!isDynamics)
      this.updateCurvePhase();
  }

  protected override async updateDynamicData(ev: BeButtonEvent): Promise<boolean> {
    // Need to update continuation data for first data point before dynamics has started...
    await this.updateCurveAndContinuationData(ev, true);

    // Don't need to create graphic if dynamics aren't yet active or showing construction geometry...
    return (IModelApp.viewManager.inDynamicsMode && !this.isConstruction);
  }

  protected get isContinueExistingPath(): boolean { return undefined !== this.continuationData; }

  protected async isValidForContinue(snap: SnapDetail): Promise<{ props: GeometricElementProps, path: Path, params: GeometryParams, originalId: Id64String } | undefined> {
    if (!snap.isElementHit)
      return;

    const snapCurve = snap.getCurvePrimitive();
    if (undefined === snapCurve)
      return;

    const curveS = snapCurve.startPoint();
    const curveE = snapCurve.endPoint();

    if (curveS.isAlmostEqual(curveE))
      return; // Reject snap to single physically closed curve primitive...

    const snapPt = snap.adjustedPoint;
    if (!(snapPt.isAlmostEqual(curveS) || snapPt.isAlmostEqual(curveE)))
      return; // No point to further checks if snap wasn't to endpoint of curve primitive...

    this._startedCmd = await this.startCommand();
    const info = await basicManipulationIpc.requestElementGeometry(snap.sourceId, { maxDisplayable: 1, geometry: { curves: true, surfaces: false, solids: false } });
    if (undefined === info)
      return;

    const data = CreateOrContinuePathTool.isSingleOpenPath(info);
    if (undefined === data)
      return;

    const props = await this.iModel.elements.loadProps(snap.sourceId) as GeometricElementProps;
    if (undefined === props)
      return;

    return { props, path: data.path, params: data.params, originalId: snap.sourceId };
  }

  protected async isValidForJoin(): Promise<boolean> {
    this.continuationData = undefined;

    if (!this.wantJoin)
      return false;

    if (undefined === this.current)
      return false;

    const snap = TentativeOrAccuSnap.getCurrentSnap();
    if (undefined === snap)
      return false;

    const data = await this.isValidForContinue(snap);
    if (undefined === data)
      return false;

    if (!CreateOrContinuePathTool.isPathEndPoint(this.current, data.path))
      return false;

    const props = this.doCreateJoin(data.props, snap.viewport.view.is3d());
    if (undefined === props)
      return false;

    if (undefined === props.placement)
      props.placement = data.props.placement; // Preserve original placement if new props omitted it...

    data.props = props;
    this.continuationData = data;

    return true;
  }

  protected async isValidForClosure(): Promise<boolean> {
    this.isClosed = false;

    if (!this.wantClosure)
      return false;

    if (undefined === this.current)
      return false;

    return (this.isClosed = CreateOrContinuePathTool.isPathClosurePoint(this.current, this.continuationData?.path));
  }

  public static isSingleOpenPath(info: ElementGeometryInfo): { path: Path, params: GeometryParams } | undefined {
    const it = new ElementGeometry.Iterator(info);
    it.requestWorldCoordinates();

    for (const entry of it) {
      const geom = entry.toGeometryQuery();
      if (undefined === geom)
        return;

      if ("curvePrimitive" === geom.geometryCategory) {
        const curve = geom as CurvePrimitive;

        const curveS = curve.startPoint();
        const curveE = curve.endPoint();

        if (curveS.isAlmostEqual(curveE))
          return; // Reject zero length lines, physically closed arcs, line strings, etc...

        return { path: Path.create(curve), params: entry.geomParams };
      } else if ("curveCollection" === geom.geometryCategory) {
        const curves = geom as CurveCollection;
        if (!curves.isOpenPath)
          return;

        const path = curves as Path;
        const curveS = path.children[0].startPoint();
        const curveE = path.children[path.children.length - 1].endPoint();

        if (curveS.isAlmostEqual(curveE))
          return; // Reject physically closed path...

        return { path, params: entry.geomParams };
      }

      break;
    }

    return;
  }

  public static isPathEndPoint(curve: CurvePrimitive, path: Path): boolean {
    const curveS = curve.startPoint();
    const pathS = path.children[0].startPoint();
    const pathE = path.children[path.children.length - 1].endPoint();

    if (!(curveS.isAlmostEqual(pathS) || curveS.isAlmostEqual(pathE)))
      return false;

    return true;
  }

  public static isPathClosurePoint(curve: CurvePrimitive, path?: Path): boolean {
    const length = curve.quickLength();
    if (length < Geometry.smallMetricDistance)
      return false;

    const curveS = curve.startPoint();
    const curveE = curve.endPoint();

    if (undefined === path) {
      if (!curveS.isAlmostEqual(curveE))
        return false;

      const curveLocalToWorld = FrameBuilder.createRightHandedFrame(undefined, curve);
      if (undefined === curveLocalToWorld)
        return false;

      // Don't create a Loop unless new CurvePrimitive is planar...
      const curvePlane = Plane3dByOriginAndUnitNormal.create(curveLocalToWorld.getOrigin(), curveLocalToWorld.matrix.getColumn(2));
      return (undefined !== curvePlane && curve.isInPlane(curvePlane));
    }

    const pathS = path.children[0].startPoint();
    const pathE = path.children[path.children.length - 1].endPoint();

    if (!(curveS.isAlmostEqual(pathS) && curveE.isAlmostEqual(pathE) || curveS.isAlmostEqual(pathE) && curveE.isAlmostEqual(pathS)))
      return false;

    const pathLocalToWorld = FrameBuilder.createRightHandedFrame(undefined, [curve, path]);
    if (undefined === pathLocalToWorld)
      return false;

    // Don't create a Loop unless new CurvePrimitive + existing Path is planar...
    const pathPlane = Plane3dByOriginAndUnitNormal.create(pathLocalToWorld.getOrigin(), pathLocalToWorld.matrix.getColumn(2));
    if (undefined === pathPlane)
      return false;

    if (!curve.isInPlane(pathPlane))
      return false;

    for (const child of path.children) {
      if (!child.isInPlane(pathPlane))
        return false;
    }

    return true;
  }

  protected addConstructionGraphics(curve: CurvePrimitive, showCurve: boolean, context: DynamicsContext): void {
    if (!showCurve) {
      switch (curve.curvePrimitiveType) {
        case "arc":
        case "bsplineCurve":
        case "interpolationCurve":
          break;
        default:
          return;
      }
    }

    const builder = context.createGraphic({ type: GraphicType.WorldOverlay });
    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 1, LinePixels.Code2);

    if (showCurve)
      builder.addPath(Path.create(curve));

    switch (curve.curvePrimitiveType) {
      case "arc": {
        const arc = curve as Arc3d;
        const start = arc.startPoint();
        const end = arc.endPoint();

        builder.addLineString([arc.center, start]);
        if (!start.isAlmostEqual(end))
          builder.addLineString([arc.center, end]);

        builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 5);
        builder.addPointString([arc.center]);
        break;
      }

      case "bsplineCurve": {
        const bcurve = curve as BSplineCurve3d;
        const poles: Point3d[] = [];

        for (let iPole = 0; iPole < bcurve.numPoles; ++iPole) {
          const polePt = bcurve.getPolePoint3d(iPole);
          if (undefined !== polePt)
            poles.push(polePt);
        }

        builder.addLineString(poles);

        builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 5);
        builder.addPointString(poles);
        break;
      }

      case "interpolationCurve": {
        const fitCurve = curve as InterpolationCurve3d;

        builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 5);
        builder.addPointString(fitCurve.options.fitPoints); // deep copy should not be necessary...
        break;
      }

      default:
        break;
    }

    context.addGraphic(builder.finish());
  }

  protected showConstructionGraphics(_ev: BeButtonEvent, context: DynamicsContext): boolean {
    if (undefined === this.current)
      return false;

    if (!this.isConstruction) {
      if (this.showCurveConstructions)
        this.addConstructionGraphics(this.current, false, context);
      return false;
    }

    this.addConstructionGraphics(this.current, true, context);
    return true;
  }

  public override onDynamicFrame(ev: BeButtonEvent, context: DynamicsContext): void {
    if (this.showConstructionGraphics(ev, context))
      return; // Don't display element graphics...

    super.onDynamicFrame(ev, context);
  }

  protected showJoinIndicator(context: DecorateContext, pt: Point3d): void {
    const lengthX = Math.floor(context.viewport.pixelsFromInches(0.08)) + 0.5;
    const lengthY = Math.floor(lengthX * 0.6) + 0.5;
    const offsetX = lengthX * 3;
    const offsetY = lengthY * 3;
    const position = context.viewport.worldToView(pt);

    position.x = Math.floor(position.x - offsetX) + 0.5;
    position.y = Math.floor(position.y + offsetY) + 0.5;

    const drawDecoration = (ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(0,0,0,.8)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.moveTo(-lengthX, lengthY);
      ctx.lineTo(0, lengthY);
      ctx.lineTo(0, -lengthY);
      ctx.lineTo(lengthX, -lengthY);
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,255,255,.8)";
      ctx.lineWidth = 1;
      ctx.moveTo(-lengthX, lengthY);
      ctx.lineTo(0, lengthY);
      ctx.lineTo(0, -lengthY);
      ctx.lineTo(lengthX, -lengthY);
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = "rgba(0,0,0,.8)";
      ctx.fillStyle = "rgba(0,255,255,.8)";
      ctx.arc(0, -lengthY, 2.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    };
    context.addCanvasDecoration({ position, drawDecoration }, true);
  }

  protected showClosureIndicator(context: DecorateContext, pt: Point3d): void {
    const radius = Math.floor(context.viewport.pixelsFromInches(0.06)) + 0.5;
    const offset = radius * 2.5;
    const position = context.viewport.worldToView(pt);

    position.x = Math.floor(position.x - offset) + 0.5;
    position.y = Math.floor(position.y + offset) + 0.5;

    const drawDecoration = (ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,255,255,.8)";
      ctx.lineWidth = 1;
      ctx.fillStyle = "rgba(0,0,255,.2)";
      ctx.arc(0, 0, radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = "rgba(0,0,0,.8)";
      ctx.arc(0, 0, radius + 1, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = "rgba(0,0,0,.8)";
      ctx.fillStyle = "rgba(0,255,255,.8)";
      ctx.arc(-radius, 0, 2.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    };
    context.addCanvasDecoration({ position, drawDecoration }, true);
  }

  public override testDecorationHit(id: Id64String): boolean {
    return id === this._snapGeomId;
  }

  public override async getToolTip(hit: HitDetail): Promise<HTMLElement | string> {
    if (this.testDecorationHit(hit.sourceId))
      return this.description;
    return super.getToolTip(hit);
  }

  protected getSnapGeometry(): GeometryQuery | undefined {
    if (this.accepted.length < 2)
      return;

    // Treat accepted points as linear segments by default...
    return LineString3d.create(this.accepted);
  }

  public override getDecorationGeometry(_hit: HitDetail): GeometryStreamProps | undefined {
    const geomQuery = this.getSnapGeometry();
    if (undefined === geomQuery)
      return;

    const geomJson = IModelJson.Writer.toIModelJson(geomQuery);
    return geomJson ? [geomJson] : undefined;
  }

  protected addPickableGraphics(context: DecorateContext, locateOnly?: boolean): void {
    const geomQuery = this.getSnapGeometry();
    if (undefined === geomQuery)
      return;

    if (undefined === this._snapGeomId)
      this._snapGeomId = this.iModel.transientIds.getNext();

    const builder = context.createGraphic({ type: GraphicType.WorldDecoration, pickable: { id: this._snapGeomId, locateOnly } });
    const color = context.viewport.getContrastToBackgroundColor();
    builder.setSymbology(color, ColorDef.black, 1);

    switch (geomQuery.geometryCategory) {
      case "pointCollection": {
        const pointString = geomQuery as PointString3d;
        builder.addPointString(pointString.points);
        break;
      }

      case "curvePrimitive": {
        const curvePrimitive = geomQuery as CurvePrimitive;
        switch (curvePrimitive.curvePrimitiveType) {
          case "lineString": {
            const lineString = geomQuery as LineString3d;
            builder.addLineString(lineString.points);
            break;
          }

          default:
            return; // Don't need to support other types of CurvePrimitive currently...
        }
        break;
      }

      default:
        return; // Don't need to support other types of GeometryQuery currently...
    }

    context.addDecorationFromBuilder(builder);
  }

  public override decorate(context: DecorateContext): void {
    if (this.wantPickableDynamics)
      this.addPickableGraphics(context, true);

    if (undefined === this.current)
      return;

    if (this.showJoin)
      this.showJoinIndicator(context, this.current.startPoint());
    else if (this.showClosure)
      this.showClosureIndicator(context, this.current.endPoint());
  }

  public override decorateSuspended(context: DecorateContext): void {
    if (this.wantPickableDynamics)
      this.addPickableGraphics(context);
  }

  public override async onModifierKeyTransition(_wentDown: boolean, modifier: BeModifierKeys, _event: KeyboardEvent): Promise<EventHandled> {
    if (BeModifierKeys.Control !== modifier)
      return EventHandled.No;

    // Update display for join/closure change w/o waiting for a motion event...
    return EventHandled.Yes;
  }

  protected getPlacementProps(): PlacementProps | undefined {
    if (undefined !== this.continuationData)
      return this.continuationData.props.placement;

    if (undefined === this.current)
      return;

    const vp = this.targetView;
    if (undefined === vp)
      return;

    const matrix = AccuDrawHintBuilder.getCurrentRotation(vp, true, true);
    const placement = this.doCreatePlacementProps(this.current, matrix?.getColumn(2), vp.view.is3d());

    return placement;
  }

  protected createNewPathGeometryProps(placement: PlacementProps, geometry: GeometryQuery): JsonGeometryStream | FlatBufferGeometryStream | undefined {
    const is3d = isPlacement3dProps(placement);
    const createLoop = (this.isClosed && this.doCreateLoop(is3d));

    if (geometry instanceof CurvePrimitive)
      geometry = (createLoop ? Loop.create(geometry) : geometry);
    else if (geometry instanceof Loop)
      geometry = (createLoop ? geometry : Path.createArray(geometry.children));

    if (this.isAccept) {
      const rejectReason = this.doAnnounceGeometry(geometry, is3d);

      if (rejectReason) {
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, rejectReason));
        return;
      }
    }

    const builder = new ElementGeometry.Builder();
    builder.setLocalToWorldFromPlacement(placement);

    this.params = this.doCreateGeometryParams(is3d); // Allow creators to apply appearance overrides, append will be a no-op otherwise...
    builder.appendGeometryParamsChange(this.params);

    if (!builder.appendGeometryQuery(geometry))
      return;

    return { format: "flatbuffer", data: builder.entries };
  }

  protected createNewPath(placement: PlacementProps): JsonGeometryStream | FlatBufferGeometryStream | undefined {
    if (undefined === this.current)
      return;

    return this.createNewPathGeometryProps(placement, this.current);
  }

  protected continueExistingPath(placement: PlacementProps): JsonGeometryStream | FlatBufferGeometryStream | undefined {
    if (undefined === this.current || undefined === this.continuationData)
      return;

    const length = this.current.quickLength();
    if (length < Geometry.smallMetricDistance)
      return;

    const curveS = this.current.startPoint();
    const pathS = this.continuationData.path.children[0].startPoint();
    const pathE = this.continuationData.path.children[this.continuationData.path.children.length - 1].endPoint();

    const append = pathE.isAlmostEqual(curveS);
    if (!append && !pathS.isAlmostEqual(curveS))
      return;

    const continuePath = this.continuationData.path.clone() as Path;
    if (undefined === continuePath)
      return;

    const current = this.current.clone();
    if (undefined === current)
      return;

    if (append) {
      continuePath.tryAddChild(current);
    } else {
      current.reverseInPlace();
      continuePath.children.splice(0, 0, current);
    }

    const is3d = isPlacement3dProps(placement);
    const createLoop = (this.isClosed && this.doCreateLoop(is3d));
    const geometry = (createLoop ? Loop.createArray(continuePath.children) : continuePath);

    if (this.wantSimplify)
      RegionOps.consolidateAdjacentPrimitives(geometry);

    const builder = new ElementGeometry.Builder();
    builder.setLocalToWorldFromPlacement(placement);
    builder.appendGeometryParamsChange(this.continuationData.params);

    if (!builder.appendGeometryQuery(geometry))
      return;

    return { format: "flatbuffer", data: builder.entries };
  }

  protected getGeometryProps(placement: PlacementProps): JsonGeometryStream | FlatBufferGeometryStream | undefined {
    if (this.isContinueExistingPath)
      return this.continueExistingPath(placement);

    return this.createNewPath(placement);
  }

  protected getElementProps(placement: PlacementProps): GeometricElementProps | undefined {
    if (undefined !== this.continuationData)
      return this.continuationData.props;

    const model = this.targetModelId;
    const category = (this.params ? this.params.categoryId : this.targetCategory); // Create element using same category as appearance overrides when present...
    const is3d = isPlacement3dProps(placement);
    const props = this.doCreateElementProps(model, category, placement, is3d);

    return props;
  }

  protected override async doCreateElement(props: GeometricElementProps): Promise<void> {
    this._startedCmd = await this.startCommand();
    if (undefined === props.id) {
      if (undefined !== this.continuationData)
        await basicManipulationIpc.deleteElements(CompressedId64Set.compressArray([this.continuationData.originalId]));
      await basicManipulationIpc.insertGeometricElement(props);
    } else {
      await basicManipulationIpc.updateGeometricElement(props);
    }
    return this.saveChanges();
  }

  protected override async createElement(): Promise<void> {
    this.isAccept = true;
    return super.createElement();
  }

  public override async onKeyTransition(wentDown: boolean, keyEvent: KeyboardEvent): Promise<EventHandled> {
    if (!wentDown)
      return EventHandled.No;

    switch (keyEvent.key.toLowerCase()) {
      case "enter": {
        if (!this.allowEnterKeyToAccept)
          return EventHandled.No;

        const ev = new BeButtonEvent();
        this.getCurrentButtonEvent(ev);
        ev.button = BeButton.Reset;

        if (!this.isComplete(ev) || !await this.cancelPoint(ev))
          return EventHandled.No;

        await super.onReinitialize();
        return EventHandled.Yes;
      }

      default:
        return EventHandled.No;
    }
  }

  protected override setupAccuDraw(): void {
    const nPts = this.accepted.length;
    if (0 === nPts)
      return;

    const hints = new AccuDrawHintBuilder();

    if (this.wantSmartRotation)
      hints.enableSmartRotation = true;

    // Rotate AccuDraw to last segment...
    if (nPts > 1 && !this.accepted[nPts - 1].isAlmostEqual(this.accepted[nPts - 2]))
      hints.setXAxis(Vector3d.createStartEnd(this.accepted[nPts - 2], this.accepted[nPts - 1]));

    hints.setOrigin(this.accepted[nPts - 1]);
    hints.sendHints();
  }

  public override async onUndoPreviousStep(): Promise<boolean> {
    if (0 === this.accepted.length)
      return false;

    this.accepted.pop();
    if (0 === this.accepted.length) {
      await this.onReinitialize();
    } else {
      this.updateCurvePhase();
      this.setupAndPromptForNextAction();
    }

    return true;
  }

  public override async onPostInstall() {
    await super.onPostInstall();
    this.updateCurvePhase();
  }
}

/** @internal Creates a line string or shape. Uses model and category from [[BriefcaseConnection.editorToolSettings]]. */
export class CreateLineStringTool extends CreateOrContinuePathTool {
  public static override toolId = "CreateLineString";
  public static override iconSpec = "icon-select-line"; // TODO: Need better icon...

  protected override get wantPickableDynamics(): boolean { return true; } // Allow snapping to accepted segments...
  protected override get allowEnterKeyToAccept(): boolean { return true; }

  private _allowJoinCloseProperty: DialogProperty<boolean> | undefined;
  public get allowJoinCloseProperty() {
    if (!this._allowJoinCloseProperty)
      this._allowJoinCloseProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildToggleDescription("lsJoinClose", EditingTools.translate("CreateLineString.Label.JoinClose")), false);
    return this._allowJoinCloseProperty;
  }

  public get allowJoinClose(): boolean { return this.allowJoinCloseProperty.value; }
  public set allowJoinClose(value: boolean) { this.allowJoinCloseProperty.value = value; }

  protected override get wantJoin(): boolean {
    return this.allowJoinClose;
  }

  protected override get wantClosure(): boolean {
    // A line string can support physical closure when creating a new path...
    return this.allowJoinClose;
  }

  protected override updateCurvePhase(): void {
    // The first point changes startPoint and last point changes endPoint.
    this._createCurvePhase = (0 === this.accepted.length ? CreateCurvePhase.DefineStart : CreateCurvePhase.DefineEnd);
  }

  protected override isComplete(ev: BeButtonEvent): boolean {
    // Accept on reset with at least 2 points...
    if (BeButton.Reset === ev.button)
      return (this.accepted.length > 1);

    // Allow data to complete on physical closure (creates Loop)...
    return this.isClosed;
  }

  protected createNewCurvePrimitive(ev: BeButtonEvent, isDynamics: boolean): CurvePrimitive | undefined {
    const numRequired = (isDynamics ? 1 : 2);
    if (this.accepted.length < numRequired) {
      this.isConstruction = true; // Create zero length line as construction geometry to support join...
      const pt = (0 !== this.accepted.length ? this.accepted[0] : this.getAdjustedPoint(ev));
      return LineString3d.create([pt, pt]);
    }

    const pts = (isDynamics ? [...this.accepted, this.getAdjustedPoint(ev)] : this.accepted);
    return LineString3d.create(pts);
  }

  protected override async cancelPoint(ev: BeButtonEvent): Promise<boolean> {
    // NOTE: Starting another tool will not create element...require reset or closure...
    if (this.isComplete(ev)) {
      this._createCurvePhase = CreateCurvePhase.DefineEnd;
      await this.updateCurveAndContinuationData(ev, false);
      await this.createElement();
    }
    return true;
  }

  public override async bumpToolSetting(settingIndex?: number): Promise<boolean> {
    if (undefined !== settingIndex)
      return false;

    this.allowJoinClose = !this.allowJoinClose;
    this.syncToolSettingsProperties([this.allowJoinCloseProperty.syncItem]);
    return this.changeToolSettingPropertyValue(this.allowJoinCloseProperty.syncItem);
  }

  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    return this.changeToolSettingPropertyValue(updatedValue);
  }

  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    this.initializeToolSettingPropertyValues([this.allowJoinCloseProperty]);

    const toolSettings = new Array<DialogItem>();
    toolSettings.push(this.allowJoinCloseProperty.toDialogItem({ rowPriority: 1, columnIndex: 0 }));

    return toolSettings;
  }

  public async onRestartTool() {
    const tool = new CreateLineStringTool(this._creator3d, this._creator2d);
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @internal Creates a shape. Uses model and category from [[BriefcaseConnection.editorToolSettings]]. */
export class CreateShapeTool extends CreateOrContinuePathTool {
  public static override toolId = "CreateShape";
  public static override iconSpec = "icon-shape";

  protected override get wantPickableDynamics(): boolean { return true; } // Allow snapping to accepted segments...
  protected override get allowEnterKeyToAccept(): boolean { return true; }

  protected override isComplete(ev: BeButtonEvent): boolean {
    // Require at least 3 points to accept...
    if (this.accepted.length < 3)
      return false;

    // Accept on reset...
    if (BeButton.Reset === ev.button)
      return true;

    // Accept on physical closure...
    return (this.accepted[0].isAlmostEqual(this.accepted[this.accepted.length - 1]));
  }

  protected override getAdjustedPoint(ev: BeButtonEvent): Point3d {
    const pt = super.getAdjustedPoint(ev);

    // Enforce that only planar shapes are created...
    if (this.accepted.length > 2 && ev.viewport) {
      const localToWorld = FrameBuilder.createRightHandedFrame(undefined, this.accepted);
      const planePoint = (undefined === localToWorld ? undefined : AccuDrawHintBuilder.projectPointToPlaneInView(pt, localToWorld.getOrigin(), localToWorld.matrix.getColumn(2), ev.viewport, true));
      if (undefined !== planePoint)
        return planePoint;
    }

    return pt;
  }

  protected createNewCurvePrimitive(ev: BeButtonEvent, isDynamics: boolean): CurvePrimitive | undefined {
    const numRequired = (isDynamics ? 2 : 3);
    if (this.accepted.length < numRequired) {
      this.isConstruction = true;
      return (this.accepted.length < (numRequired - 1) ? undefined : LineString3d.create([this.accepted[0], isDynamics ? this.getAdjustedPoint(ev) : this.accepted[1]]));
    }

    this.isClosed = true;
    const pts = (isDynamics ? [...this.accepted, this.getAdjustedPoint(ev)] : [...this.accepted]); // Always create new array in case closure point is added...
    if (!pts[0].isAlmostEqual(pts[pts.length - 1]))
      pts.push(pts[0]);
    return LineString3d.create(pts);
  }

  protected override async cancelPoint(ev: BeButtonEvent): Promise<boolean> {
    // NOTE: Starting another tool will not create element...require reset or closure...
    if (this.isComplete(ev)) {
      await this.updateCurveAndContinuationData(ev, false);
      await this.createElement();
    }
    return true;
  }

  public async onRestartTool() {
    const tool = new CreateShapeTool(this._creator3d, this._creator2d);
    if (!await tool.run())
      return this.exitTool();
  }
}


/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Editing
 */

import { DialogItem, DialogProperty, DialogPropertySyncItem, EnumerationChoice, PropertyDescriptionHelper, PropertyEditorParamTypes, RangeEditorParams } from "@itwin/appui-abstract";
import { CompressedId64Set, Id64String } from "@itwin/core-bentley";
import { Code, ColorDef, ElementGeometry, ElementGeometryInfo, FlatBufferGeometryStream, GeometricElementProps, GeometryParams, GeometryStreamProps, isPlacement3dProps, JsonGeometryStream, LinePixels, PlacementProps } from "@itwin/core-common";
import { AccuDrawHintBuilder, AngleDescription, BeButton, BeButtonEvent, BeModifierKeys, DecorateContext, DynamicsContext, EventHandled, GraphicType, HitDetail, IModelApp, LengthDescription, NotifyMessageDetails, OutputMessagePriority, SnapDetail, TentativeOrAccuSnap, Viewport } from "@itwin/core-frontend";
import { Angle, AngleSweep, Arc3d, BSplineCurve3d, CurveCollection, CurveFactory, CurvePrimitive, FrameBuilder, Geometry, GeometryQuery, IModelJson, InterpolationCurve3d, InterpolationCurve3dOptions, InterpolationCurve3dProps, LineString3d, Loop, Matrix3d, Path, Plane3dByOriginAndUnitNormal, Point3d, PointString3d, Ray3d, RegionOps, Transform, Vector3d, YawPitchRollAngles } from "@itwin/core-geometry";
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

/** Option for how to defined arc */
enum ArcMethod {
  CenterStart = 0,
  StartCenter = 1,
  StartMidEnd = 2,
  StartEndMid = 3,
  StartTangent = 4,
  TangentEnd = 5,
}

/** @internal Creates an arc. Uses model and category from [[BriefcaseConnection.editorToolSettings]]. */
export class CreateArcTool extends CreateOrContinuePathTool {
  public static override toolId = "CreateArc";
  public static override iconSpec = "icon-three-points-circular-arc";

  protected override get showCurveConstructions(): boolean { return true; } // Display lines from center to start/end...

  protected override setupAccuDraw(): void {
    const nPts = this.accepted.length;
    if (0 === nPts)
      return;

    const hints = new AccuDrawHintBuilder();

    if (this.wantSmartRotation || ArcMethod.TangentEnd === this.method) // Always desirable to rotate to snap when using tangent/end...
      hints.enableSmartRotation = true;

    switch (this.accepted.length) {
      case 1: {
        hints.setOrigin(this.accepted[0]);

        if (ArcMethod.CenterStart !== this.method)
          break;

        hints.setOriginFixed = true;
        hints.setModePolar();
        break;
      }

      case 2: {
        switch (this.method) {
          case ArcMethod.CenterStart: {
            if (!this.accepted[0].isAlmostEqual(this.accepted[1]))
              hints.setXAxis(Vector3d.createStartEnd(this.accepted[0], this.accepted[1])); // Rotate AccuDraw to major axis...
            break;
          }

          case ArcMethod.StartCenter: {
            let center = this.accepted[1];
            const start = this.accepted[0];
            const vector0 = center.unitVectorTo(start);

            if (undefined === vector0)
              break;

            if (this.useRadius)
              center = start.plusScaled(vector0, -this.radius);

            hints.setOrigin(center);
            hints.setOriginFixed = true;
            hints.setModePolar();
            hints.setXAxis(vector0);
            break;
          }

          case ArcMethod.StartTangent: {
            hints.setOrigin(this.accepted[1]);
            const snap = TentativeOrAccuSnap.getCurrentSnap(false);
            const matrix = snap ? AccuDrawHintBuilder.getSnapRotation(snap) : undefined;
            if (matrix)
              hints.setMatrix(matrix);
            break;
          }

          case ArcMethod.TangentEnd: {
            hints.setOrigin(this.accepted[0]);
            if (!this.accepted[0].isAlmostEqual(this.accepted[1]))
              hints.setXAxis(Vector3d.createStartEnd(this.accepted[0], this.accepted[1])); // Rotate AccuDraw to tangent direction...
            break;
          }

          default: {
            hints.setOrigin(this.accepted[1]);
            break;
          }
        }
        break;
      }
    }

    hints.sendHints();
  }

  private static methodMessage(str: string) { return EditingTools.translate(`CreateArc.Method.${str}`); }
  private static getMethodChoices = (): EnumerationChoice[] => {
    return [
      { label: CreateArcTool.methodMessage("CenterStart"), value: ArcMethod.CenterStart },
      { label: CreateArcTool.methodMessage("StartCenter"), value: ArcMethod.StartCenter },
      { label: CreateArcTool.methodMessage("StartMidEnd"), value: ArcMethod.StartMidEnd },
      { label: CreateArcTool.methodMessage("StartEndMid"), value: ArcMethod.StartEndMid },
      { label: CreateArcTool.methodMessage("StartTangent"), value: ArcMethod.StartTangent },
      { label: CreateArcTool.methodMessage("TangentEnd"), value: ArcMethod.TangentEnd },
    ];
  };

  private _methodProperty: DialogProperty<number> | undefined;
  public get methodProperty() {
    if (!this._methodProperty)
      this._methodProperty = new DialogProperty<number>(PropertyDescriptionHelper.buildEnumPicklistEditorDescription(
        "arcMethod", EditingTools.translate("CreateArc.Label.Method"), CreateArcTool.getMethodChoices()), ArcMethod.StartCenter as number);
    return this._methodProperty;
  }

  public get method(): ArcMethod { return this.methodProperty.value as ArcMethod; }
  public set method(method: ArcMethod) { this.methodProperty.value = method; }

  private _useRadiusProperty: DialogProperty<boolean> | undefined;
  public get useRadiusProperty() {
    if (!this._useRadiusProperty)
      this._useRadiusProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildLockPropertyDescription("useArcRadius"), false);
    return this._useRadiusProperty;
  }

  public get useRadius(): boolean { return this.useRadiusProperty.value; }
  public set useRadius(value: boolean) { this.useRadiusProperty.value = value; }

  private _radiusProperty: DialogProperty<number> | undefined;
  public get radiusProperty() {
    if (!this._radiusProperty)
      this._radiusProperty = new DialogProperty<number>(new LengthDescription("arcRadius", EditingTools.translate("CreateArc.Label.Radius")), 0.0, undefined, !this.useRadius);
    return this._radiusProperty;
  }

  public get radius(): number { return this.radiusProperty.value; }
  public set radius(value: number) { this.radiusProperty.value = value; }

  private _useLengthProperty: DialogProperty<boolean> | undefined;
  public get useLengthProperty() {
    if (!this._useLengthProperty)
      this._useLengthProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildLockPropertyDescription("useArcLength"), false);
    return this._useLengthProperty;
  }

  public get useLength(): boolean { return this.useLengthProperty.value; }
  public set useLength(value: boolean) { this.useLengthProperty.value = value; }

  private _lengthProperty: DialogProperty<number> | undefined;
  public get lengthProperty() {
    if (!this._lengthProperty)
      this._lengthProperty = new DialogProperty<number>(new LengthDescription("arcLength", EditingTools.translate("CreateArc.Label.Length")), 0.0, undefined, !this.useLength);
    return this._lengthProperty;
  }

  public get length(): number { return this.lengthProperty.value; }
  public set length(value: number) { this.lengthProperty.value = value; }

  private _useSweepProperty: DialogProperty<boolean> | undefined;
  public get useSweepProperty() {
    if (!this._useSweepProperty)
      this._useSweepProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildLockPropertyDescription("useArcSweep"), false);
    return this._useSweepProperty;
  }

  public get useSweep(): boolean { return this.useSweepProperty.value; }
  public set useSweep(value: boolean) { this.useSweepProperty.value = value; }

  private _sweepProperty: DialogProperty<number> | undefined;
  public get sweepProperty() {
    if (!this._sweepProperty)
      this._sweepProperty = new DialogProperty<number>(new AngleDescription("arcSweep", EditingTools.translate("CreateArc.Label.Sweep")), Math.PI / 2.0, undefined, !this.useSweep);
    return this._sweepProperty;
  }

  public get sweep(): number { return this.sweepProperty.value; }
  public set sweep(value: number) { this.sweepProperty.value = value; }

  private _allowJoinCloseProperty: DialogProperty<boolean> | undefined;
  public get allowJoinCloseProperty() {
    if (!this._allowJoinCloseProperty)
      this._allowJoinCloseProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildToggleDescription("arcJoinClose", EditingTools.translate("CreateArc.Label.JoinClose")), false);
    return this._allowJoinCloseProperty;
  }

  public get allowJoinClose(): boolean { return this.allowJoinCloseProperty.value; }
  public set allowJoinClose(value: boolean) { this.allowJoinCloseProperty.value = value; }

  protected override get wantJoin(): boolean {
    return this.allowJoinClose;
  }

  protected override get wantClosure(): boolean {
    // only allow closure when continuing an existing path...
    return this.isContinueExistingPath && this.allowJoinClose;
  }

  protected override isComplete(_ev: BeButtonEvent): boolean {
    return (3 === this.accepted.length);
  }

  protected override updateCurvePhase(): void {
    switch (this.accepted.length) {
      case 0:
        this._createCurvePhase = ArcMethod.CenterStart === this.method ? CreateCurvePhase.DefineOther : CreateCurvePhase.DefineStart;
        break;
      case 1:
        if (ArcMethod.CenterStart === this.method)
          this._createCurvePhase = CreateCurvePhase.DefineStart;
        else if (ArcMethod.StartEndMid === this.method || ArcMethod.StartTangent === this.method)
          this._createCurvePhase = CreateCurvePhase.DefineEnd;
        else
          this._createCurvePhase = CreateCurvePhase.DefineOther;
        break;
      default:
        this._createCurvePhase = (ArcMethod.StartEndMid === this.method || ArcMethod.StartTangent === this.method) ? CreateCurvePhase.DefineOther : CreateCurvePhase.DefineEnd;
        break;
    }
  }

  protected createConstructionCurve(ev: BeButtonEvent, isDynamics: boolean): CurvePrimitive | undefined {
    switch (this.accepted.length) {
      case 0: {
        if (ArcMethod.CenterStart === this.method)
          return undefined;

        return LineString3d.create([this.getAdjustedPoint(ev), this.getAdjustedPoint(ev)]);
      }

      case 1: {
        const pt1 = this.accepted[0];
        const pt2 = (isDynamics ? this.getAdjustedPoint(ev) : pt1);

        switch (this.method) {
          case ArcMethod.CenterStart:
          case ArcMethod.StartCenter: {
            if (pt1.isAlmostEqual(pt2))
              return (ArcMethod.StartCenter === this.method ? LineString3d.create([pt1, pt2]) : undefined);

            let center = (ArcMethod.CenterStart === this.method ? pt1 : pt2);
            const start = (ArcMethod.CenterStart === this.method ? pt2 : pt1);
            const normal = this.getUpVector(ev);
            const vector0 = Vector3d.createStartEnd(center, start);
            const vector90 = normal.crossProduct(vector0);
            const radius = (this.useRadius ? this.radius : vector0.magnitude());

            if (this.useRadius) {
              if (ArcMethod.StartCenter === this.method) {
                vector0.normalizeInPlace();
                center = start.plusScaled(vector0, -radius);
              }
            } else {
              this.radius = radius;
              this.syncToolSettingsArcProperties();
            }

            vector0.scaleToLength(radius, vector0);
            vector90.scaleToLength(radius, vector90);

            return Arc3d.create(center, vector0, vector90);
          }

          case ArcMethod.StartMidEnd:
          case ArcMethod.StartEndMid:
          case ArcMethod.StartTangent:
          case ArcMethod.TangentEnd: {
            return LineString3d.create([pt1, pt2]);
          }

          default:
            return undefined;
        }
      }

      case 2: {
        switch (this.method) {
          case ArcMethod.CenterStart:
            return LineString3d.create([this.accepted[1], this.accepted[0]]);

          case ArcMethod.StartCenter:
          case ArcMethod.StartMidEnd:
          case ArcMethod.StartEndMid:
          case ArcMethod.StartTangent:
            return LineString3d.create([this.accepted[0], this.accepted[1]]);

          default:
            return undefined;
        }
      }

      default:
        return undefined;
    }
  }

  protected createNewCurvePrimitive(ev: BeButtonEvent, isDynamics: boolean): CurvePrimitive | undefined {
    const numRequired = (isDynamics ? 2 : 3);
    if (this.accepted.length < numRequired) {
      this.isConstruction = true; // Create construction geometry to support join...
      return this.createConstructionCurve(ev, isDynamics);
    }

    const final = (isDynamics ? this.getAdjustedPoint(ev) : this.accepted[2]);
    const start = (ArcMethod.CenterStart === this.method ? this.accepted[1] : this.accepted[0]);
    const end = (ArcMethod.StartEndMid === this.method ? this.accepted[1] : final);

    switch (this.method) {
      case ArcMethod.CenterStart:
      case ArcMethod.StartCenter: {
        let center = (ArcMethod.CenterStart === this.method ? this.accepted[0] : this.accepted[1]);
        if (center.isAlmostEqual(start))
          return undefined; // Don't create 0 radius arc...

        const vector0 = Vector3d.createStartEnd(center, start);
        const vector90 = Vector3d.create();
        const radius = (this.useRadius ? this.radius : vector0.magnitude());
        const sweep = Angle.createRadians(this.useSweep ? this.sweep : Angle.pi2Radians);

        if (this.useRadius) {
          if (ArcMethod.StartCenter === this.method) {
            vector0.normalizeInPlace();
            center = start.plusScaled(vector0, -radius);
          }
        } else {
          this.radius = radius;
        }

        if (this.useLength) {
          sweep.setRadians(this.length / this.radius);
          if (sweep.radians > Angle.pi2Radians) {
            if (!isDynamics)
              IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, EditingTools.translate("CreateArc.Error.InvalidLength")));
            return undefined;
          }

          this.getUpVector(ev).crossProduct(vector0, vector90);
          vector0.scaleToLength(radius, vector0);
          vector90.scaleToLength(radius, vector90);

          const sideVec = Vector3d.createStartEnd(center, final);
          if (sideVec.dotProduct(vector90) < 0.0)
            sweep.setRadians(-sweep.radians);

          this.sweep = sweep.radians;
          this.syncToolSettingsArcProperties();

          return Arc3d.create(center, vector0, vector90, AngleSweep.create(sweep));
        }

        let defaultArc = (undefined !== this.current && "arc" === this.current.curvePrimitiveType ? this.current as Arc3d : undefined);
        if (undefined === defaultArc) {
          this.getUpVector(ev).crossProduct(vector0, vector90);
          vector0.scaleToLength(radius, vector0);
          vector90.scaleToLength(radius, vector90);

          // Create default arc that follows continuation path start/end tangent...
          if (undefined !== this.continuationData) {
            const pathS = this.continuationData.path.children[0].startPoint();

            if (start.isAlmostEqual(pathS)) {
              const tangentS = this.continuationData.path.children[0].fractionToPointAndUnitTangent(0.0);

              if (vector90.dotProduct(tangentS.direction) > 0.0)
                sweep.setRadians(-sweep.radians);
            } else {
              const tangentE = this.continuationData.path.children[this.continuationData.path.children.length - 1].fractionToPointAndUnitTangent(1.0);

              if (vector90.dotProduct(tangentE.direction) < 0.0)
                sweep.setRadians(-sweep.radians);
            }
          }

          defaultArc = Arc3d.create(center, vector0, vector90, AngleSweep.create(sweep));
        }

        // Don't have well defined minor axis, continue using previous or default arc...
        if (start.isAlmostEqual(end))
          return defaultArc;

        const prevSweep = Angle.createRadians(defaultArc.sweep.sweepRadians);
        Vector3d.createStartEnd(center, end, vector90);
        sweep.setFrom(vector0.planarAngleTo(vector90, defaultArc.perpendicularVector));

        defaultArc.perpendicularVector.crossProduct(vector0, vector90);
        vector0.scaleToLength(radius, vector0);
        vector90.scaleToLength(radius, vector90);

        const reverseTolerance = Angle.createDegrees(undefined === this.continuationData ? 135.0 : 30.0).radians;
        const isCurrentReversible = (Math.abs(sweep.radians) < reverseTolerance);
        const isPreviousReversible = prevSweep.isFullCircle || (Math.abs(prevSweep.radians) < reverseTolerance);

        if (isCurrentReversible && isPreviousReversible && ((sweep.radians < 0.0 && prevSweep.radians > 0.0) || (sweep.radians > 0.0 && prevSweep.radians < 0.0)))
          prevSweep.setRadians(-prevSweep.radians); // Reverse direction...

        if (sweep.isAlmostZero)
          sweep.setDegrees(prevSweep.radians < 0.0 ? -360.0 : 360.0); // Create full sweep...

        if (this.useSweep) {
          if ((sweep.radians < 0.0 && this.sweep > 0.0) || (sweep.radians > 0.0 && this.sweep < 0.0))
            sweep.setRadians(-this.sweep);
          else
            sweep.setRadians(this.sweep);
        } else if (!prevSweep.isFullCircle || undefined !== this.continuationData) {
          if (sweep.radians < 0.0 && prevSweep.radians > 0.0)
            sweep.setRadians(Angle.pi2Radians + sweep.radians);
          else if (sweep.radians > 0.0 && prevSweep.radians < 0.0)
            sweep.setRadians(-(Angle.pi2Radians - sweep.radians));

          this.sweep = sweep.radians;
        } else {
          this.sweep = sweep.radians;
        }

        this.length = radius * Math.abs(sweep.radians);
        this.syncToolSettingsArcProperties();

        return Arc3d.create(center, vector0, vector90, AngleSweep.create(sweep));
      }

      case ArcMethod.StartMidEnd: {
        const midSME = this.accepted[1];
        return Arc3d.createCircularStartMiddleEnd(start, midSME, end);
      }

      case ArcMethod.StartEndMid: {
        const midSEM = final;

        if (this.useRadius)
          return Arc3d.createCircularStartEndRadius(start, end, this.radius, midSEM);

        const result = Arc3d.createCircularStartMiddleEnd(start, midSEM, end);

        this.radius = ((result instanceof Arc3d) ? result.circularRadius() : undefined) ?? 0.0;
        this.syncToolSettingsArcProperties();

        return result;
      }

      case ArcMethod.StartTangent: {
        const tangent = Vector3d.createNormalizedStartEnd(this.accepted[1], final); // TODO: Skip getting tangent when continuing an existing curve...
        if (undefined === tangent)
          return undefined;

        const result = Arc3d.createCircularStartTangentEnd(this.accepted[1], tangent, start);
        if (!(result instanceof Arc3d))
          return undefined;

        result.reverseInPlace(); // Need to reverse to support join/close...
        return result;
      }

      case ArcMethod.TangentEnd: {
        const tangent = Vector3d.createNormalizedStartEnd(start, this.accepted[1]); // TODO: Skip getting tangent when continuing an existing curve...
        if (undefined === tangent)
          return undefined;

        const result = Arc3d.createCircularStartTangentEnd(start, tangent, end);
        if (!(result instanceof Arc3d))
          return undefined;

        if (this.useRadius) {
          const vector0 = result.vector0.scaleToLength(this.radius);
          const vector90 = result.vector90.scaleToLength(this.radius);
          if (undefined === vector0 || undefined === vector90)
            return undefined;

          const center = result.startPoint().minus(vector0);
          let sweep = vector0.planarRadiansTo(Vector3d.createStartEnd(center, final), this.getUpVector(ev));

          // Correct sweep for radius, current sweep tells us cw/ccw and small or large angle...
          if (result.sweep.sweepRadians > Math.PI)
            sweep = Math.PI + (Math.PI - Math.abs(sweep));
          else
            sweep = Math.abs(sweep);

          if (result.sweep.sweepRadians < 0.0)
            sweep = -sweep;

          return Arc3d.create(center, vector0, vector90, AngleSweep.createStartSweepRadians(0.0, sweep));
        } else {
          this.radius = result.circularRadius() ?? 0.0;
          this.syncToolSettingsArcProperties();
        }

        return result;
      }
    }
  }

  private syncToolSettingsArcProperties(): void {
    switch (this.method) {
      case ArcMethod.CenterStart:
      case ArcMethod.StartCenter:
        // Always need to sync length or sweep...
        break;

      case ArcMethod.StartEndMid:
      case ArcMethod.TangentEnd:
        if (this.useRadius)
          return;
        break;

      default:
        return;
    }

    const syncData: DialogPropertySyncItem[] = [];

    if (!this.useRadius)
      syncData.push(this.radiusProperty.syncItem);

    if (!this.useLength)
      syncData.push(this.lengthProperty.syncItem);

    if (!this.useSweep)
      syncData.push(this.sweepProperty.syncItem);

    if (0 !== syncData.length)
      this.syncToolSettingsProperties(syncData);
  }

  protected override getToolSettingPropertyLocked(property: DialogProperty<any>): DialogProperty<any> | undefined {
    if (property === this.useRadiusProperty)
      return this.radiusProperty;
    else if (property === this.useSweepProperty)
      return this.sweepProperty;
    else if (property === this.useLengthProperty)
      return this.lengthProperty;
    return undefined;
  }

  public override async bumpToolSetting(settingIndex?: number): Promise<boolean> {
    if (undefined !== settingIndex)
      return false;

    this.allowJoinClose = !this.allowJoinClose;
    this.syncToolSettingsProperties([this.allowJoinCloseProperty.syncItem]);
    return this.changeToolSettingPropertyValue(this.allowJoinCloseProperty.syncItem);
  }

  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    if (!this.changeToolSettingPropertyValue(updatedValue))
      return false;

    if (this.methodProperty.name === updatedValue.propertyName) {
      await this.onReinitialize();
    } else if (updatedValue.propertyName === this.radiusProperty.name && ArcMethod.StartCenter === this.method && this.useRadius && 2 === this.accepted.length) {
      await this.onUndoPreviousStep(); // If radius is changed when creating arc by start/center after center has been defined, back up a step to defined a new center point...
    } else if (updatedValue.propertyName === this.useSweepProperty.name) {
      if (!this.useSweep)
        return true;
      this.useLength = false; // Length determined by sweep...
      return this.changeToolSettingPropertyValue(this.useLengthProperty.syncItem);
    } else if (updatedValue.propertyName === this.useLengthProperty.name) {
      if (!this.useLength)
        return true;
      this.useSweep = false; // Sweep determined by length...
      return this.changeToolSettingPropertyValue(this.useSweepProperty.syncItem);
    }

    return true;
  }

  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    this.initializeToolSettingPropertyValues([this.methodProperty, this.radiusProperty, this.useRadiusProperty, this.lengthProperty, this.useLengthProperty, this.sweepProperty, this.useSweepProperty, this.allowJoinCloseProperty]);

    if (!this.sweep || this.useLength)
      this.useSweep = false;

    // ensure controls are enabled/disabled based on current lock property state
    this.radiusProperty.isDisabled = !this.useRadius;
    this.lengthProperty.isDisabled = !this.useLength || this.useSweep;
    this.sweepProperty.isDisabled = !this.useSweep || this.useLength;

    let row = 1;
    const toolSettings = new Array<DialogItem>();
    toolSettings.push(this.methodProperty.toDialogItem({ rowPriority: row++, columnIndex: 0 }));

    if (ArcMethod.CenterStart === this.method || ArcMethod.StartCenter === this.method) {
      const useRadiusLock = this.useRadiusProperty.toDialogItem({ rowPriority: row, columnIndex: 0 });
      toolSettings.push(this.radiusProperty.toDialogItem({ rowPriority: row++, columnIndex: 1 }, useRadiusLock));

      const useLengthLock = this.useLengthProperty.toDialogItem({ rowPriority: row, columnIndex: 0 });
      toolSettings.push(this.lengthProperty.toDialogItem({ rowPriority: row++, columnIndex: 1 }, useLengthLock));

      const useSweepLock = this.useSweepProperty.toDialogItem({ rowPriority: row, columnIndex: 0 });
      toolSettings.push(this.sweepProperty.toDialogItem({ rowPriority: row++, columnIndex: 1 }, useSweepLock));
    } else if (ArcMethod.StartEndMid === this.method) {
      const useRadiusLock = this.useRadiusProperty.toDialogItem({ rowPriority: row, columnIndex: 0 });
      toolSettings.push(this.radiusProperty.toDialogItem({ rowPriority: row++, columnIndex: 1 }, useRadiusLock));
    } else if (ArcMethod.TangentEnd === this.method) {
      const useRadiusLock = this.useRadiusProperty.toDialogItem({ rowPriority: row, columnIndex: 0 });
      toolSettings.push(this.radiusProperty.toDialogItem({ rowPriority: row++, columnIndex: 1 }, useRadiusLock));
    }

    toolSettings.push(this.allowJoinCloseProperty.toDialogItem({ rowPriority: row++, columnIndex: 0 }));
    return toolSettings;
  }

  public async onRestartTool(): Promise<void> {
    const tool = new CreateArcTool(this._creator3d, this._creator2d);
    if (!await tool.run())
      return this.exitTool();
  }
}

/** Option for how to define circle */
enum CircleMethod {
  CenterEdge = 0,
  EdgeCenter = 1,
  Diameter = 2,
  Edge = 3,
}

/** @internal Creates a circle. Uses model and category from [[BriefcaseConnection.editorToolSettings]]. */
export class CreateCircleTool extends CreateOrContinuePathTool {
  public static override toolId = "CreateCircle";
  public static override iconSpec = "icon-circle";

  protected override get showCurveConstructions(): boolean { return !(CircleMethod.CenterEdge === this.method && this.useRadius); }

  protected override setupAccuDraw(): void {
    const nPts = this.accepted.length;
    if (0 === nPts)
      return;

    const hints = new AccuDrawHintBuilder();

    if (this.wantSmartRotation)
      hints.enableSmartRotation = true;

    if (CircleMethod.CenterEdge === this.method && 1 === this.accepted.length) {
      hints.setOrigin(this.accepted[0]);
      hints.setOriginFixed = true;
      hints.setModePolar();
    }

    hints.sendHints();
  }

  private static methodMessage(str: string) { return EditingTools.translate(`CreateCircle.Method.${str}`); }
  private static getMethodChoices = (): EnumerationChoice[] => {
    return [
      { label: CreateCircleTool.methodMessage("CenterEdge"), value: CircleMethod.CenterEdge },
      { label: CreateCircleTool.methodMessage("EdgeCenter"), value: CircleMethod.EdgeCenter },
      { label: CreateCircleTool.methodMessage("Diameter"), value: CircleMethod.Diameter },
      { label: CreateCircleTool.methodMessage("Edge"), value: CircleMethod.Edge },
    ];
  };

  private _methodProperty: DialogProperty<number> | undefined;
  public get methodProperty() {
    if (!this._methodProperty)
      this._methodProperty = new DialogProperty<number>(PropertyDescriptionHelper.buildEnumPicklistEditorDescription(
        "circleMethod", EditingTools.translate("CreateCircle.Label.Method"), CreateCircleTool.getMethodChoices()), CircleMethod.CenterEdge as number);
    return this._methodProperty;
  }

  public get method(): CircleMethod { return this.methodProperty.value as CircleMethod; }
  public set method(method: CircleMethod) { this.methodProperty.value = method; }

  private _useRadiusProperty: DialogProperty<boolean> | undefined;
  public get useRadiusProperty() {
    if (!this._useRadiusProperty)
      this._useRadiusProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildLockPropertyDescription("useCircleRadius"), false);
    return this._useRadiusProperty;
  }

  public get useRadius(): boolean { return this.useRadiusProperty.value; }
  public set useRadius(value: boolean) { this.useRadiusProperty.value = value; }

  private _radiusProperty: DialogProperty<number> | undefined;
  public get radiusProperty() {
    if (!this._radiusProperty)
      this._radiusProperty = new DialogProperty<number>(new LengthDescription("circleRadius", EditingTools.translate("CreateCircle.Label.Radius")), 0.0, undefined, !this.useRadius);
    return this._radiusProperty;
  }

  public get radius(): number { return this.radiusProperty.value; }
  public set radius(value: number) { this.radiusProperty.value = value; }

  private _useDiameterProperty: DialogProperty<boolean> | undefined;
  public get useDiameterProperty() {
    if (!this._useDiameterProperty)
      this._useDiameterProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildLockPropertyDescription("useCircleDiameter"), false);
    return this._useDiameterProperty;
  }

  public get useDiameter(): boolean { return this.useDiameterProperty.value; }
  public set useDiameter(value: boolean) { this.useDiameterProperty.value = value; }

  private _diameterProperty: DialogProperty<number> | undefined;
  public get diameterProperty() {
    if (!this._diameterProperty)
      this._diameterProperty = new DialogProperty<number>(new LengthDescription("circleDiameter", EditingTools.translate("CreateCircle.Label.Diameter")), 0.0, undefined, !this.useDiameter);
    return this._diameterProperty;
  }

  public get diameter(): number { return this.diameterProperty.value; }
  public set diameter(value: number) { this.diameterProperty.value = value; }

  protected override isComplete(_ev: BeButtonEvent): boolean {
    if (CircleMethod.Edge === this.method)
      return (3 === this.accepted.length);
    else if (CircleMethod.CenterEdge === this.method && this.useRadius)
      return (this.accepted.length >= 1); // Could be 2 if radius locked after 1st data point...
    return (2 === this.accepted.length);
  }

  protected createNewCurvePrimitive(ev: BeButtonEvent, isDynamics: boolean): CurvePrimitive | undefined {
    this.isClosed = true;

    const numForCircle = (CircleMethod.Edge === this.method ? 2 : 1);
    const numRequired = isDynamics ? numForCircle : numForCircle + 1;
    if (this.accepted.length < numRequired) {
      if (CircleMethod.CenterEdge === this.method && this.useRadius)
        return Arc3d.createCenterNormalRadius(isDynamics ? this.getAdjustedPoint(ev) : this.accepted[0], this.getUpVector(ev), this.radius);
      return undefined;
    }

    if (CircleMethod.Edge === this.method) {
      const startPt = this.accepted[0];
      const midPt = this.accepted[1];
      const endPt = (isDynamics ? this.getAdjustedPoint(ev) : this.accepted[2]);

      const result = Arc3d.createCircularStartMiddleEnd(startPt, midPt, endPt);
      if (!(result instanceof Arc3d))
        return undefined;

      result.sweep = AngleSweep.create360();
      return result;
    }

    const pt1 = this.accepted[0];
    const pt2 = (isDynamics ? this.getAdjustedPoint(ev) : this.accepted[1]);
    const normal = this.getUpVector(ev);

    if (CircleMethod.Diameter === this.method) {
      const diameterVector0 = Vector3d.createStartEnd(pt2, pt1);
      const diameterVector90 = normal.crossProduct(diameterVector0);
      const diameter = (this.useDiameter ? this.diameter : diameterVector0.magnitude());

      if (!this.useDiameter) {
        this.diameter = diameter;
        this.syncToolSettingsProperties([this.diameterProperty.syncItem]);
      }

      const radiusFromDiameter = diameter * 0.5;
      diameterVector0.scaleToLength(radiusFromDiameter, diameterVector0);
      diameterVector90.scaleToLength(radiusFromDiameter, diameterVector90);

      const centerFromDiameter = pt1.plusScaled(diameterVector0, -1.0);
      return Arc3d.create(centerFromDiameter, diameterVector0, diameterVector90);
    }

    let center = (CircleMethod.CenterEdge === this.method ? pt1 : pt2);
    const edge = (CircleMethod.CenterEdge === this.method ? pt2 : pt1);

    const vector0 = Vector3d.createStartEnd(center, edge);
    const vector90 = normal.crossProduct(vector0);
    const radius = (this.useRadius ? this.radius : vector0.magnitude());

    if (this.useRadius) {
      if (CircleMethod.EdgeCenter === this.method) {
        vector0.normalizeInPlace();
        center = edge.plusScaled(vector0, -radius);
      }
    } else {
      this.radius = radius;
      this.syncToolSettingsProperties([this.radiusProperty.syncItem]);
    }

    vector0.scaleToLength(radius, vector0);
    vector90.scaleToLength(radius, vector90);

    return Arc3d.create(center, vector0, vector90);
  }

  protected override async cancelPoint(_ev: BeButtonEvent): Promise<boolean> {
    if (CircleMethod.CenterEdge === this.method && this.useRadius) {
      // Exit instead of restarting to avoid having circle "stuck" on cursor...
      await this.exitTool();
      return false;
    }
    return true;
  }

  protected override getToolSettingPropertyLocked(property: DialogProperty<any>): DialogProperty<any> | undefined {
    if (property === this.useRadiusProperty)
      return this.radiusProperty;
    else if (property === this.useDiameterProperty)
      return this.diameterProperty;

    return undefined;
  }

  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    if (!this.changeToolSettingPropertyValue(updatedValue))
      return false;

    if (this.methodProperty.name === updatedValue.propertyName)
      await this.onReinitialize();
    else if (updatedValue.propertyName === this.useRadiusProperty.name && CircleMethod.CenterEdge === this.method && this.useRadius && 0 === this.accepted.length)
      await this.onReinitialize();

    return true;
  }

  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    this.initializeToolSettingPropertyValues([this.methodProperty, this.radiusProperty, this.useRadiusProperty, this.diameterProperty, this.useDiameterProperty]);

    const toolSettings = new Array<DialogItem>();
    toolSettings.push(this.methodProperty.toDialogItem({ rowPriority: 1, columnIndex: 0 }));

    // ensure controls are enabled/disabled based on current lock property state
    if (CircleMethod.Edge === this.method) {
      this.diameterProperty.isDisabled = true;
      this.radiusProperty.isDisabled = true;
    } else if (CircleMethod.Diameter === this.method) {
      this.diameterProperty.isDisabled = !this.useDiameter;
      this.radiusProperty.isDisabled = true;
      const useDiameterLock = this.useDiameterProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 });
      toolSettings.push(this.diameterProperty.toDialogItem({ rowPriority: 2, columnIndex: 1 }, useDiameterLock));
    } else {
      this.radiusProperty.isDisabled = !this.useRadius;
      this.diameterProperty.isDisabled = true;
      const useRadiusLock = this.useRadiusProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 });
      toolSettings.push(this.radiusProperty.toDialogItem({ rowPriority: 2, columnIndex: 1 }, useRadiusLock));
    }

    return toolSettings;
  }

  public async onRestartTool(): Promise<void> {
    const tool = new CreateCircleTool(this._creator3d, this._creator2d);
    if (!await tool.run())
      return this.exitTool();
  }

  public override async onReinitialize(): Promise<void> {
    if (CircleMethod.CenterEdge === this.method && this.useRadius && !this.radiusProperty.isDisabled) {
      // Don't install a new tool instance, we want to preserve current AccuDraw state...
      this.accepted.length = 0;
      this.setupAndPromptForNextAction();
      this.beginDynamics();
      return;
    }
    return super.onReinitialize();
  }

  public override async onPostInstall() {
    await super.onPostInstall();
    if (CircleMethod.CenterEdge === this.method && this.useRadius) {
      // Start dynamics before 1st data point when placing by center w/locked radius value.
      // Require the user to explicitly enable AccuDraw so that the compass location can be adjusted for changes
      // to locks or view ACS (as opposed to appearing at it's previous or default location).
      AccuDrawHintBuilder.deactivate();
      this.beginDynamics();
    }
  }
}

/** Option for how to define ellipse */
enum EllipseMethod {
  Center = 0,
  Edge = 1,
}

/** @internal Creates an ellipse. Uses model and category from [[BriefcaseConnection.editorToolSettings]]. */
export class CreateEllipseTool extends CreateOrContinuePathTool {
  public static override toolId = "CreateEllipse";
  public static override iconSpec = "icon-ellipse";

  protected override isComplete(_ev: BeButtonEvent): boolean {
    return (3 === this.accepted.length);
  }

  private static methodMessage(str: string) { return EditingTools.translate(`CreateEllipse.Method.${str}`); }
  private static getMethodChoices = (): EnumerationChoice[] => {
    return [
      { label: CreateEllipseTool.methodMessage("Center"), value: EllipseMethod.Center },
      { label: CreateEllipseTool.methodMessage("Edge"), value: EllipseMethod.Edge },
    ];
  };

  private _methodProperty: DialogProperty<number> | undefined;
  public get methodProperty() {
    if (!this._methodProperty)
      this._methodProperty = new DialogProperty<number>(PropertyDescriptionHelper.buildEnumPicklistEditorDescription(
        "ellipseMethod", EditingTools.translate("CreateEllipse.Label.Method"), CreateEllipseTool.getMethodChoices()), EllipseMethod.Edge as number);
    return this._methodProperty;
  }

  public get method(): EllipseMethod { return this.methodProperty.value as EllipseMethod; }
  public set method(method: EllipseMethod) { this.methodProperty.value = method; }

  protected override setupAccuDraw(): void {
    const nPts = this.accepted.length;
    if (0 === nPts)
      return;

    const hints = new AccuDrawHintBuilder();

    if (this.wantSmartRotation)
      hints.enableSmartRotation = true;

    if (EllipseMethod.Center === this.method) {
      switch (nPts) {
        case 1:
          hints.setOrigin(this.accepted[0]);
          hints.setOriginFixed = true;
          break;
        case 2:
          hints.setXAxis(Vector3d.createStartEnd(this.accepted[0], this.accepted[1]));
          hints.setLockX = true;
          break;
      }
    } else {
      hints.setOrigin(this.accepted[0]); // First and last point define the major axis...
      hints.setOriginFixed = true;
    }

    hints.sendHints();
  }

  protected createNewCurvePrimitive(ev: BeButtonEvent, isDynamics: boolean): CurvePrimitive | undefined {
    const numRequired = (isDynamics ? 2 : 3);
    if (this.accepted.length < numRequired) {
      if (this.accepted.length < (numRequired - 1))
        return undefined;
      if (EllipseMethod.Center !== this.method)
        return undefined;
      this.isConstruction = true; // Create construction geometry to show  major axis...
      return LineString3d.create([this.accepted[0], (isDynamics ? this.getAdjustedPoint(ev) : this.accepted[1])]);
    }

    this.isClosed = true;

    if (EllipseMethod.Center === this.method) {
      const center = this.accepted[0];
      const major = this.accepted[1];

      const normal = this.getUpVector(ev);
      const vector0 = Vector3d.createStartEnd(center, major);
      const vector90 = normal.crossProduct(vector0);

      const dir = Ray3d.create(center, vector90);
      const minor = dir.projectPointToRay(isDynamics ? this.getAdjustedPoint(ev) : this.accepted[2]);

      vector90.scaleToLength(center.distance(minor), vector90);

      return Arc3d.create(center, vector0, vector90);
    }

    const point0 = this.accepted[0];
    const point1 = this.accepted[1];
    const point2 = isDynamics ? this.getAdjustedPoint(ev) : this.accepted[2];

    return Arc3d.createStartMiddleEnd(point0, point1, point2);
  }

  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    if (!this.changeToolSettingPropertyValue(updatedValue))
      return false;

    if (this.methodProperty.name === updatedValue.propertyName)
      await this.onReinitialize();

    return true;
  }

  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    this.initializeToolSettingPropertyValues([this.methodProperty]);

    const toolSettings = new Array<DialogItem>();
    toolSettings.push(this.methodProperty.toDialogItem({ rowPriority: 1, columnIndex: 0 }));

    return toolSettings;
  }

  public async onRestartTool(): Promise<void> {
    const tool = new CreateEllipseTool(this._creator3d, this._creator2d);
    if (!await tool.run())
      return this.exitTool();
  }
}

/** Option for how to define rectangle */
enum RectangleMethod {
  Corner = 0,
  Edge = 1,
}

/** @internal Creates a rectangle by corner points. Uses model and category from [[BriefcaseConnection.editorToolSettings]]. */
export class CreateRectangleTool extends CreateOrContinuePathTool {
  public static override toolId = "CreateRectangle";
  public static override iconSpec = "icon-rectangle";

  protected localToWorld = Transform.createIdentity();
  protected worldToLocal = Transform.createIdentity();

  protected override setupAccuDraw(): void {
    const nPts = this.accepted.length;
    if (0 === nPts)
      return;

    const hints = new AccuDrawHintBuilder();

    if (1 === nPts) {
      if (this.wantSmartRotation)
        hints.enableSmartRotation = true;

      hints.setOriginFixed = true;
      hints.setOrigin(this.accepted[0]);

      if (RectangleMethod.Edge === this.method)
        hints.setModePolar();
      else
        hints.setModeRectangular();
    } else if (2 === nPts && RectangleMethod.Edge === this.method) {
      hints.setModeRectangular();
      hints.setXAxis(Vector3d.createStartEnd(this.accepted[0], this.accepted[1]));
      hints.setLockX = true;
    }

    hints.sendHints();
  }

  private static methodMessage(str: string) { return EditingTools.translate(`CreateRectangle.Method.${str}`); }
  private static getMethodChoices = (): EnumerationChoice[] => {
    return [
      { label: CreateRectangleTool.methodMessage("Corner"), value: RectangleMethod.Corner },
      { label: CreateRectangleTool.methodMessage("Edge"), value: RectangleMethod.Edge },
    ];
  };

  private _methodProperty: DialogProperty<number> | undefined;
  public get methodProperty() {
    if (!this._methodProperty)
      this._methodProperty = new DialogProperty<number>(PropertyDescriptionHelper.buildEnumPicklistEditorDescription(
        "rectangleMethod", EditingTools.translate("CreateRectangle.Label.Method"), CreateRectangleTool.getMethodChoices()), RectangleMethod.Corner as number);
    return this._methodProperty;
  }

  public get method(): RectangleMethod { return this.methodProperty.value as RectangleMethod; }
  public set method(method: RectangleMethod) { this.methodProperty.value = method; }

  private _useRadiusProperty: DialogProperty<boolean> | undefined;
  public get useRadiusProperty() {
    if (!this._useRadiusProperty)
      this._useRadiusProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildLockPropertyDescription("useCornerRadius"), false);
    return this._useRadiusProperty;
  }

  public get useRadius(): boolean { return this.useRadiusProperty.value; }
  public set useRadius(value: boolean) { this.useRadiusProperty.value = value; }

  private _radiusProperty: DialogProperty<number> | undefined;
  public get radiusProperty() {
    if (!this._radiusProperty)
      this._radiusProperty = new DialogProperty<number>(new LengthDescription("cornerRadius", EditingTools.translate("CreateRectangle.Label.CornerRadius")), 0.0, undefined, !this.useRadius);
    return this._radiusProperty;
  }

  public get radius(): number { return this.radiusProperty.value; }
  public set radius(value: number) { this.radiusProperty.value = value; }

  protected override isComplete(_ev: BeButtonEvent): boolean {
    return (this.accepted.length === (RectangleMethod.Edge === this.method ? 3 : 2));
  }

  protected createNewCurvePrimitive(ev: BeButtonEvent, isDynamics: boolean): CurvePrimitive | undefined {
    const numForShape = (RectangleMethod.Edge === this.method ? 2 : 1);
    const numRequired = isDynamics ? numForShape : numForShape + 1;
    if (this.accepted.length < numRequired) {
      if (isDynamics && 1 === this.accepted.length) {
        this.isConstruction = true;
        return LineString3d.create([this.accepted[0], this.getAdjustedPoint(ev)]);
      }
      return undefined;
    }

    const origin = this.accepted[0];
    const corner = (isDynamics ? this.getAdjustedPoint(ev) : this.accepted[(RectangleMethod.Edge === this.method ? 2 : 1)]);
    const matrix = this.getCurrentRotation(ev);

    Transform.createOriginAndMatrix(Point3d.createZero(), matrix, this.localToWorld);
    if (undefined === this.localToWorld.inverse(this.worldToLocal))
      return undefined;

    if (RectangleMethod.Edge === this.method && ev.viewport) {
      const edgeDir = Vector3d.createStartEnd(origin, this.accepted[1]);
      const lineDir = edgeDir.crossProduct(matrix.getColumn(2));
      const fixedCorner = AccuDrawHintBuilder.projectPointToLineInView(corner, this.accepted[1], lineDir, ev.viewport, true);

      if (undefined === fixedCorner)
        return undefined;

      corner.setFrom(fixedCorner);
    }

    const originLocal = this.localToWorld.multiplyInversePoint3d(origin);
    const cornerLocal = this.localToWorld.multiplyInversePoint3d(corner);

    if (undefined === originLocal || undefined === cornerLocal)
      return undefined;

    if (Geometry.isSameCoordinate(originLocal.x, cornerLocal.x) || Geometry.isSameCoordinate(originLocal.y, cornerLocal.y))
      return undefined;

    const shapePts: Point3d[] = [];

    shapePts[0] = Point3d.create(originLocal.x, originLocal.y, originLocal.z);
    shapePts[1] = Point3d.create(cornerLocal.x, originLocal.y, cornerLocal.z);
    shapePts[2] = Point3d.create(cornerLocal.x, cornerLocal.y, cornerLocal.z);
    shapePts[3] = Point3d.create(originLocal.x, cornerLocal.y, originLocal.z);
    shapePts[4] = shapePts[0].clone();

    this.localToWorld.multiplyPoint3dArrayInPlace(shapePts);
    this.isClosed = true;

    return LineString3d.create(shapePts);
  }

  protected override createNewPath(placement: PlacementProps): JsonGeometryStream | FlatBufferGeometryStream | undefined {
    if (!this.useRadius || 0.0 === this.radius)
      return super.createNewPath(placement);

    if (undefined === this.current || "lineString" !== this.current.curvePrimitiveType)
      return undefined;

    const rectangle = this.current as LineString3d;
    const shapePts = rectangle.points;
    if (shapePts.length < 3)
      return undefined;

    this.worldToLocal.multiplyPoint3dArrayInPlace(shapePts);
    const loop = CurveFactory.createRectangleXY(shapePts[0].x, shapePts[0].y, shapePts[2].x, shapePts[2].y, shapePts[0].z, this.radius);
    loop.tryTransformInPlace(this.localToWorld);

    this.isClosed = true;
    return this.createNewPathGeometryProps(placement, loop);
  }

  protected override getToolSettingPropertyLocked(property: DialogProperty<any>): DialogProperty<any> | undefined {
    return (property === this.useRadiusProperty ? this.radiusProperty : undefined);
  }

  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    if (!this.changeToolSettingPropertyValue(updatedValue))
      return false;

    if (this.methodProperty.name === updatedValue.propertyName && 0 !== this.accepted.length)
      await this.onReinitialize();

    return true;
  }

  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    this.initializeToolSettingPropertyValues([this.methodProperty, this.radiusProperty, this.useRadiusProperty]);

    const toolSettings = new Array<DialogItem>();
    toolSettings.push(this.methodProperty.toDialogItem({ rowPriority: 1, columnIndex: 0 }));

    // ensure controls are enabled/disabled based on current lock property state
    this.radiusProperty.isDisabled = !this.useRadius;
    const useRadiusLock = this.useRadiusProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 });
    toolSettings.push(this.radiusProperty.toDialogItem({ rowPriority: 2, columnIndex: 1 }, useRadiusLock));

    return toolSettings;
  }

  public async onRestartTool(): Promise<void> {
    const tool = new CreateRectangleTool(this._creator3d, this._creator2d);
    if (!await tool.run())
      return this.exitTool();
  }
}

/** Option for how to define spline curve */
enum BCurveMethod {
  ControlPoints = 0,
  ThroughPoints = 1,
}

/** @internal Creates a bspline curve by poles or through points. Uses model and category from [[BriefcaseConnection.editorToolSettings]]. */
export class CreateBCurveTool extends CreateOrContinuePathTool {
  public static override toolId = "CreateBCurve";
  public static override iconSpec = "icon-snaps-nearest"; // TODO: Need better icon...

  protected _isPhysicallyClosedOrComplete = false;
  protected _tangentPhase = CreateCurvePhase.DefineOther;

  protected override get wantPickableDynamics(): boolean { return true; } // Allow snapping to control polygon or through points...
  protected override get showCurveConstructions(): boolean { return true; } // Display control polygon or through points...
  protected override get allowEnterKeyToAccept(): boolean { return true; }

  protected override setupAccuDraw(): void {
    if (CreateCurvePhase.DefineOther !== this._tangentPhase && undefined !== this.current) {
      const hints = new AccuDrawHintBuilder();
      const pointAndTangent = this.current.fractionToPointAndUnitTangent(CreateCurvePhase.DefineStart === this._tangentPhase ? 0.0 : 1.0);

      hints.setOrigin(pointAndTangent.origin);
      hints.setXAxis(pointAndTangent.direction);
      hints.sendHints();
      return;
    }

    super.setupAccuDraw();
  }

  private static methodMessage(str: string) { return EditingTools.translate(`CreateBCurve.Method.${str}`); }
  private static getMethodChoices = (): EnumerationChoice[] => {
    return [
      { label: CreateBCurveTool.methodMessage("ControlPoints"), value: BCurveMethod.ControlPoints },
      { label: CreateBCurveTool.methodMessage("ThroughPoints"), value: BCurveMethod.ThroughPoints },
    ];
  };

  private _methodProperty: DialogProperty<number> | undefined;
  public get methodProperty() {
    if (!this._methodProperty)
      this._methodProperty = new DialogProperty<number>(PropertyDescriptionHelper.buildEnumPicklistEditorDescription(
        "bcurveMethod", EditingTools.translate("CreateBCurve.Label.Method"), CreateBCurveTool.getMethodChoices()), BCurveMethod.ControlPoints as number);
    return this._methodProperty;
  }

  public get method(): BCurveMethod { return this.methodProperty.value as BCurveMethod; }
  public set method(method: BCurveMethod) { this.methodProperty.value = method; }

  private _orderProperty: DialogProperty<number> | undefined;
  public get orderProperty() {
    if (!this._orderProperty)
      this._orderProperty = new DialogProperty<number>(
        PropertyDescriptionHelper.buildNumberEditorDescription("bcurveOrder", EditingTools.translate("CreateBCurve.Label.Order"),
          { type: PropertyEditorParamTypes.Range, minimum: this.minOrder, maximum: this.maxOrder } as RangeEditorParams), 3);
    return this._orderProperty;
  }

  public get order(): number { return this.orderProperty.value; }
  public set order(value: number) { this.orderProperty.value = value; }

  protected get minOrder(): number { return 2; }
  protected get maxOrder(): number { return 16; }

  private _tangentsProperty: DialogProperty<boolean> | undefined;
  public get tangentsProperty() {
    if (!this._tangentsProperty)
      this._tangentsProperty = new DialogProperty<boolean>(
        PropertyDescriptionHelper.buildToggleDescription("bcurveTangents", EditingTools.translate("CreateBCurve.Label.Tangents")), false);
    return this._tangentsProperty;
  }

  public get tangents(): boolean { return this.tangentsProperty.value; }
  public set tangents(value: boolean) { this.tangentsProperty.value = value; }

  private _allowJoinCloseProperty: DialogProperty<boolean> | undefined;
  public get allowJoinCloseProperty() {
    if (!this._allowJoinCloseProperty)
      this._allowJoinCloseProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildToggleDescription("bcurveJoinClose", EditingTools.translate("CreateBCurve.Label.JoinClose")), false);
    return this._allowJoinCloseProperty;
  }

  public get allowJoinClose(): boolean { return this.allowJoinCloseProperty.value; }
  public set allowJoinClose(value: boolean) { this.allowJoinCloseProperty.value = value; }

  protected override get wantJoin(): boolean {
    return this.allowJoinClose;
  }

  protected override get wantClosure(): boolean {
    // A bcurve can support physical closure when creating a new path...
    return this.allowJoinClose;
  }

  protected get requiredPointCount(): number {
    if (BCurveMethod.ThroughPoints === this.method)
      return 3; // Interpolation curve is always order 4 with 3 point minimum...

    return this.order;
  }

  protected override get createCurvePhase(): CreateCurvePhase {
    if (CreateCurvePhase.DefineOther !== this._tangentPhase)
      return CreateCurvePhase.DefineOther;

    return super.createCurvePhase;
  }

  protected override updateCurvePhase(): void {
    // The first point changes startPoint and last point changes endPoint.
    this._createCurvePhase = (0 === this.accepted.length ? CreateCurvePhase.DefineStart : CreateCurvePhase.DefineEnd);
  }

  protected override isComplete(ev: BeButtonEvent): boolean {
    // Accept on reset with sufficient points...
    if (BeButton.Reset === ev.button)
      return (this.accepted.length >= this.requiredPointCount);

    // Allow data to complete on physical closure...
    return this.isClosed || this._isPhysicallyClosedOrComplete;
  }

  protected override showConstructionGraphics(ev: BeButtonEvent, context: DynamicsContext): boolean {
    if (CreateCurvePhase.DefineOther !== this._tangentPhase && this.current) {
      const fitCurve = this.current as InterpolationCurve3d;
      const builder = context.createGraphic({ type: GraphicType.WorldOverlay });
      const color = context.viewport.getContrastToBackgroundColor();

      builder.setSymbology(color, ColorDef.black, 1, LinePixels.Code2);
      builder.addLineString([this.getAdjustedPoint(ev), fitCurve.options.fitPoints[CreateCurvePhase.DefineStart === this._tangentPhase ? 0 : fitCurve.options.fitPoints.length - 1]]);

      builder.setSymbology(color, ColorDef.black, 8);
      builder.addPointString([this.getAdjustedPoint(ev)]);

      context.addGraphic(builder.finish());
    }

    return super.showConstructionGraphics(ev, context);
  }

  protected createNewCurvePrimitive(ev: BeButtonEvent, isDynamics: boolean): CurvePrimitive | undefined {
    if (CreateCurvePhase.DefineOther !== this._tangentPhase && this.current) {
      const fitCurve = this.current as InterpolationCurve3d;

      if (CreateCurvePhase.DefineStart === this._tangentPhase) {
        const tangentS = Vector3d.createStartEnd(this.getAdjustedPoint(ev), fitCurve.options.fitPoints[0]);
        if (tangentS.magnitude() > Geometry.smallMetricDistance)
          fitCurve.options.startTangent = tangentS;
      } else {
        const tangentE = Vector3d.createStartEnd(this.getAdjustedPoint(ev), fitCurve.options.fitPoints[fitCurve.options.fitPoints.length - 1]);
        if (tangentE.magnitude() > Geometry.smallMetricDistance)
          fitCurve.options.endTangent = tangentE;
      }

      return fitCurve;
    }

    // Don't include current point if it's the same as the last accepted point, want dynamics to show an accurate preview of what reset will accept...
    const includeCurrPt = (isDynamics && (0 === this.accepted.length || !this.getAdjustedPoint(ev).isAlmostEqual(this.accepted[this.accepted.length - 1])));
    const pts = (includeCurrPt ? [...this.accepted, this.getAdjustedPoint(ev)] : this.accepted);
    const numRequired = this.requiredPointCount;

    if (pts.length < numRequired) {
      // Create point and line string construction geometry to support join...
      this.isConstruction = true;
      return LineString3d.create(1 === pts.length ? [pts[0], pts[0]] : pts);
    }

    // Create periodic-looking curve on physical closure with sufficient points even when not creating a loop/surface...
    this._isPhysicallyClosedOrComplete = (undefined === this.continuationData && pts[0].isAlmostEqual(pts[pts.length - 1]));

    if (BCurveMethod.ControlPoints === this.method) {
      if (this._isPhysicallyClosedOrComplete && this.order > 2) {
        const tmpPts = pts.slice(undefined, -1); // Don't include closure point...
        return BSplineCurve3d.createPeriodicUniformKnots(tmpPts, this.order);
      }

      return BSplineCurve3d.createUniformKnots(pts, this.order);
    }

    const interpolationProps: InterpolationCurve3dProps = { fitPoints: pts, closed: this._isPhysicallyClosedOrComplete, isChordLenKnots: 1, isColinearTangents: 1 };

    // Create interpolation curve tangent to continuation curve...
    if (undefined !== this.continuationData && this.tangents) {
      const tangentS = this.continuationData.path.children[0].fractionToPointAndUnitTangent(0.0);
      const tangentE = this.continuationData.path.children[this.continuationData.path.children.length - 1].fractionToPointAndUnitTangent(1.0);

      if (pts[0].isAlmostEqual(tangentS.origin))
        interpolationProps.startTangent = tangentS.direction.scale(-1);
      else if (pts[0].isAlmostEqual(tangentE.origin))
        interpolationProps.startTangent = tangentE.direction;

      if (pts[pts.length - 1].isAlmostEqual(tangentS.origin))
        interpolationProps.endTangent = tangentS.direction.scale(-1);
      else if (pts[pts.length - 1].isAlmostEqual(tangentE.origin))
        interpolationProps.endTangent = tangentE.direction;

      this._isPhysicallyClosedOrComplete = (undefined !== interpolationProps.startTangent && undefined !== interpolationProps.endTangent);
    }

    const interpolationOpts = InterpolationCurve3dOptions.create(interpolationProps);

    return InterpolationCurve3d.createCapture(interpolationOpts);
  }

  protected override getSnapGeometry(): GeometryQuery | undefined {
    // Only snap to through points...
    if (BCurveMethod.ThroughPoints === this.method)
      return (this.accepted.length > 1 ? PointString3d.create(this.accepted) : undefined);

    return super.getSnapGeometry();
  }

  protected override async acceptPoint(ev: BeButtonEvent): Promise<boolean> {
    switch (this._tangentPhase) {
      case CreateCurvePhase.DefineOther:
        return super.acceptPoint(ev);

      case CreateCurvePhase.DefineStart:
        this._tangentPhase = CreateCurvePhase.DefineEnd;
        break;

      case CreateCurvePhase.DefineEnd:
        this._isPhysicallyClosedOrComplete = true;
        break;
    }

    await this.updateCurveAndContinuationData(ev, false);
    return true;
  }

  protected override async cancelPoint(ev: BeButtonEvent): Promise<boolean> {
    // NOTE: Starting another tool will not create element...require reset or closure...
    if (this.isComplete(ev)) {
      if (BCurveMethod.ThroughPoints === this.method && this.tangents && this.current) {
        const fitCurve = this.current as InterpolationCurve3d;

        switch (this._tangentPhase) {
          case CreateCurvePhase.DefineOther:
            this._createCurvePhase = CreateCurvePhase.DefineEnd;
            await this.updateCurveAndContinuationData(ev, false);
            this._tangentPhase = (undefined === fitCurve.options.startTangent ? CreateCurvePhase.DefineStart : CreateCurvePhase.DefineEnd);
            IModelApp.toolAdmin.simulateMotionEvent();
            this.setupAndPromptForNextAction();
            return false;

          case CreateCurvePhase.DefineStart:
            fitCurve.options.startTangent = undefined; // Not accepted, compute default start tangent...
            this._tangentPhase = CreateCurvePhase.DefineEnd;
            IModelApp.toolAdmin.simulateMotionEvent();
            this.setupAndPromptForNextAction();
            return false;

          case CreateCurvePhase.DefineEnd:
            fitCurve.options.endTangent = undefined; // Not accepted, compute default end tangent...
            await this.createElement();
            return true;
        }
      }

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
    if (!this.changeToolSettingPropertyValue(updatedValue))
      return false;

    if (this.methodProperty.name === updatedValue.propertyName)
      await this.onReinitialize();

    return true;
  }

  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    this.initializeToolSettingPropertyValues([this.methodProperty, this.orderProperty, this.tangentsProperty, this.allowJoinCloseProperty]);

    const toolSettings = new Array<DialogItem>();
    toolSettings.push(this.methodProperty.toDialogItem({ rowPriority: 1, columnIndex: 0 }));

    if (BCurveMethod.ThroughPoints === this.method)
      toolSettings.push(this.tangentsProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 }));
    else
      toolSettings.push(this.orderProperty.toDialogItem({ rowPriority: 2, columnIndex: 1 }));

    toolSettings.push(this.allowJoinCloseProperty.toDialogItem({ rowPriority: 3, columnIndex: 0 }));
    return toolSettings;
  }

  public async onRestartTool(): Promise<void> {
    const tool = new CreateBCurveTool(this._creator3d, this._creator2d);
    if (!await tool.run())
      return this.exitTool();
  }
}

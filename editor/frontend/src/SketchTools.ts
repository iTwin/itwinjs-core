/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@bentley/bentleyjs-core";
import {
  CurveCollection,
  CurvePrimitive,
  FrameBuilder,
  Geometry,
  IModelJson, LineString3d, Loop, Path, Plane3dByOriginAndUnitNormal, Point3d, RegionOps, Vector3d, YawPitchRollAngles,
} from "@bentley/geometry-core";
import {
  Code, ColorDef, ElementGeometry, FlatBufferGeometryStream, GeometricElementProps, GeometryParams, GeometryStreamProps, isPlacement3dProps, JsonGeometryStream, PlacementProps,
} from "@bentley/imodeljs-common";
import {
  AccuDrawHintBuilder, BeButtonEvent, BeModifierKeys, CoreTools, DecorateContext, DynamicsContext,
  EventHandled, GraphicType, HitDetail, IModelApp, NotifyMessageDetails, OutputMessagePriority, SnapDetail, TentativeOrAccuSnap, ToolAssistance, ToolAssistanceImage, ToolAssistanceInputMethod, ToolAssistanceInstruction, ToolAssistanceSection,
} from "@bentley/imodeljs-frontend";
import { BasicManipulationCommandIpc, editorBuiltInCmdIds } from "@bentley/imodeljs-editor-common";
import { computeChordToleranceFromPoint, CreateElementTool, DynamicGraphicsProvider } from "./CreateElementTool";
import { EditTools } from "./EditTool";

/** @alpha Base class for creating open and closed paths. */
export abstract class CreateOrContinuePathTool extends CreateElementTool {
  protected current?: CurvePrimitive;
  protected continuationData?: { props: GeometricElementProps, path: Path, params: GeometryParams };
  protected isClosed = false;
  protected readonly accepted: Point3d[] = [];
  protected _graphicsProvider?: DynamicGraphicsProvider;
  protected _startedCmd?: string;

  protected async startCommand(): Promise<string> {
    if (undefined !== this._startedCmd)
      return this._startedCmd;
    return EditTools.startCommand<string>(editorBuiltInCmdIds.cmdBasicManipulation, this.iModel.key);
  }

  public static callCommand<T extends keyof BasicManipulationCommandIpc>(method: T, ...args: Parameters<BasicManipulationCommandIpc[T]>): ReturnType<BasicManipulationCommandIpc[T]> {
    return EditTools.callCommand(method, ...args) as ReturnType<BasicManipulationCommandIpc[T]>;
  }

  protected get wantAccuSnap(): boolean { return true; }
  protected get wantDynamics(): boolean { return true; }

  /** Convenience method to check whether control key is currently down w/o having a button event. */
  protected get isControlDown(): boolean { return IModelApp.toolAdmin.currentInputState.isControlDown; }

  protected get allowJoin(): boolean { return this.isControlDown; } // might be better as tool setting...
  protected get allowClosure(): boolean { return this.isControlDown; } // might be better as tool setting...
  protected get allowSimplify(): boolean { return true; }

  protected get wantSmartRotation(): boolean { return this.wantJoin; }
  protected get wantJoin(): boolean { return this.allowJoin; }
  protected get wantClosure(): boolean { return this.isContinueExistingPath && this.allowClosure; }
  protected get wantSimplify(): boolean { return this.allowSimplify; }

  protected get showJoin(): boolean { return 0 === this.accepted.length && undefined !== this.continuationData; }
  protected get showClosure(): boolean { return this.isClosed; }

  protected abstract createNewCurvePrimitive(_ev?: BeButtonEvent): CurvePrimitive | undefined;

  protected get isContinueExistingPath(): boolean { return undefined !== this.continuationData; }

  protected async isValidForContinue(snap: SnapDetail): Promise<{ props: GeometricElementProps, path: Path, params: GeometryParams } | undefined> {
    if (!snap.isElementHit)
      return;

    const snapCurve = snap.getCurvePrimitive();
    if (undefined === snapCurve)
      return;

    const curveS = snapCurve.startPoint();
    const curveE = snapCurve.endPoint();

    if (curveS.isAlmostEqual(curveE))
      return; // reject physically closed curve primitive...

    const snapPt = snap.adjustedPoint;
    if (!(snapPt.isAlmostEqual(curveS) || snapPt.isAlmostEqual(curveE)))
      return; // no point to further checks if snap wasn't to endpoint of curve primitive...

    try {
      this._startedCmd = await this.startCommand();
      const info = await CreateOrContinuePathTool.callCommand("requestElementGeometry", snap.sourceId, { maxDisplayable: 1, geometry: { curves: true, surfaces: false, solids: false}});
      if (undefined === info)
        return;

      const it = new ElementGeometry.Iterator(info);
      it.requestWorldCoordinates();

      let path;
      let params;

      for (const entry of it) {
        const geom = entry.toGeometryQuery();
        if (undefined === geom)
          return;

        if ("curvePrimitive" === geom.geometryCategory) {
          const curve = geom as CurvePrimitive;

          curve.startPoint(curveS);
          curve.endPoint(curveE);

          if (curveS.isAlmostEqual(curveE))
            return; // reject zero length lines, physically closed arcs, linestrings, etc...

          path = Path.create(curve);
          params = entry.geomParams;
        } else if ("curveCollection" === geom.geometryCategory) {
          const curves = geom as CurveCollection;
          if (!curves.isOpenPath)
            return;

          path = curves as Path;
          path.children[0].startPoint(curveS);
          path.children[path.children.length-1].endPoint(curveE);

          if (curveS.isAlmostEqual(curveE))
            return; // reject physically closed path...

          params = entry.geomParams;
        } else {
          return;
        }

        break; // filter option ensured single geometric entry...
      }

      if (undefined === path || undefined === params)
        return;

      const props = await this.iModel.elements.loadProps(snap.sourceId) as GeometricElementProps;
      if (undefined === props)
        return;

      return { props, path, params };
    } catch (err) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, err.toString()));
      return;
    }
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

    this.continuationData = data;
    if (this.isPathEndPoint())
      return true;

    this.continuationData = undefined;
    return false;
  }

  protected isValidForClosure(): boolean {
    this.isClosed = false;

    if (!this.wantClosure)
      return false;

    return (this.isClosed = this.isPathClosurePoint());
  }

  protected isPathEndPoint(): boolean {
    if (undefined === this.current || undefined === this.continuationData)
      return false;

    const curveS = this.current.startPoint();
    const pathS = this.continuationData.path.children[0].startPoint();
    const pathE = this.continuationData.path.children[this.continuationData.path.children.length - 1].endPoint();

    if (!(curveS.isAlmostEqual(pathS) || curveS.isAlmostEqual(pathE)))
      return false;

    return true;
  }

  protected isPathClosurePoint(): boolean {
    if (undefined === this.current)
      return false;

    const length = this.current.quickLength();
    if (length < Geometry.smallMetricDistance)
      return false;

    const curveS = this.current.startPoint();
    const curveE = this.current.endPoint();

    if (undefined === this.continuationData) {
      if (!curveS.isAlmostEqual(curveE))
        return false;

      const curveLocalToWorld = FrameBuilder.createRightHandedFrame(undefined, this.current);
      if (undefined === curveLocalToWorld)
        return false;

      // Don't create a region unless new curve is planar...
      const curvePlane = Plane3dByOriginAndUnitNormal.create(curveLocalToWorld.getOrigin(), curveLocalToWorld.matrix.getColumn(2));
      return (undefined !== curvePlane && this.current.isInPlane(curvePlane));
    }

    const pathS = this.continuationData.path.children[0].startPoint();
    const pathE = this.continuationData.path.children[this.continuationData.path.children.length-1].endPoint();

    if (!(curveS.isAlmostEqual(pathS) && curveE.isAlmostEqual(pathE) || curveS.isAlmostEqual(pathE) && curveE.isAlmostEqual(pathS)))
      return false;

    const pathLocalToWorld = FrameBuilder.createRightHandedFrame(undefined, [this.current, this.continuationData.path]);
    if (undefined === pathLocalToWorld)
      return false;

    // Don't create a region unless new curve + existing path is planar...
    const pathPlane = Plane3dByOriginAndUnitNormal.create(pathLocalToWorld.getOrigin(), pathLocalToWorld.matrix.getColumn(2));
    if (undefined === pathPlane)
      return false;

    if (!this.current.isInPlane(pathPlane))
      return false;

    for (const child of this.continuationData.path.children) {
      if (!child.isInPlane(pathPlane))
        return false;
    }

    return true;
  }

  protected clearGraphics(): void {
    if (undefined === this._graphicsProvider)
      return;
    this._graphicsProvider.cleanupGraphic();
    this._graphicsProvider = undefined;
  }

  protected async createGraphics(ev: BeButtonEvent): Promise<void> {
    this.current = this.createNewCurvePrimitive(ev);
    if (0 === this.accepted.length)
      await this.isValidForJoin();

    const placement = this.getPlacementProps(ev);
    if (undefined === placement)
      return;

    const geometry = this.getGeometryProps(placement);
    if (undefined === geometry)
      return;

    if (undefined === this._graphicsProvider)
      this._graphicsProvider = new DynamicGraphicsProvider(this.iModel, this.toolId);

    // set chord tolerance for non-linear curve primitives...
    if (ev.viewport)
      this._graphicsProvider.chordTolerance = computeChordToleranceFromPoint(ev.viewport, ev.point);

    await this._graphicsProvider.createGraphic(this.targetCategory, placement, geometry);
  }

  public onDynamicFrame(_ev: BeButtonEvent, context: DynamicsContext): void {
    if (undefined !== this._graphicsProvider)
      this._graphicsProvider.addGraphic(context);
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

  public decorate(context: DecorateContext): void {
    if (undefined === this.current)
      return;

    if (this.showJoin)
      this.showJoinIndicator(context, this.current.startPoint());
    else if (this.showClosure)
      this.showClosureIndicator(context, this.current.endPoint());
  }

  public async onModifierKeyTransition(_wentDown: boolean, modifier: BeModifierKeys, _event: KeyboardEvent): Promise<EventHandled> {
    if (BeModifierKeys.Control !== modifier)
      return EventHandled.No;

    const ev = new BeButtonEvent();
    this.getCurrentButtonEvent(ev);
    await this.createGraphics(ev); // Update graphics for join/closure change since onMouseMotion won't be called...

    return EventHandled.Yes;
  }

  public async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    return this.createGraphics(ev);
  }

  protected createNewPath(placement: PlacementProps): JsonGeometryStream | FlatBufferGeometryStream | undefined {
    if (undefined === this.current)
      return;

    const builder = new ElementGeometry.Builder();
    builder.setLocalToWorldFromPlacement(placement);

    const geometry = (this.isValidForClosure() ? Loop.create(this.current) : this.current);
    if (!builder.appendGeometryQuery(geometry))
      return;

    return { format: "flatbuffer", data: builder.entries };
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

    const current = this.current.clone() as CurvePrimitive;
    if (undefined === current)
      return;

    if (append) {
      continuePath.tryAddChild(current);
    } else {
      current.reverseInPlace();
      continuePath.children.splice(0, 0, current);
    }

    const geometry = (this.isValidForClosure() ? Loop.create(...continuePath.children) : continuePath);
    if (this.wantSimplify)
      RegionOps.consolidateAdjacentPrimitives(geometry);

    const builder = new ElementGeometry.Builder();
    builder.setLocalToWorldFromPlacement(placement);
    builder.appendGeometryParamsChange(this.continuationData.params);

    if (!builder.appendGeometryQuery(geometry))
      return;

    return { format: "flatbuffer", data: builder.entries };
  }

  protected getPlacementProps(_ev?: BeButtonEvent): PlacementProps | undefined {
    if (undefined !== this.continuationData)
      return this.continuationData.props.placement;

    if (undefined === this.current)
      return;

    const vp = this.targetView;
    if (undefined === vp)
      return;

    const matrix = AccuDrawHintBuilder.getCurrentRotation(vp, true, true);
    const localToWorld = FrameBuilder.createRightHandedFrame(matrix?.getColumn(2), this.current);
    if (undefined === localToWorld)
      return;

    const origin = localToWorld.getOrigin();
    const angles = new YawPitchRollAngles();

    YawPitchRollAngles.createFromMatrix3d(localToWorld.matrix, angles);

    if (vp.view.is3d())
      return { origin, angles };

    return { origin, angle: angles.yaw };
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
    const category = this.targetCategory;

    if (isPlacement3dProps(placement))
      return { classFullName: "Generic:PhysicalObject", model, category, code: Code.createEmpty(), placement };

    return { classFullName: "BisCore:DrawingGraphic", model, category, code: Code.createEmpty(), placement };
  }

  protected async createElement(): Promise<void> {
    const placement = this.getPlacementProps();
    if (undefined === placement)
      return;

    const geometry = this.getGeometryProps(placement);
    if (undefined === geometry)
      return;

    const elemProps = this.getElementProps(placement);
    if (undefined === elemProps)
      return;

    let data;
    if ("flatbuffer" === geometry.format) {
      data = { entryArray: geometry.data };
      delete elemProps.geom; // Leave unchanged until replaced by flatbuffer geometry...
    } else {
      elemProps.geom = geometry.data;
    }

    try {
      this._startedCmd = await this.startCommand();
      if (undefined === elemProps.id)
        await CreateOrContinuePathTool.callCommand("insertGeometricElement", elemProps, data);
      else
        await CreateOrContinuePathTool.callCommand("updateGeometricElement", elemProps, data);
      await this.saveChanges();
    } catch (err) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, err.toString()));
    }
  }

  protected setupAndPromptForNextAction(): void {
    const nPts = this.accepted.length;

    if (0 !== nPts) {
      const hints = new AccuDrawHintBuilder();

      if (this.wantSmartRotation && undefined !== this.continuationData)
        hints.enableSmartRotation = true;

      if (nPts > 1 && !this.accepted[nPts - 1].isAlmostEqual(this.accepted[nPts - 2]))
        hints.setXAxis(Vector3d.createStartEnd(this.accepted[nPts - 2], this.accepted[nPts - 1])); // Rotate AccuDraw to last segment.

      hints.setOrigin(this.accepted[nPts - 1]);
      hints.sendHints();
    }

    super.setupAndPromptForNextAction();
  }

  protected async acceptPoint(ev: BeButtonEvent): Promise<boolean> {
    this.accepted.push(ev.point.clone());
    this.current = this.createNewCurvePrimitive();
    if (1 === this.accepted.length)
      await this.isValidForJoin();
    return true;
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (!await this.acceptPoint(ev))
      return EventHandled.Yes;
    return super.onDataButtonDown(ev);
  }

  public async onUndoPreviousStep(): Promise<boolean> {
    if (0 === this.accepted.length)
      return false;

    this.accepted.pop();
    if (0 === this.accepted.length)
      this.onReinitialize();
    else
      this.setupAndPromptForNextAction();

    return true;
  }

  public onCleanup(): void {
    this.clearGraphics();
    super.onCleanup();
  }
}

/** @alpha Creates a line string or shape. Uses model and category from ToolAdmin.ActiveSettings. */
export class CreateLineStringTool extends CreateOrContinuePathTool {
  public static toolId = "CreateLineString";
  protected _snapGeomId?: Id64String;

  protected provideToolAssistance(_mainInstrText?: string, _additionalInstr?: ToolAssistanceInstruction[]): void {
    const nPts = this.accepted.length;
    const mainMsg = 0 === nPts ? "ElementSet.Prompts.StartPoint" : (1 === nPts ? "ElementSet.Prompts.EndPoint" : "ElementSet.Inputs.AdditionalPoint");
    const leftMsg = "ElementSet.Inputs.AcceptPoint";
    const rghtMsg = nPts > 1 ? "ElementSet.Inputs.Complete" : "ElementSet.Inputs.Cancel";

    const mouseInstructions: ToolAssistanceInstruction[] = [];
    const touchInstructions: ToolAssistanceInstruction[] = [];

    if (!ToolAssistance.createTouchCursorInstructions(touchInstructions))
      touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.OneTouchTap, CoreTools.translate(leftMsg), false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.LeftClick, CoreTools.translate(leftMsg), false, ToolAssistanceInputMethod.Mouse));

    touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.TwoTouchTap, CoreTools.translate(rghtMsg), false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.RightClick, CoreTools.translate(rghtMsg), false, ToolAssistanceInputMethod.Mouse));

    const sections: ToolAssistanceSection[] = [];
    sections.push(ToolAssistance.createSection(mouseInstructions, ToolAssistance.inputsLabel));
    sections.push(ToolAssistance.createSection(touchInstructions, ToolAssistance.inputsLabel));

    const mainInstruction = ToolAssistance.createInstruction(this.iconSpec, CoreTools.translate(mainMsg));
    const instructions = ToolAssistance.createInstructions(mainInstruction, sections);
    IModelApp.notifications.setToolAssistance(instructions);
  }

  protected get wantClosure(): boolean {
    // A linestring can support physical closure when creating a new path...
    return this.allowClosure;
  }

  protected isComplete(_ev: BeButtonEvent): boolean {
    // Allow completion on physical closure to create a shape...
    return this.isValidForClosure();
  }

  protected createNewCurvePrimitive(ev?: BeButtonEvent): CurvePrimitive | undefined {
    const numRequired = (undefined === ev ? 2 : 1);

    if (this.accepted.length < numRequired) {
      // create zero length line to support join...
      const pt = (0 !== this.accepted.length ? this.accepted[0] : ev?.point);
      return (pt ? LineString3d.create([pt, pt]) : undefined);
    }

    const pts = (undefined === ev ? this.accepted : [...this.accepted, ev.point]);
    return LineString3d.create(pts);
  }

  public testDecorationHit(id: Id64String): boolean {
    return id === this._snapGeomId;
  }

  public async getToolTip(hit: HitDetail): Promise<HTMLElement | string> {
    if (this.testDecorationHit(hit.sourceId))
      return this.description;
    return super.getToolTip(hit);
  }

  public getDecorationGeometry(_hit: HitDetail): GeometryStreamProps | undefined {
    if (this.accepted.length < 2)
      return;
    const geom = IModelJson.Writer.toIModelJson(LineString3d.create(this.accepted));
    return geom ? [geom] : undefined;
  }

  public decorate(context: DecorateContext): void {
    super.decorate(context);

    if (this.accepted.length < 2)
      return;

    if (undefined === this._snapGeomId)
      this._snapGeomId = this.iModel.transientIds.next;

    const builder = context.createGraphic({ type: GraphicType.WorldDecoration, pickable: { id: this._snapGeomId, locateOnly: true }});
    builder.setSymbology(ColorDef.white, ColorDef.white, 1);
    builder.addLineString(this.accepted); // Allow snapping to accepted segments...
    context.addDecorationFromBuilder(builder);
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    // Accept on reset if we have a valid curve (at least 2 points), starting another tool will reject accepted segments...
    this.current = (this.accepted.length > 1 ? this.createNewCurvePrimitive() : undefined);
    if (undefined !== this.current)
      await this.createElement();

    this.onReinitialize();
    return EventHandled.No;
  }

  public onRestartTool(): void {
    const tool = new CreateLineStringTool();
    if (!tool.run())
      this.exitTool();
  }
}

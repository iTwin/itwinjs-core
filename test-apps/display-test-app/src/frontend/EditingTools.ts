/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, Id64String } from "@bentley/bentleyjs-core";
import {
  Angle, Geometry, IModelJson, LineSegment3d, LineString3d, Matrix3d, Point3d, Range3d, Transform, Vector3d, YawPitchRollAngles,
} from "@bentley/geometry-core";
import {
  Code, ColorDef, Frustum, GeometryStreamProps, IModelWriteRpcInterface, LinePixels, PhysicalElementProps, Placement2d, Placement2dProps, Placement3d,
} from "@bentley/imodeljs-common";
import {
  AccuDraw, AccuDrawFlags, AccuDrawHintBuilder, BeButtonEvent, CoreTools, DecorateContext, DynamicsContext, ElementEditor3d, ElementSetTool,
  EventHandled, GraphicType, HitDetail, IModelApp, InteractiveEditingSession, PrimitiveTool, Tool,
  ToolAssistanceInstruction,
} from "@bentley/imodeljs-frontend";
import { setTitle } from "./Title";

// Simple tools for testing interactive editing. They require the iModel to have been opened in read-write mode.

/** If an editing session is currently in progress, end it; otherwise, begin a new one. */
export class EditingSessionTool extends Tool {
  public static toolId = "EditingSession";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 0; }

  public run(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this._run();
    return true;
  }

  private async _run(): Promise<void> {
    const imodel = IModelApp.viewManager.selectedView?.iModel;
    if (!imodel || !imodel.isBriefcaseConnection())
      return;

    const session = InteractiveEditingSession.get(imodel);
    if (session)
      await session.end();
    else
      await InteractiveEditingSession.begin(imodel);

    setTitle(imodel);
  }
}

export abstract class UndoRedoTool extends Tool {
  protected abstract get isUndo(): boolean;

  public run(): boolean {
    const imodel = IModelApp.viewManager.selectedView?.iModel;
    if (imodel) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises,deprecation/deprecation
      IModelWriteRpcInterface.getClient().undoRedo(imodel.getRpcProps(), this.isUndo);
    }

    return true;
  }
}

export class UndoTool extends UndoRedoTool {
  public static toolId = "DtaUndo";
  protected get isUndo() { return true; }
}

export class RedoTool extends UndoRedoTool {
  public static toolId = "DtaRedo";
  protected get isUndo() { return false; }
}

/** Delete elements immediately from active selection set or prompt user to identify elements to delete. */
export class DeleteElementsTool extends ElementSetTool {
  public static toolId = "DeleteElements";

  protected get allowSelectionSet(): boolean { return true; }
  protected get allowGroups(): boolean { return true; }
  protected get allowDragSelect(): boolean { return true; }
  protected get controlKeyContinuesSelection(): boolean { return true; }
  protected get requireAcceptForSelectionSetOperation(): boolean { return false; }

  public async processAgendaImmediate(): Promise<void> {
    // TODO: EditCommand...what clears the deleted elements from the selection set?
    try {
      // eslint-disable-next-line deprecation/deprecation
      await IModelWriteRpcInterface.getClient().deleteElements(this.iModel.getRpcProps(), Array.from(this.agenda.elements));
      await this.iModel.saveChanges();
    } catch (err) {
      alert(err.toString());
    }
  }

  public onRestartTool(): void {
    const tool = new DeleteElementsTool();
    if (!tool.run())
      this.exitTool();
  }
}

/** Base class for applying a transform to element placements. */
export abstract class TransformElementTool extends ElementSetTool {
  protected get allowSelectionSet(): boolean { return true; }
  protected get allowGroups(): boolean { return true; }
  protected get allowDragSelect(): boolean { return true; }
  protected get controlKeyContinuesSelection(): boolean { return true; }
  protected get wantAccuSnap(): boolean { return true; }
  protected get wantDynamics(): boolean { return true; }
  protected get wantMakeCopy(): boolean { return false; } // For testing repeat vs. restart...
  private _elementAlignedBoxes?: Frustum[]; // TODO: Display agenda "graphics" with supplied transform...

  protected abstract calculateTransform(ev: BeButtonEvent): Transform | undefined;

  protected async createAgendaGraphics(changed: boolean): Promise<void> {
    if (changed) {
      if (undefined === this._elementAlignedBoxes)
        return; // Not yet needed...
    } else {
      if (undefined !== this._elementAlignedBoxes)
        return; // Use existing graphics...
    }

    this._elementAlignedBoxes = new Array<Frustum>();
    if (0 === this.currentElementCount)
      return;

    try {
      const elementProps = await this.iModel.elements.getProps(this.agenda.elements);
      const range = new Range3d();

      for (const props of elementProps) {
        const placementProps = (props as any).placement;
        if (undefined === placementProps)
          continue;

        const hasAngle = (arg: any): arg is Placement2dProps => arg.angle !== undefined;
        const placement = hasAngle(placementProps) ? Placement2d.fromJSON(placementProps) : Placement3d.fromJSON(placementProps);
        range.setFrom(placement instanceof Placement2d ? Range3d.createRange2d(placement.bbox, 0) : placement.bbox);

        const frustum = Frustum.fromRange(range);
        frustum.multiply(placement.transform);
        this._elementAlignedBoxes.push(frustum);
      }
    } catch { }
  }

  protected async onAgendaModified(): Promise<void> {
    await this.createAgendaGraphics(true);
  }

  protected async initAgendaDynamics(): Promise<boolean> {
    await this.createAgendaGraphics(false);
    return super.initAgendaDynamics();
  }

  protected transformAgendaDynamics(transform: Transform, context: DynamicsContext): void {
    if (undefined === this._elementAlignedBoxes)
      return;

    const builder = context.target.createGraphicBuilder(GraphicType.WorldOverlay, context.viewport, transform);
    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 1, LinePixels.HiddenLine);

    for (const frust of this._elementAlignedBoxes)
      builder.addFrustum(frust.clone());

    context.addGraphic(builder.finish());
  }

  public onDynamicFrame(ev: BeButtonEvent, context: DynamicsContext): void {
    const transform = this.calculateTransform(ev);
    if (undefined === transform)
      return;
    this.transformAgendaDynamics(transform, context);
  }

  protected updateAnchorLocation(transform: Transform): void {
    // Update anchor point to support creating additional copies (repeat vs. restart)...
    if (undefined === this.anchorPoint)
      return;
    transform.multiplyPoint3d(this.anchorPoint, this.anchorPoint);
    IModelApp.accuDraw.setContext(AccuDrawFlags.SetOrigin, this.anchorPoint);
  }

  protected async transformAgenda(transform: Transform): Promise<void> {
    // TODO: EditCommand...?
    const editor = await ElementEditor3d.start(this.iModel);
    await editor.startModifyingElements(this.agenda.elements);
    await editor.applyTransform(transform.toJSON());
    await editor.write();
    await this.saveChanges();
    await editor.end();
  }

  public async processAgenda(ev: BeButtonEvent): Promise<void> {
    const transform = this.calculateTransform(ev);
    if (undefined === transform)
      return;
    await this.transformAgenda(transform);
    this.updateAnchorLocation(transform);
  }

  public async onProcessComplete(): Promise<void> {
    if (this.wantMakeCopy)
      return; // TODO: Update agenda to hold copies, replace current selection set with copies, etc...
    return super.onProcessComplete();
  }
}

/** Move elements by applying translation to placement. */
export class MoveElementTool extends TransformElementTool {
  public static toolId = "MoveElements";

  protected calculateTransform(ev: BeButtonEvent): Transform | undefined {
    if (undefined === this.anchorPoint)
      return undefined;
    return Transform.createTranslation(ev.point.minus(this.anchorPoint));
  }

  protected provideToolAssistance(_mainInstrText?: string, _additionalInstr?: ToolAssistanceInstruction[]): void {
    let mainMsg;
    if (!this.isSelectByPoints && !this.wantAdditionalElements)
      mainMsg = CoreTools.translate(this.wantAdditionalInput ? "ElementSet.Prompts.StartPoint" : "ElementSet.Prompts.EndPoint");
    super.provideToolAssistance(mainMsg);
  }

  public onRestartTool(): void {
    const tool = new MoveElementTool();
    if (!tool.run())
      this.exitTool();
  }
}

/** Rotate elements by applying "active angle" to placement. */
export class RotateElementByAngleTool extends TransformElementTool {
  public static toolId = "RotateElementsByAngle";
  protected angle = Angle.createDegrees(45);

  protected get requireAcceptForSelectionSetDynamics(): boolean { return false; }

  protected calculateTransform(ev: BeButtonEvent): Transform | undefined {
    if (undefined === ev.viewport)
      return undefined;

    const rotMatrix = AccuDraw.getCurrentOrientation(ev.viewport, true, true);
    if (undefined === rotMatrix)
      return undefined;

    const invMatrix = rotMatrix.inverse();
    if (undefined === invMatrix)
      return undefined;

    const angMatrix = YawPitchRollAngles.createDegrees(this.angle.degrees, 0, 0).toMatrix3d();
    if (undefined === angMatrix)
      return undefined;

    angMatrix.multiplyMatrixMatrix(rotMatrix, rotMatrix);
    invMatrix.multiplyMatrixMatrix(rotMatrix, rotMatrix);

    return Transform.createFixedPointAndMatrix(ev.point, rotMatrix);
  }

  protected provideToolAssistance(_mainInstrText?: string, _additionalInstr?: ToolAssistanceInstruction[]): void {
    let mainMsg;
    if (!this.isSelectByPoints && !this.wantAdditionalElements && this.wantAdditionalInput)
      mainMsg = "Identify Point to Rotate About";
    super.provideToolAssistance(mainMsg);
  }

  public onRestartTool(): void {
    const tool = new RotateElementByAngleTool();
    if (!tool.run())
      this.exitTool();
  }
}

/** Rotate elements by applying angle defined by 3 points to placement. */
export class RotateElementByPointsTool extends TransformElementTool {
  public static toolId = "RotateElementsByPoints";
  protected xAxisPoint?: Point3d;
  protected havePivotPoint = false;
  protected haveFinalPoint = false;

  protected calculateTransform(ev: BeButtonEvent): Transform | undefined {
    if (undefined === ev.viewport)
      return undefined;

    if (undefined === this.anchorPoint || undefined === this.xAxisPoint)
      return undefined;

    const vec1 = Vector3d.createStartEnd(this.anchorPoint, this.xAxisPoint);
    const vec2 = Vector3d.createStartEnd(this.anchorPoint, ev.point);

    if (!vec1.normalizeInPlace() || !vec2.normalizeInPlace())
      return undefined;

    const dot = vec1.dotProduct(vec2);
    if (dot > (1.0 - Geometry.smallAngleRadians))
      return undefined;

    if (dot < (-1.0 + Geometry.smallAngleRadians)) {
      const rotMatrix = AccuDraw.getCurrentOrientation(ev.viewport, true, true);
      if (undefined === rotMatrix)
        return undefined;

      const invMatrix = rotMatrix.inverse();
      if (undefined === invMatrix)
        return undefined;

      const angMatrix = YawPitchRollAngles.createRadians(Math.PI, 0, 0).toMatrix3d(); // 180 degree rotation...
      if (undefined === angMatrix)
        return undefined;

      angMatrix.multiplyMatrixMatrix(rotMatrix, rotMatrix);
      invMatrix.multiplyMatrixMatrix(rotMatrix, rotMatrix);

      return Transform.createFixedPointAndMatrix(this.anchorPoint, rotMatrix);
    }

    const zVec = vec1.unitCrossProduct(vec2);
    if (undefined === zVec)
      return undefined;

    const yVec = zVec.unitCrossProduct(vec1);
    if (undefined === yVec)
      return undefined;

    const matrix1 = Matrix3d.createRows(vec1, yVec, zVec);
    zVec.unitCrossProduct(vec2, yVec);
    const matrix2 = Matrix3d.createColumns(vec2, yVec, zVec);

    const matrix = matrix2.multiplyMatrixMatrix(matrix1);
    if (undefined === matrix)
      return undefined;

    return Transform.createFixedPointAndMatrix(this.anchorPoint, matrix);
  }

  public onDynamicFrame(ev: BeButtonEvent, context: DynamicsContext): void {
    const transform = this.calculateTransform(ev);
    if (undefined !== transform)
      return this.transformAgendaDynamics(transform, context);

    if (undefined === this.anchorPoint)
      return;

    const builder = context.target.createGraphicBuilder(GraphicType.WorldOverlay, context.viewport);
    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 1, LinePixels.Code2);
    builder.addLineString([this.anchorPoint.clone(), ev.point.clone()]);
    context.addGraphic(builder.finish());
  }

  protected get wantAdditionalInput(): boolean { return !this.haveFinalPoint; }

  protected wantProcessAgenda(ev: BeButtonEvent): boolean {
    if (!this.havePivotPoint)
      this.havePivotPoint = true; // Uses anchorPoint...
    else if (undefined === this.xAxisPoint)
      this.xAxisPoint = ev.point.clone();
    else if (!this.haveFinalPoint)
      this.haveFinalPoint = true; // Uses button event...

    return super.wantProcessAgenda(ev);
  }

  protected setupAndPromptForNextAction(): void {
    super.setupAndPromptForNextAction();

    if (undefined === this.anchorPoint || undefined === this.xAxisPoint)
      return;

    const hints = new AccuDrawHintBuilder();
    hints.setXAxis(Vector3d.createStartEnd(this.anchorPoint, this.xAxisPoint));
    hints.setOrigin(this.anchorPoint);
    hints.setModePolar();
    hints.sendHints();
  }

  protected provideToolAssistance(_mainInstrText?: string, _additionalInstr?: ToolAssistanceInstruction[]): void {
    let mainMsg;
    if (!this.isSelectByPoints && !this.wantAdditionalElements) {
      if (!this.havePivotPoint)
        mainMsg = "Identify Point to Rotate About";
      else if (undefined === this.xAxisPoint)
        mainMsg = "Define Start of Rotation";
      else
        mainMsg = "Define Amount of Rotation";
    }
    super.provideToolAssistance(mainMsg);
  }

  public onRestartTool(): void {
    const tool = new RotateElementByPointsTool();
    if (!tool.run())
      this.exitTool();
  }
}

/** Tool that requires 2 elements to complete. TODO: Subtract Solids */
export class ExactlyTwoElementsTool extends ElementSetTool {
  public static toolId = "ExactlyTwoElements";
  protected needAccept = true; // For testing explict accept after both elements are identified...

  protected get requiredElementCount(): number { return 2; }

  public requireWriteableTarget(): boolean { return false; } // TEMPORARY...

  protected provideToolAssistance(_mainInstrText?: string, _additionalInstr?: ToolAssistanceInstruction[]): void {
    let mainMsg;
    if (this.wantAdditionalElements)
      mainMsg = (0 === this.currentElementCount ? "Identify First Element" : "Identify Second Element");
    super.provideToolAssistance(mainMsg);
  }

  protected get wantAdditionalInput(): boolean { const needAccept = this.needAccept; this.needAccept = false; return needAccept; }

  public async processAgendaImmediate(): Promise<void> {
    // console.log(">>> Process Agenda: ExactlyTwoElementsTool"); // eslint-disable-line no-console
  }

  public onRestartTool(): void {
    const tool = new ExactlyTwoElementsTool();
    if (!tool.run())
      this.exitTool();
  }
}

/** Tool that requires at least 2 elements to complete. TODO: Unite Solids */
export class AtLeastTwoElementsTool extends ElementSetTool {
  public static toolId = "AtLeastTwoElements";

  protected get requiredElementCount(): number { return 2; }
  protected get allowSelectionSet(): boolean { return true; }
  protected get allowGroups(): boolean { return true; }
  protected get allowDragSelect(): boolean { return true; }
  protected get controlKeyContinuesSelection(): boolean { return true; }

  public requireWriteableTarget(): boolean { return false; } // TEMPORARY...

  public async processAgendaImmediate(): Promise<void> {
    // console.log(">>> Process Agenda: ExactlyTwoElementsTool"); // eslint-disable-line no-console
  }

  public onRestartTool(): void {
    const tool = new AtLeastTwoElementsTool();
    if (!tool.run())
      this.exitTool();
  }
}

/** A basic interactive editing tool. */
abstract class InteractiveEditingTool extends PrimitiveTool {
  private _editor?: ElementEditor3d;

  protected async getEditor(): Promise<ElementEditor3d> {
    if (!this._editor)
      this._editor = await ElementEditor3d.start(this.iModel);

    return this._editor;
  }

  public onCleanup(): void {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.closeEditor();
  }

  private async closeEditor(): Promise<void> {
    if (this._editor) {
      await this._editor.end();
      this._editor = undefined;
    }
  }
}

/** Places a line string. The first model in the view's model selector and the first category in its category selector are used. */
export class PlaceLineStringTool extends InteractiveEditingTool {
  public static toolId = "PlaceLineString";
  private readonly _points: Point3d[] = [];
  private _snapGeomId?: Id64String;

  public requireWriteableTarget(): boolean { return true; }

  public onPostInstall(): void {
    super.onPostInstall();
    this.setupAndPromptForNextAction();
  }

  public setupAndPromptForNextAction(): void {
    IModelApp.accuSnap.enableSnap(true);

    const nPts = this._points.length;
    const prompts = ["Enter start point", "Enter second point", "Enter next point or Reset to finish"];
    const prompt = prompts[Math.min(nPts, 2)];
    IModelApp.notifications.outputPrompt(prompt);

    if (0 === nPts)
      return;

    const hints = new AccuDrawHintBuilder();
    hints.enableSmartRotation = true;

    if (nPts > 1 && !this._points[nPts - 1].isAlmostEqual(this._points[nPts - 2]))
      hints.setXAxis(Vector3d.createStartEnd(this._points[nPts - 2], this._points[nPts - 1])); // Rotate AccuDraw to last segment.

    hints.setOrigin(this._points[nPts - 1]);
    hints.sendHints();
  }

  public testDecorationHit(id: Id64String): boolean {
    return id === this._snapGeomId;
  }

  public getDecorationGeometry(_hit: HitDetail): GeometryStreamProps | undefined {
    if (this._points.length < 2)
      return undefined;

    const geom = IModelJson.Writer.toIModelJson(LineString3d.create(this._points));
    return geom ? [geom] : undefined;
  }

  public decorate(context: DecorateContext): void {
    if (this._points.length < 2)
      return;

    if (undefined === this._snapGeomId)
      this._snapGeomId = this.iModel.transientIds.next;

    const builder = context.createGraphicBuilder(GraphicType.WorldDecoration, undefined, this._snapGeomId);
    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 1);
    builder.addLineString([...this._points]);
    context.addDecorationFromBuilder(builder);
  }

  public onDynamicFrame(ev: BeButtonEvent, context: DynamicsContext): void {
    if (this._points.length < 1)
      return;

    // Only draw current segment in dynamics - accepted segments are drawn as pickable decorations.
    const builder = context.createSceneGraphicBuilder();
    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 1);
    builder.addLineString([this._points[this._points.length - 1].clone(), ev.point.clone()]);
    context.addGraphic(builder.finish());
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    await this.getEditor();
    this._points.push(ev.point.clone());
    this.setupAndPromptForNextAction();

    if (!this.isDynamicsStarted)
      this.beginDynamics();

    return EventHandled.No;
  }

  private async createElement(): Promise<void> {
    const vp = this.targetView;
    assert(undefined !== vp);
    assert(2 <= this._points.length);

    let category;
    for (const catId of vp.view.categorySelector.categories) {
      category = catId;
      break;
    }

    if (undefined === category)
      return;

    let model;
    if (vp.view.is2d()) {
      model = vp.view.baseModelId;
    } else if (vp.view.isSpatialView()) {
      for (const modId of vp.view.modelSelector.models) {
        model = modId;
        break;
      }
    }

    if (undefined === model)
      return;

    const origin = this._points[0];
    const angles = new YawPitchRollAngles();
    const pts = this._points.map((p) => p.minus(origin));

    const primitive = this._points.length === 2 ? LineSegment3d.create(pts[0], pts[1]) : LineString3d.create(pts);
    const geom = IModelJson.Writer.toIModelJson(primitive);
    const props: PhysicalElementProps = { classFullName: "Generic:PhysicalObject", model, category, code: Code.createEmpty() };

    const editor = await this.getEditor();
    return editor.createElement(props, origin, angles, geom);
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    if (this._points.length >= 2) {
      IModelApp.notifications.outputPrompt("");

      await this.createElement();
      const editor = await this.getEditor();
      await editor.write();
      await this.saveChanges();
    }

    this.onReinitialize();
    return EventHandled.No;
  }

  public async onUndoPreviousStep(): Promise<boolean> {
    if (0 === this._points.length)
      return false;

    this._points.pop();
    if (0 === this._points.length)
      this.onReinitialize();
    else
      this.setupAndPromptForNextAction();

    return true;
  }

  public onRestartTool(): void {
    const tool = new PlaceLineStringTool();
    if (!tool.run())
      this.exitTool();
  }
}

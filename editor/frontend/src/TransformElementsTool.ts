/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64, Id64Arg, Id64String } from "@bentley/bentleyjs-core";
import { Angle, Geometry, Matrix3d, Point3d, Transform, Vector3d, YawPitchRollAngles } from "@bentley/geometry-core";
import {
  ColorDef, GeometricElementProps, IModelStatus, isPlacement2dProps, LinePixels, PersistentGraphicsRequestProps, Placement, Placement2d, Placement3d,
} from "@bentley/imodeljs-common";
import { BasicManipulationCommandIpc, editorBuiltInCmdIds } from "@bentley/imodeljs-editor-common";
import {
  AccuDrawHintBuilder, AngleDescription, BeButtonEvent, CoreTools, DynamicsContext, ElementSetTool, GraphicBranch, GraphicType, IModelApp,
  IModelConnection, IpcApp, NotifyMessageDetails, OutputMessagePriority, readElementGraphics, RenderGraphic, RenderGraphicOwner,
  ToolAssistanceInstruction,
} from "@bentley/imodeljs-frontend";
import { DialogItem, DialogItemValue, DialogPropertySyncItem, PropertyDescription } from "@bentley/ui-abstract";
import { EditTools } from "./EditTool";

/** @alpha */
export interface TransformGraphicsData {
  id: Id64String;
  placement: Placement;
  graphic: RenderGraphicOwner;
}

/** @alpha */
export class TransformGraphicsProvider {
  public readonly iModel: IModelConnection;
  public readonly data: TransformGraphicsData[];
  public readonly pending: Map<Id64String, string>;
  public readonly prefix: string;
  /** Chord tolerance to use to stroke the element's geometry in meters. */
  public chordTolerance = 0.01;

  constructor(iModel: IModelConnection, prefix: string) {
    this.iModel = iModel;
    this.prefix = prefix;
    this.data = new Array<TransformGraphicsData>();
    this.pending = new Map<Id64String, string>();
  }

  private getRequestId(id: Id64String): string { return `${this.prefix}-${id}`; }
  private getToleranceLog10(): number { return Math.floor(Math.log10(this.chordTolerance)); }

  private async createRequest(id: Id64String): Promise<TransformGraphicsData | undefined> {
    const elementProps = (await this.iModel.elements.getProps(id)) as GeometricElementProps[];
    if (0 === elementProps.length)
      return;

    const placementProps = elementProps[0].placement;
    if (undefined === placementProps)
      return;

    const placement = isPlacement2dProps(placementProps) ? Placement2d.fromJSON(placementProps) : Placement3d.fromJSON(placementProps);
    if (!placement.isValid)
      return; // Ignore assembly parents w/o geometry, etc...

    const requestProps: PersistentGraphicsRequestProps = {
      id: this.getRequestId(id),
      elementId: id,
      toleranceLog10: this.getToleranceLog10(),
    };

    this.pending.set(id, requestProps.id); // keep track of requests so they can be cancelled...

    const graphicData = await IModelApp.tileAdmin.requestElementGraphics(this.iModel, requestProps);
    if (undefined === graphicData)
      return;

    const graphic = await readElementGraphics(graphicData, this.iModel, elementProps[0].model, placement.is3d);
    if (undefined === graphic)
      return;

    return { id, placement, graphic: IModelApp.renderSystem.createGraphicOwner(graphic) };
  }

  private disposeOfGraphics(): void {
    this.data.forEach((data) => {
      data.graphic.disposeGraphic();
    });

    this.data.length = 0;
  }

  private async cancelPendingRequests(): Promise<void> {
    const requests = new Array<string>();
    for (const [_key, id] of this.pending)
      requests.push(id);

    this.pending.clear();
    if (0 === requests.length)
      return;

    return IpcApp.callIpcHost("cancelElementGraphicsRequests", this.iModel.key, requests);
  }

  /** Call to request a RenderGraphic for the supplied element id.
 * @see [[cleanupGraphics]] Must be called when the tool exits.
 */
  public async createSingleGraphic(id: Id64String): Promise<boolean> {
    try {
      const info = await this.createRequest(id);

      if (undefined !== info?.id)
        this.pending.delete(info.id);

      if (undefined === info?.graphic)
        return false;

      this.data.push(info);
      return true;
    } catch {
      return false;
    }
  }

  /** Call to request RenderGraphics for the supplied element ids. Does not wait for results as
   * generating graphics for a large number of elements can take time. Instead an array of [[RenderGraphicOwner]]
   * is populated as requests are resolved and the current dynamics frame displays what is available.
   * @see [[cleanupGraphics]] Must be called when the tool exits.
   */
  public createGraphics(elements: Id64Arg): void {
    if (0 === Id64.sizeOf(elements))
      return;

    try {
      for (const id of Id64.iterable(elements)) {
        const promise = this.createRequest(id);

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        promise.then((info) => {
          if (undefined !== info?.id)
            this.pending.delete(info.id);

          if (undefined !== info?.graphic)
            this.data.push(info);
        });
      }
    } catch { }
  }

  /** Call to dispose of [[RenderGraphic]] held by [[RenderGraphicOwner]] and cancel requests that are still pending.
   * @note Must be called when the tool exits to avoid leaks of graphics memory or other webgl resources.
   */
  public async cleanupGraphics(): Promise<void> {
    await this.cancelPendingRequests();
    this.disposeOfGraphics();
  }

  public addSingleGraphic(graphic: RenderGraphic, transform: Transform, context: DynamicsContext): void {
    const branch = new GraphicBranch(false);
    branch.add(graphic);

    const branchGraphic = context.createBranch(branch, transform);
    context.addGraphic(branchGraphic);
  }

  public addGraphics(transform: Transform, context: DynamicsContext): void {
    if (0 === this.data.length)
      return;

    const branch = new GraphicBranch(false);
    for (const data of this.data)
      branch.add(data.graphic);

    const branchGraphic = context.createBranch(branch, transform);
    context.addGraphic(branchGraphic);
  }
}

/** @alpha Base class for applying a transform to element placements. */
export abstract class TransformElementsTool extends ElementSetTool {
  protected get allowSelectionSet(): boolean { return true; }
  protected get allowGroups(): boolean { return true; }
  protected get allowDragSelect(): boolean { return true; }
  protected get controlKeyContinuesSelection(): boolean { return true; }
  protected get wantAccuSnap(): boolean { return true; }
  protected get wantDynamics(): boolean { return true; }
  protected get wantMakeCopy(): boolean { return false; } // For testing repeat vs. restart...
  protected _graphicsProvider?: TransformGraphicsProvider;
  protected _startedCmd?: string;

  protected abstract calculateTransform(ev: BeButtonEvent): Transform | undefined;

  protected async createAgendaGraphics(changed: boolean): Promise<void> {
    if (changed) {
      if (undefined === this._graphicsProvider)
        return; // Not yet needed...
    } else {
      if (undefined !== this._graphicsProvider)
        return; // Use existing graphics...
    }

    if (undefined === this._graphicsProvider)
      this._graphicsProvider = new TransformGraphicsProvider(this.iModel, this.toolId);
    else
      await this._graphicsProvider.cleanupGraphics();

    if (1 === this.agenda.length) {
      await this._graphicsProvider.createSingleGraphic(this.agenda.elements[0]);
      return;
    }

    this._graphicsProvider.createGraphics(this.agenda.elements);
  }

  protected async clearAgendaGraphics(): Promise<void> {
    if (undefined === this._graphicsProvider)
      return;
    await this._graphicsProvider.cleanupGraphics();
    this._graphicsProvider = undefined;
  }

  protected async onAgendaModified(): Promise<void> {
    await this.createAgendaGraphics(true);
  }

  protected async initAgendaDynamics(): Promise<boolean> {
    await this.createAgendaGraphics(false);
    return super.initAgendaDynamics();
  }

  protected transformAgendaDynamics(transform: Transform, context: DynamicsContext): void {
    if (undefined !== this._graphicsProvider)
      this._graphicsProvider.addGraphics(transform, context);
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

    const hints = new AccuDrawHintBuilder();
    hints.setOrigin(this.anchorPoint);
    hints.sendHints();
  }

  protected async startCommand(): Promise<string> {
    if (undefined !== this._startedCmd)
      return this._startedCmd;
    return EditTools.startCommand<string>(editorBuiltInCmdIds.cmdBasicManipulation, this.iModel.key);
  }

  public static callCommand<T extends keyof BasicManipulationCommandIpc>(method: T, ...args: Parameters<BasicManipulationCommandIpc[T]>): ReturnType<BasicManipulationCommandIpc[T]> {
    return EditTools.callCommand(method, ...args) as ReturnType<BasicManipulationCommandIpc[T]>;
  }

  protected async transformAgenda(transform: Transform): Promise<void> {
    try {
      this._startedCmd = await this.startCommand();
      if (IModelStatus.Success === await TransformElementsTool.callCommand("transformPlacement", this.agenda.compressIds(), transform.toJSON()))
        await this.saveChanges();
    } catch (err) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, err.toString()));
    }
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

  public onCleanup(): void {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.clearAgendaGraphics();
    super.onCleanup();
  }
}

/** @alpha Move elements by applying translation to placement. */
export class MoveElementsTool extends TransformElementsTool {
  public static toolId = "MoveElements";
  public static iconSpec = "icon-move";

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
    const tool = new MoveElementsTool();
    if (!tool.run())
      this.exitTool();
  }
}

/** @alpha */
export enum RotateMethod {
  By3Points,
  ByAngle,
}

/** @alpha */
export enum RotateAbout {
  Point,
  Origin,
  Center,
}

/** @alpha Rotate elements by applying transform to placement. */
export class RotateElementsTool extends TransformElementsTool {
  public static toolId = "RotateElements";
  public static iconSpec = "icon-rotate";

  protected xAxisPoint?: Point3d;
  protected havePivotPoint = false;
  protected haveFinalPoint = false;

  public static get minArgs() { return 0; }
  public static get maxArgs() { return 3; }

  private _rotateMethodValue: DialogItemValue = { value: RotateMethod.By3Points };
  public get rotateMethod(): RotateMethod { return this._rotateMethodValue.value as RotateMethod; }
  public set rotateMethod(method: RotateMethod) { this._rotateMethodValue.value = method; }

  private static _methodName = "rotateMethod";
  private static methodMessage(str: string) { return EditTools.translate(`RotateElements.Method.${str}`); }
  protected _getMethodDescription = (): PropertyDescription => {
    return {
      name: RotateElementsTool._methodName,
      displayLabel: EditTools.translate("RotateElements.Label.Method"),
      typename: "enum",
      enum: {
        choices: [
          { label: RotateElementsTool.methodMessage("3Points"), value: RotateMethod.By3Points },
          { label: RotateElementsTool.methodMessage("Angle"), value: RotateMethod.ByAngle },
        ],
      },
    };
  };

  private _rotateAboutValue: DialogItemValue = { value: RotateAbout.Point };
  public get rotateAbout(): RotateAbout { return this._rotateAboutValue.value as RotateAbout; }
  public set rotateAbout(about: RotateAbout) { this._rotateAboutValue.value = about; }

  private static _aboutName = "rotateAbout";
  private static aboutMessage(str: string) { return EditTools.translate(`RotateElements.About.${str}`); }
  protected _getAboutDescription = (): PropertyDescription => {
    return {
      name: RotateElementsTool._aboutName,
      displayLabel: EditTools.translate("RotateElements.Label.About"),
      typename: "enum",
      enum: {
        choices: [
          { label: RotateElementsTool.aboutMessage("Point"), value: RotateAbout.Point },
          { label: RotateElementsTool.aboutMessage("Origin"), value: RotateAbout.Origin },
          { label: RotateElementsTool.aboutMessage("Center"), value: RotateAbout.Center },
        ],
      },
    };
  };

  private _rotateAngleValue: DialogItemValue = { value: 0.0 };
  public get rotateAngle(): number { return this._rotateAngleValue.value as number; }
  public set rotateAngle(value: number) { this._rotateAngleValue.value = value; }

  private static _angleName = "rotateAngle";
  private static _angleDescription?: AngleDescription;
  private _getAngleDescription = (): PropertyDescription => {
    if (!RotateElementsTool._angleDescription)
      RotateElementsTool._angleDescription = new AngleDescription(RotateElementsTool._angleName, EditTools.translate("RotateElements.Label.Angle"));
    return RotateElementsTool._angleDescription;
  };

  protected get requireAcceptForSelectionSetDynamics(): boolean { return RotateMethod.ByAngle !== this.rotateMethod; }

  protected calculateTransform(ev: BeButtonEvent): Transform | undefined {
    if (undefined === ev.viewport)
      return undefined;

    if (RotateMethod.ByAngle === this.rotateMethod) {
      const rotMatrix = AccuDrawHintBuilder.getCurrentRotation(ev.viewport, true, true);
      if (undefined === rotMatrix)
        return undefined;

      const invMatrix = rotMatrix.inverse();
      if (undefined === invMatrix)
        return undefined;

      const angMatrix = YawPitchRollAngles.createRadians(this.rotateAngle, 0, 0).toMatrix3d();
      if (undefined === angMatrix)
        return undefined;

      angMatrix.multiplyMatrixMatrix(invMatrix, invMatrix);
      rotMatrix.multiplyMatrixMatrix(invMatrix, rotMatrix);

      return Transform.createFixedPointAndMatrix(ev.point, rotMatrix);
    }

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
      const rotMatrix = AccuDrawHintBuilder.getCurrentRotation(ev.viewport, true, true);
      if (undefined === rotMatrix)
        return undefined;

      const invMatrix = rotMatrix.inverse();
      if (undefined === invMatrix)
        return undefined;

      const angMatrix = YawPitchRollAngles.createRadians(Math.PI, 0, 0).toMatrix3d(); // 180 degree rotation...
      if (undefined === angMatrix)
        return undefined;

      angMatrix.multiplyMatrixMatrix(invMatrix, invMatrix);
      rotMatrix.multiplyMatrixMatrix(invMatrix, rotMatrix);

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

  protected transformAgendaDynamics(transform: Transform, context: DynamicsContext): void {
    if (RotateAbout.Point === this.rotateAbout)
      return super.transformAgendaDynamics(transform, context);

    if (undefined === this._graphicsProvider)
      return;

    const rotatePoint = Point3d.create();

    for (const data of this._graphicsProvider.data) {
      if (RotateAbout.Origin === this.rotateAbout)
        rotatePoint.setFrom(data.placement.origin);
      else
        rotatePoint.setFrom(data.placement.calculateRange().center);

      const rotateTrans = Transform.createFixedPointAndMatrix(rotatePoint, transform.matrix);
      this._graphicsProvider.addSingleGraphic(data.graphic, rotateTrans, context);
    }
  }

  protected async transformAgenda(transform: Transform): Promise<void> {
    if (RotateAbout.Point === this.rotateAbout)
      return super.transformAgenda(transform);

    try {
      this._startedCmd = await this.startCommand();
      if (IModelStatus.Success === await TransformElementsTool.callCommand("rotatePlacement", this.agenda.compressIds(), transform.matrix.toJSON(), RotateAbout.Center === this.rotateAbout))
        await this.saveChanges();
    } catch (err) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, err.toString()));
    }
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

  protected get wantAdditionalInput(): boolean {
    if (RotateMethod.ByAngle === this.rotateMethod)
      return super.wantAdditionalInput;

    return !this.haveFinalPoint;
  }

  protected wantProcessAgenda(ev: BeButtonEvent): boolean {
    if (RotateMethod.ByAngle === this.rotateMethod)
      return super.wantProcessAgenda(ev);

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

    if (RotateMethod.ByAngle === this.rotateMethod)
      return;

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
    if (RotateMethod.ByAngle === this.rotateMethod) {
      if (!this.isSelectByPoints && !this.wantAdditionalElements && this.wantAdditionalInput)
        mainMsg = EditTools.translate("RotateElements.Prompts.IdentifyPoint");
    } else {
      if (!this.isSelectByPoints && !this.wantAdditionalElements) {
        if (!this.havePivotPoint)
          mainMsg = EditTools.translate("RotateElements.Prompts.IdentifyPoint");
        else if (undefined === this.xAxisPoint)
          mainMsg = EditTools.translate("RotateElements.Prompts.DefineStart");
        else
          mainMsg = EditTools.translate("RotateElements.Prompts.DefineAmount");
      }
    }
    super.provideToolAssistance(mainMsg);
  }

  public applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): boolean {
    if (RotateElementsTool._methodName === updatedValue.propertyName) {
      this._rotateMethodValue = updatedValue.value;
      if (!this._rotateMethodValue)
        return false;
      IModelApp.toolAdmin.toolSettingsState.saveToolSettingProperty(this.toolId, { propertyName: RotateElementsTool._methodName, value: this._rotateMethodValue });
      this.onRestartTool(); // calling restart, not reinitialize to not exit tool for selection set...
      return true;
    } else if (RotateElementsTool._aboutName === updatedValue.propertyName) {
      this._rotateAboutValue = updatedValue.value;
      if (!this._rotateAboutValue)
        return false;
      IModelApp.toolAdmin.toolSettingsState.saveToolSettingProperty(this.toolId, { propertyName: RotateElementsTool._aboutName, value: this._rotateAboutValue });
      return true;
    } else if (RotateElementsTool._angleName === updatedValue.propertyName) {
      this._rotateAngleValue = updatedValue.value;
      if (!this._rotateAngleValue)
        return false;
      IModelApp.toolAdmin.toolSettingsState.saveToolSettingProperty(this.toolId, { propertyName: RotateElementsTool._angleName, value: this._rotateAngleValue });
      return true;
    }
    return false;
  }

  public supplyToolSettingsProperties(): DialogItem[] | undefined {
    const toolSettings = new Array<DialogItem>();
    toolSettings.push({ value: this._rotateMethodValue, property: this._getMethodDescription(), isDisabled: false, editorPosition: { rowPriority: 1, columnIndex: 2 } });
    toolSettings.push({ value: this._rotateAboutValue, property: this._getAboutDescription(), isDisabled: false, editorPosition: { rowPriority: 2, columnIndex: 2 } });
    if (RotateMethod.ByAngle === this.rotateMethod)
      toolSettings.push({ value: this._rotateAngleValue, property: this._getAngleDescription(), isDisabled: false, editorPosition: { rowPriority: 3, columnIndex: 2 } });
    return toolSettings;
  }

  public onRestartTool(): void {
    const tool = new RotateElementsTool();
    if (!tool.run())
      this.exitTool();
  }

  public onInstall(): boolean {
    if (!super.onInstall())
      return false;

    // Setup initial values here instead of supplyToolSettingsProperties to support keyin args w/o ui-framework...
    const rotateMethod = IModelApp.toolAdmin.toolSettingsState.getInitialToolSettingValue(this.toolId, RotateElementsTool._methodName);
    if (undefined !== rotateMethod)
      this._rotateMethodValue = rotateMethod;

    const rotateAbout = IModelApp.toolAdmin.toolSettingsState.getInitialToolSettingValue(this.toolId, RotateElementsTool._aboutName);
    if (undefined !== rotateAbout)
      this._rotateAboutValue = rotateAbout;

    const rotateAngle = IModelApp.toolAdmin.toolSettingsState.getInitialToolSettingValue(this.toolId, RotateElementsTool._angleName);
    if (undefined !== rotateAngle)
      this._rotateAngleValue = rotateAngle;

    return true;
  }

  /** The keyin takes the following arguments, all of which are optional:
   *  - `method=0|1` How rotate angle will be specified. 0 for by 3 points, 1 for by specified angle.
   *  - `about=0|1|2` Location to rotate about. 0 for point, 1 for placement origin, and 2 for center of range.
   *  - `angle=number` Rotation angle in degrees when not defining angle by points.
   */
  public parseAndRun(...inputArgs: string[]): boolean {
    let rotateMethod;
    let rotateAbout;
    let rotateAngle;

    for (const arg of inputArgs) {
      const parts = arg.split("=");
      if (2 !== parts.length)
        continue;

      if (parts[0].toLowerCase().startsWith("me")) {
        const method = Number.parseInt(parts[1], 10);
        if (!Number.isNaN(method)) {
          switch (method) {
            case 0:
              rotateMethod = RotateMethod.By3Points;
              break;
            case 1:
              rotateMethod = RotateMethod.ByAngle;
              break;
          }
        }
      } else if (parts[0].toLowerCase().startsWith("ab")) {
        const about = Number.parseInt(parts[1], 10);
        if (!Number.isNaN(about)) {
          switch (about) {
            case 0:
              rotateAbout = RotateAbout.Point;
              break;
            case 1:
              rotateAbout = RotateAbout.Origin;
              break;
            case 2:
              rotateAbout = RotateAbout.Center;
              break;
          }
        }
      } else if (parts[0].toLowerCase().startsWith("an")) {
        const angle = Number.parseFloat(parts[1]);
        if (!Number.isNaN(angle)) {
          rotateAngle = Angle.createDegrees(angle).radians;
        }
      }
    }

    // Update current session values so keyin args are picked up for tool settings/restart...
    if (undefined !== rotateMethod)
      IModelApp.toolAdmin.toolSettingsState.saveToolSettingProperty(this.toolId, { propertyName: RotateElementsTool._methodName, value: { value: rotateMethod } });

    if (undefined !== rotateAbout)
      IModelApp.toolAdmin.toolSettingsState.saveToolSettingProperty(this.toolId, { propertyName: RotateElementsTool._aboutName, value: { value: rotateAbout } });

    if (undefined !== rotateAngle)
      IModelApp.toolAdmin.toolSettingsState.saveToolSettingProperty(this.toolId, { propertyName: RotateElementsTool._angleName, value: { value: rotateAngle } });

    return this.run();
  }
}


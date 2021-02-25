/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Range3d, Transform } from "@bentley/geometry-core";
import { AccuDrawFlags, BeButtonEvent, CoreTools, DynamicsContext, ElementSetTool, GraphicType, IModelApp, NotifyMessageDetails, OutputMessagePriority, ToolAssistanceInstruction } from "@bentley/imodeljs-frontend";
import { ColorDef, Frustum, IModelStatus, LinePixels, Placement2d, Placement2dProps, Placement3d } from "@bentley/imodeljs-common";
import { BasicManipulationCommandIpc, editorBuiltInCmdIds } from "@bentley/imodeljs-editor-common";
import { EditTools } from "./EditTool";

/** @alpha Base class for applying a transform to element placements. */
export abstract class TransformElementsTool extends ElementSetTool {
  protected get allowSelectionSet(): boolean { return true; }
  protected get allowGroups(): boolean { return true; }
  protected get allowDragSelect(): boolean { return true; }
  protected get controlKeyContinuesSelection(): boolean { return true; }
  protected get wantAccuSnap(): boolean { return true; }
  protected get wantDynamics(): boolean { return true; }
  protected get wantMakeCopy(): boolean { return false; } // For testing repeat vs. restart...
  private _elementAlignedBoxes?: Frustum[]; // TODO: Display agenda "graphics" with supplied transform...
  private _startedCmd?: string;

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

        if (!placement.isValid)
          continue; // Ignore assembly parents w/o geometry, etc...

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

    const builder = context.target.createGraphicBuilder(GraphicType.WorldDecoration, context.viewport, transform);
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
        await this.iModel.saveChanges();
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
}

/** @alpha Move elements by applying translation to placement. */
export class MoveElementsTool extends TransformElementsTool {
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
    const tool = new MoveElementsTool();
    if (!tool.run())
      this.exitTool();
  }
}

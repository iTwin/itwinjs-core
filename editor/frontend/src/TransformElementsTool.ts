/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Editing
 */

import { BentleyError, Id64, Id64Arg, Id64String } from "@itwin/core-bentley";
import { GeometricElementProps, IModelStatus, isPlacement2dProps, PersistentGraphicsRequestProps, Placement, Placement2d, Placement3d } from "@itwin/core-common";
import { AccuDrawHintBuilder, BeButtonEvent, DynamicsContext, ElementSetTool, GraphicBranch, IModelApp, IModelConnection, IpcApp, ModifyElementSource, NotifyMessageDetails, OutputMessagePriority, readElementGraphics, RenderGraphic, RenderGraphicOwner } from "@itwin/core-frontend";
import { Transform } from "@itwin/core-geometry";
import { editorBuiltInCmdIds } from "@itwin/editor-common";
import { EditTools } from "./EditTool";
import { basicManipulationIpc } from "./EditToolIpc";

/** Geometric element id, placement, and RenderGraphic managed by [[TransformGraphicsProvider]].
 * @beta
 */
export interface TransformGraphicsData {
  id: Id64String;
  placement: Placement;
  graphic: RenderGraphicOwner;
}

/** A class for creating and managing RenderGraphics representing geometric elements for the purpose of interactive tool dynamics.
 * @beta
 */
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

    const graphic = await readElementGraphics(graphicData, this.iModel, elementProps[0].model, placement.is3d, { noFlash: true, noHilite: true });
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

    return IpcApp.appFunctionIpc.cancelElementGraphicsRequests(this.iModel.key, requests);
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

/** Edit tool base class for applying a transform to element placements.
 * Example of a tool that would translate elements:
 * ```ts
 * class SampleMoveElementsTool extends TransformElementsTool {
 *   public static override toolId = "SampleMoveElements";
 *   public static override iconSpec = "icon-move";
 *   protected calculateTransform(ev: BeButtonEvent): Transform | undefined {
 *     return (this.anchorPoint ? Transform.createTranslation(ev.point.minus(this.anchorPoint)) : undefined);
 *   }
 *   public async onRestartTool(): Promise<void> {
 *     const tool = new SampleMoveElementsTool();
 *     if (!await tool.run()) return this.exitTool();
 *   }
 * }
 * ```
 * @beta
 */
export abstract class TransformElementsTool extends ElementSetTool {
  protected override get allowSelectionSet(): boolean { return true; }
  protected override get allowGroups(): boolean { return true; }
  protected override get allowDragSelect(): boolean { return true; }
  protected override get controlKeyContinuesSelection(): boolean { return true; }
  protected override get wantAccuSnap(): boolean { return true; }
  protected override get wantDynamics(): boolean { return true; }
  protected get wantMakeCopy(): boolean { return false; }
  protected get wantRepeatOperation(): boolean { return this.wantMakeCopy && !this.agenda.isEmpty; }
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

  protected override async onAgendaModified(): Promise<void> {
    await this.createAgendaGraphics(true);
  }

  protected override async initAgendaDynamics(): Promise<boolean> {
    await this.createAgendaGraphics(false);
    return super.initAgendaDynamics();
  }

  protected transformAgendaDynamics(transform: Transform, context: DynamicsContext): void {
    if (undefined !== this._graphicsProvider)
      this._graphicsProvider.addGraphics(transform, context);
  }

  public override onDynamicFrame(ev: BeButtonEvent, context: DynamicsContext): void {
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
    return EditTools.startCommand<string>({ commandId: editorBuiltInCmdIds.cmdBasicManipulation, iModelKey: this.iModel.key });
  }

  protected async replaceAgenda(newIds: Id64Arg | undefined): Promise<void> {
    this.agenda.clear();

    if (undefined !== newIds)
      this.agenda.add(newIds);

    if (this.isSelectionSetModify) {
      if (this.agenda.isEmpty)
        this.iModel.selectionSet.emptyAll();
      else
        this.iModel.selectionSet.replace(this.agenda.elements);

      this.agenda.setSource(ModifyElementSource.SelectionSet);
      this.setPreferredElementSource(); // Update "use selection set" flag...
    }

    return this.onAgendaModified();
  }

  protected async transformAndCopyAgenda(_transform: Transform): Promise<Id64Arg | undefined> {
    return undefined;
  }

  protected async transformAgenda(transform: Transform): Promise<void> {
    try {
      this._startedCmd = await this.startCommand();
      if (IModelStatus.Success === await basicManipulationIpc.transformPlacement(this.agenda.compressIds(), transform.toJSON()))
        await this.saveChanges();
    } catch (err) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, BentleyError.getErrorMessage(err) || "An unknown error occurred."));
    }
  }

  public override async processAgenda(ev: BeButtonEvent): Promise<void> {
    const transform = this.calculateTransform(ev);
    if (undefined === transform)
      return;

    if (this.wantMakeCopy)
      await this.replaceAgenda(await this.transformAndCopyAgenda(transform));
    else
      await this.transformAgenda(transform);

    this.updateAnchorLocation(transform);
  }

  public override async onProcessComplete(): Promise<void> {
    if (this.wantRepeatOperation)
      return; // Continue with current agenda instead of restarting (ex. create additional copies)
    return super.onProcessComplete();
  }

  public override async onCleanup() {
    await this.clearAgendaGraphics();
    return super.onCleanup();
  }
}


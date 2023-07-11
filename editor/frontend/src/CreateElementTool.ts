/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Editing
 */

import { Id64, Id64String, IModelStatus } from "@itwin/core-bentley";
import { Constant, Point3d, Range3d, Transform, Vector3d } from "@itwin/core-geometry";
import { DynamicGraphicsRequest2dProps, DynamicGraphicsRequest3dProps, ElementGeometryBuilderParams, FlatBufferGeometryStream, GeometricElementProps, IModelError, isPlacement3dProps, JsonGeometryStream, PlacementProps } from "@itwin/core-common";
import { BeButtonEvent, CoordSystem, CoreTools, DynamicsContext, EventHandled, GraphicBranch, IModelApp, IModelConnection, PrimitiveTool, readElementGraphics, RenderGraphicOwner, ToolAssistance, ToolAssistanceImage, ToolAssistanceInputMethod, ToolAssistanceInstruction, ToolAssistanceSection, Viewport } from "@itwin/core-frontend";

function computeChordToleranceFromPointAndRadius(vp: Viewport, center: Point3d, radius: number): number {
  if (vp.view.is3d() && vp.view.isCameraOn) {
    const nearFrontCenter = vp.getFrustum(CoordSystem.World).frontCenter;
    const toFront = Vector3d.createStartEnd(center, nearFrontCenter);
    const viewZ = vp.rotation.rowZ();

    // If the sphere overlaps the near front plane just use near front point. This also handles behind eye conditions.
    if (viewZ.dotProduct(toFront) < radius) {
      center = nearFrontCenter;
    } else {
      // Find point on sphere closest to eye.
      const toEye = center.unitVectorTo(vp.view.camera.eye);

      // Only if not already behind the eye.
      if (toEye) {
        toEye.scaleInPlace(radius);
        center.addInPlace(toEye);
      }
    }
  }

  const viewPt = vp.worldToViewMap.transform0.multiplyPoint3dQuietNormalize(center);
  const viewPt2 = new Point3d(viewPt.x + 1.0, viewPt.y, viewPt.z);
  const pixelSize = vp.worldToViewMap.transform1.multiplyPoint3dQuietNormalize(viewPt).distance(vp.worldToViewMap.transform1.multiplyPoint3dQuietNormalize(viewPt2));

  // Return size of a physical pixel in meters.
  return (0.0 !== pixelSize ? vp.target.adjustPixelSizeForLOD(pixelSize) : 0.001);
}

/** Calculate a view based chord tolerance for facetting curved geometry given a world coordinate and optional radius.
 * @beta
 */
export function computeChordToleranceFromPoint(vp: Viewport, pt: Point3d, radius?: number): number {
  return computeChordToleranceFromPointAndRadius(vp, pt, radius ? radius : Constant.oneCentimeter);
}

/** Calculate a view based chord tolerance for facetting curved geometry given a world coordinate range box.
 * @beta
 */
export function computeChordToleranceFromRange(vp: Viewport, range: Range3d): number {
  return computeChordToleranceFromPointAndRadius(vp, range.center, 0.5 * range.low.distance(range.high));
}

/** A class for creating and managing a RenderGraphic for the purpose of interactive tool dynamics.
 * @beta
 */
export class DynamicGraphicsProvider {
  public readonly iModel: IModelConnection;
  public readonly prefix: string;
  public graphic?: RenderGraphicOwner;
  /** Current request for graphic */
  private _graphicPromise?: Promise<boolean>;
  /** Optional element id generated graphics will be associated to */
  public elementId?: Id64String;
  /** Optional model id generated graphics will be associated to */
  public modelId?: Id64String;
  /** Chord tolerance to use to stroke the element's geometry in meters */
  public chordTolerance = 0.001;

  constructor(iModel: IModelConnection, prefix: string) {
    this.iModel = iModel;
    this.prefix = prefix;
  }

  private getRequestId(id: Id64String): string { return `${this.prefix}-${id}`; }
  private getToleranceLog10(): number { return Math.floor(Math.log10(this.chordTolerance)); }

  private async createRequest(categoryId: Id64String, placement: PlacementProps, geometry: JsonGeometryStream | FlatBufferGeometryStream): Promise<RenderGraphicOwner | undefined> {
    let graphicData;
    let is3d;

    if (is3d = isPlacement3dProps(placement)) {
      const requestProps: DynamicGraphicsRequest3dProps = {
        id: this.getRequestId(this.elementId ? this.elementId : Id64.invalid),
        elementId: this.elementId,
        modelId: this.modelId,
        toleranceLog10: this.getToleranceLog10(),
        type: "3d",
        placement,
        categoryId,
        geometry,
      };
      graphicData = await IModelApp.tileAdmin.requestElementGraphics(this.iModel, requestProps);
      is3d = true;
    } else {
      const requestProps: DynamicGraphicsRequest2dProps = {
        id: this.getRequestId(this.elementId ? this.elementId : Id64.invalid),
        elementId: this.elementId,
        modelId: this.modelId,
        toleranceLog10: this.getToleranceLog10(),
        type: "2d",
        placement,
        categoryId,
        geometry,
      };
      graphicData = await IModelApp.tileAdmin.requestElementGraphics(this.iModel, requestProps);
    }

    if (undefined === graphicData)
      return;

    const graphic = await readElementGraphics(graphicData, this.iModel, this.modelId ? this.modelId : Id64.invalid, is3d, { noFlash: true, noHilite: true });
    if (undefined === graphic)
      return;

    return IModelApp.renderSystem.createGraphicOwner(graphic);
  }

  /** Call to request a RenderGraphic for the supplied geometry and placement.
   * @see [[cleanupGraphic]] Must be called when the tool exits.
   */
  public async createGraphic(categoryId: Id64String, placement: PlacementProps, geometry: JsonGeometryStream | FlatBufferGeometryStream): Promise<boolean> {
    try {
      const graphic = await this.createRequest(categoryId, placement, geometry);
      this.cleanupGraphic();
      return (undefined !== (this.graphic = graphic));
    } catch {
      return false;
    }
  }

  /** Call to request a RenderGraphic for the supplied geometry and trigger a dynamic update upon fulfillment.
   * @note May be useful to update a dynamic preview outside of normal button and motion events, ex. modifier key change.
   * @see [[cleanupGraphic]] Must be called when the tool exits.
   */
  public createGraphicAndUpdateDynamics(ev: BeButtonEvent, categoryId: Id64String, placement: PlacementProps, geometry: JsonGeometryStream | FlatBufferGeometryStream): void {
    const promise = this._graphicPromise = this.createGraphic(categoryId, placement, geometry);

    promise.then(() => {
      if (promise !== this._graphicPromise)
        return; // abandoned this request...

      IModelApp.toolAdmin.updateDynamics(ev);
    }).catch((_) => { });
  }

  /** Call to dispose of [[RenderGraphic]] held by [[RenderGraphicOwner]].
   * @note Must be called when the tool exits to avoid leaks of graphics memory or other webgl resources.
   */
  public cleanupGraphic(): void {
    if (undefined === this.graphic)
      return;
    this.graphic.disposeGraphic();
    this.graphic = undefined;
  }

  public addGraphic(context: DynamicsContext, transform?: Transform): void {
    if (undefined === this.graphic)
      return;

    if (undefined === transform) {
      context.addGraphic(this.graphic);
      return;
    }

    const branch = new GraphicBranch(false);
    branch.add(this.graphic);

    const branchGraphic = context.createBranch(branch, transform);
    context.addGraphic(branchGraphic);
  }
}

/** Placement tool base class for creating new elements.
 * @beta
 */
export abstract class CreateElementTool extends PrimitiveTool {
  public get targetCategory(): Id64String {
    const category = this.briefcase?.editorToolSettings.category;
    if (undefined === category)
      throw new IModelError(IModelStatus.InvalidCategory, "");

    return category;
  }

  public override get targetModelId(): Id64String {
    const model = this.briefcase?.editorToolSettings.model;
    if (undefined === model)
      throw new IModelError(IModelStatus.BadModel, "");

    return model;
  }

  public override isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean {
    if (!vp?.iModel.isBriefcaseConnection())
      return false;

    return undefined !== vp.iModel.editorToolSettings.model && super.isCompatibleViewport(vp, isSelectedViewChange);
  }

  /** Whether [[setupAndPromptForNextAction]] should call [[AccuSnap.enableSnap]] for current tool phase.
   * @return true to enable snapping to elements.
   */
  protected get wantAccuSnap(): boolean { return false; }

  /** Whether to automatically start element dynamics on button event.
   * @return true if tool will implement [[InteractiveTool.onDynamicFrame]] to show element dynamics.
   */
  protected get wantDynamics(): boolean { return false; }

  /** Whether tool is ready to insert the new element.
   * @return true to call [[createElement]].
   */
  protected isComplete(_ev: BeButtonEvent): boolean { return false; }

  /** Insert new element and call [[saveChanges]] */
  protected abstract createElement(): Promise<void>;

  /** Orchestrates advancing the internal state of the tool on a data button event.
   * - Gather input: Initiates element dynamics and accepts additional points as required.
   * - Complete operation: Create new element, restart or exit tool.
   * @returns EventHandled.Yes if onReinitialize was called to restart or exit tool.
   */
  protected async processDataButton(ev: BeButtonEvent): Promise<EventHandled> {
    if (this.isComplete(ev)) {
      await this.createElement();
      await this.onReinitialize();

      return EventHandled.Yes;
    }

    this.setupAndPromptForNextAction();

    if (!this.isDynamicsStarted && this.wantDynamics)
      this.beginDynamics();

    return EventHandled.No;
  }

  public override async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    return this.processDataButton(ev);
  }

  public override async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    await this.onReinitialize();
    return EventHandled.No;
  }

  /** Setup initial tool state, prompts, etc. */
  public override async onPostInstall() {
    await super.onPostInstall();
    this.setupAndPromptForNextAction();
  }

  /** Restore tool assistance after no longer being suspended by either a [[ViewTool]] or [[InputCollector]]. */
  public override async onUnsuspend() {
    this.provideToolAssistance();
  }

  /** Setup auto-locate, AccuSnap, AccuDraw, and supply tool assistance. */
  protected setupAndPromptForNextAction(): void {
    IModelApp.accuSnap.enableSnap(this.wantAccuSnap);
    this.provideToolAssistance();
  }

  /** Sub-classes should override to provide tool specific instructions. */
  protected provideToolAssistance(mainInstrText?: string, additionalInstr?: ToolAssistanceInstruction[]): void {
    const mainMsg = "ElementSet.Prompts.IdentifyPoint";
    const leftMsg = "ElementSet.Inputs.AcceptPoint";
    const rightMsg = "ElementSet.Inputs.Cancel";

    const mouseInstructions: ToolAssistanceInstruction[] = [];
    const touchInstructions: ToolAssistanceInstruction[] = [];

    if (!ToolAssistance.createTouchCursorInstructions(touchInstructions))
      touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.OneTouchTap, CoreTools.translate(leftMsg), false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.LeftClick, CoreTools.translate(leftMsg), false, ToolAssistanceInputMethod.Mouse));

    touchInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.TwoTouchTap, CoreTools.translate(rightMsg), false, ToolAssistanceInputMethod.Touch));
    mouseInstructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.RightClick, CoreTools.translate(rightMsg), false, ToolAssistanceInputMethod.Mouse));

    if (undefined !== additionalInstr) {
      for (const instr of additionalInstr) {
        if (ToolAssistanceInputMethod.Touch === instr.inputMethod)
          touchInstructions.push(instr);
        else
          mouseInstructions.push(instr);
      }
    }

    const sections: ToolAssistanceSection[] = [];
    sections.push(ToolAssistance.createSection(mouseInstructions, ToolAssistance.inputsLabel));
    sections.push(ToolAssistance.createSection(touchInstructions, ToolAssistance.inputsLabel));

    const mainInstruction = ToolAssistance.createInstruction(this.iconSpec, undefined !== mainInstrText ? mainInstrText : CoreTools.translate(mainMsg));
    const instructions = ToolAssistance.createInstructions(mainInstruction, sections);
    IModelApp.notifications.setToolAssistance(instructions);
  }
}

/** Placement tool base class for creating new elements that use dynamics to show intermediate results.
 * @beta
 */
export abstract class CreateElementWithDynamicsTool extends CreateElementTool {
  protected _graphicsProvider?: DynamicGraphicsProvider;

  protected override get wantAccuSnap(): boolean { return true; }
  protected override get wantDynamics(): boolean { return true; }

  protected clearGraphics(): void {
    if (undefined === this._graphicsProvider)
      return;
    this._graphicsProvider.cleanupGraphic();
    this._graphicsProvider = undefined;
  }

  protected async createGraphics(ev: BeButtonEvent): Promise<void> {
    if (!await this.updateDynamicData(ev))
      return;

    const placement = this.getPlacementProps();
    if (undefined === placement)
      return;

    const geometry = this.getGeometryProps(placement);
    if (undefined === geometry)
      return;

    if (undefined === this._graphicsProvider)
      this._graphicsProvider = new DynamicGraphicsProvider(this.iModel, this.toolId);

    // Set chord tolerance for curved surfaces...
    if (ev.viewport)
      this._graphicsProvider.chordTolerance = computeChordToleranceFromPoint(ev.viewport, ev.point);

    await this._graphicsProvider.createGraphic(this.targetCategory, placement, geometry);
  }

  public override onDynamicFrame(_ev: BeButtonEvent, context: DynamicsContext): void {
    if (undefined !== this._graphicsProvider)
      this._graphicsProvider.addGraphic(context);
  }

  public override async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    return this.createGraphics(ev);
  }

  protected abstract getPlacementProps(): PlacementProps | undefined;
  protected abstract getGeometryProps(placement: PlacementProps): JsonGeometryStream | FlatBufferGeometryStream | undefined;
  protected abstract getElementProps(placement: PlacementProps): GeometricElementProps | undefined;

  protected async doCreateElement(_props: GeometricElementProps, _data?: ElementGeometryBuilderParams): Promise<void> {}
  protected async updateElementData(_ev: BeButtonEvent, _isDynamics: boolean): Promise<void> {}

  protected async updateDynamicData(ev: BeButtonEvent): Promise<boolean> {
    if (!IModelApp.viewManager.inDynamicsMode)
      return false; // Don't need to create graphic if dynamics aren't yet active...

    await this.updateElementData(ev, true);
    return true;
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

    return this.doCreateElement(elemProps, data);
  }

  protected setupAccuDraw(): void { }

  protected override setupAndPromptForNextAction(): void {
    this.setupAccuDraw();
    super.setupAndPromptForNextAction();
  }

  protected async acceptPoint(ev: BeButtonEvent): Promise<boolean> {
    await this.updateElementData(ev, false);
    return true;
  }

  public override async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (!await this.acceptPoint(ev))
      return EventHandled.Yes;
    return super.onDataButtonDown(ev);
  }

  protected async cancelPoint(_ev: BeButtonEvent): Promise<boolean> { return true; }

  public override async onResetButtonUp(ev: BeButtonEvent): Promise<EventHandled> {
    if (!await this.cancelPoint(ev))
      return EventHandled.Yes;
    return super.onResetButtonUp(ev);
  }

  public override async onCleanup() {
    this.clearGraphics();
    return super.onCleanup();
  }
}

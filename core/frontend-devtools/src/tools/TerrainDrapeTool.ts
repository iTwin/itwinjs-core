/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { GrowableXYZArray, LineString3d, Point3d, Range3d } from "@bentley/geometry-core";
import { ColorDef, LinePixels } from "@bentley/imodeljs-common";
import { BeButtonEvent, DecorateContext, EventHandled, GraphicType, HitDetail, IModelApp, LocateFilterStatus, LocateResponse, PrimitiveTool, RealityTileTree, RealityTreeReference, TileTreeReference, Viewport } from "@bentley/imodeljs-frontend";

/** @packageDocumentation
 * @module Tools
 */

export class TerrainDrapeTool extends PrimitiveTool {
  private _drapePoints = new GrowableXYZArray();
  private _motionPoint?: Point3d;
  private _drapeViewport?: Viewport;
  private _drapeTreeRef?: TileTreeReference;
  public static toolId = "TerrainDrape";
  public requireWriteableTarget(): boolean { return false; }
  public onPostInstall() {
    super.onPostInstall();
    this.setupAndPromptForNextAction();
  }

  public onUnsuspend(): void { this.showPrompt(); }
  public createDecorations(context: DecorateContext, _suspend: boolean): void {
    if (this._drapeTreeRef && this._drapeViewport && this._drapePoints.length > 0) {
      if (this._drapePoints.length > 1) {
        const drapeTree = this._drapeTreeRef.treeOwner.load();
        if (drapeTree instanceof RealityTileTree) {
          const builder =  context.createGraphicBuilder(GraphicType.WorldDecoration);
          const lineStrings = new Array<LineString3d>();
          builder.setSymbology(ColorDef.white, ColorDef.white, 2);
          const drapeRange = Range3d.createNull();
          drapeRange.extendArray(this._drapePoints);
          const tolerance = drapeRange.diagonal().magnitude() / 5000.0;
          drapeTree.drapeLinestring(lineStrings, this._drapePoints, tolerance, this._drapeViewport);
          lineStrings.forEach((lineString) => builder.addLineString(lineString.points));
          context.addDecorationFromBuilder(builder);
        }
      }
      if (this._motionPoint) {
        const builder =  context.createGraphicBuilder(GraphicType.WorldOverlay);
        builder.setSymbology(ColorDef.white, ColorDef.white, 1, LinePixels.Code0);
        builder.addLineString([this._drapePoints.getPoint3dAtUncheckedPointIndex(this._drapePoints.length - 1), this._motionPoint]);
        context.addDecorationFromBuilder(builder);
      }
    }
  }
  public decorate(context: DecorateContext): void {
    this.createDecorations(context, false);
  }
  public decorateSuspended(context: DecorateContext): void {
    this.createDecorations(context, true);
  }

  private setupAndPromptForNextAction(): void {
    this.initLocateElements(undefined === this._drapeTreeRef);
    IModelApp.locateManager.options.allowDecorations = true;    // So we can select "contextual" reality models.
    this.showPrompt();
  }

  private showPrompt(): void {
    IModelApp.notifications.outputPromptByKey(`FrontendDevTools:tools.TerrainDrape.Prompts.${undefined === this._drapeTreeRef ? "SelectDrapeRealityModel" : "EnterDrapePoint"}`);
  }
  public async filterHit(hit: HitDetail, _out?: LocateResponse): Promise<LocateFilterStatus> {
    if (undefined !== this._drapeTreeRef)
      return LocateFilterStatus.Accept;

    if (!hit.modelId)
      return LocateFilterStatus.Reject;

    // Accept if context reality model
    const realityIndex = hit.viewport.getRealityModelIndexFromTransientId(hit.modelId);
    if (realityIndex >= 0)
      return LocateFilterStatus.Accept;

    // Accept model if it is a reality model.
    const model = this.iModel.models.getLoaded(hit.modelId)?.asSpatialModel;
    return model?.isRealityModel ? LocateFilterStatus.Accept : LocateFilterStatus.Reject;
  }
  public async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    this._motionPoint = ev.point;
    if (ev.viewport)
      ev.viewport.invalidateDecorations();
  }

  public async onResetButtonUp(ev: BeButtonEvent): Promise<EventHandled> {
    this._drapePoints.pop();
    if (ev.viewport)
      ev.viewport.invalidateDecorations();

    return EventHandled.No;
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    this._motionPoint = undefined;
    const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
    if (undefined === this._drapeTreeRef) {
      if (hit?.modelId) {
        this._drapePoints.push(hit.hitPoint);
        this._drapeViewport = hit.viewport;
        this._drapeViewport.forEachTileTreeRef((treeRef) => {
          if (treeRef instanceof RealityTreeReference) {
            const tree = treeRef.treeOwner.load();
            if (tree && tree.modelId === hit.modelId)
              this._drapeTreeRef = treeRef.createGeometryTreeRef();
          }
        });
      }
    } else {
      this._drapePoints.push(hit ? hit.hitPoint : ev.point);
    }
    this.setupAndPromptForNextAction();
    return EventHandled.No;
  }

  public onRestartTool(): void {
    const tool = new TerrainDrapeTool();
    if (!tool.run())
      this.exitTool();
  }

  public parseAndRun(..._args: string[]): boolean {
    this.run();
    return true;
  }
}

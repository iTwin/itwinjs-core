/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String } from "@bentley/bentleyjs-core";
import { Point3d } from "@bentley/geometry-core";
import { BeButtonEvent, DecorateContext, EventHandled, HitDetail, IModelApp, LocateFilterStatus, LocateResponse, PrimitiveTool, RealityTileDrapeStatus, RealityTileTree, Viewport } from "@bentley/imodeljs-frontend";

/** @packageDocumentation
 * @module Tools
 */

export class TerrainDrapeTool extends PrimitiveTool {
  private _drapePoints = new Array<Point3d>();
  private _drapeTargetModelId?: Id64String;
  private _drapeViewport?: Viewport;

  public onPostInstall() { super.onPostInstall(); this.setupAndPromptForNextAction(); }

  public onUnsuspend(): void { this.showPrompt(); }
  public decorate(_context: DecorateContext): void {
    if (this._drapeTargetModelId && this._drapeViewport && this._drapePoints.length > 1) {
      let drapeTree: RealityTileTree | undefined;

      this._drapeViewport.forEachTileTreeRef((treeRef) => {
        const tree = treeRef.treeOwner.load();
        if (tree && tree.modelId === this._drapeTargetModelId)
          drapeTree = tree as RealityTileTree;
      });
      if (drapeTree) {
        if (RealityTileDrapeStatus.Success === drapeTree.drapeLinestring(this._drapePoints, .1)) {

        }
      }
    }
  }

  private setupAndPromptForNextAction(): void {
    this.initLocateElements(undefined === this._drapeTargetModelId);
    IModelApp.locateManager.options.allowDecorations = true;    // So we can select "contextual" reality models.
    this.showPrompt();
  }

  private showPrompt(): void {
    IModelApp.notifications.outputPromptByKey(`FrontendDevTools:tools.TerrainDrape.Prompts.${undefined === this._drapeTargetModelId ? "EnterDrapePoint" : "SelectDrapeRealityModel"}`);
  }
  public async filterHit(hit: HitDetail, _out?: LocateResponse): Promise<LocateFilterStatus> {
    if (undefined !== this._drapeTargetModelId)
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

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === this._drapeTargetModelId) {
      const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
      if (hit?.modelId) {
        this._drapeTargetModelId = hit.modelId;
        this._drapeViewport = hit.viewport;
      }
    } else {
      this._drapePoints.push(ev.point);
    }
    this.setupAndPromptForNextAction();
    return EventHandled.No;
  }

  public onRestartTool(): void {
    const tool = new TerrainDrapeTool();
    if (!tool.run())
      this.exitTool();
  }
  public run(..._args: any[]): boolean {
    return true;
  }

  public parseAndRun(..._args: string[]): boolean {
    this.run();
    return true;
  }

}

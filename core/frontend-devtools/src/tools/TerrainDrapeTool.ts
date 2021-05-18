/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { GrowableXYZArray, LineString3d, Range3d } from "@bentley/geometry-core";
import { ColorDef } from "@bentley/imodeljs-common";
import { BeButtonEvent, DecorateContext, EventHandled, GraphicType, HitDetail, IModelApp, LocateFilterStatus, LocateResponse, PrimitiveTool, RealityTileTree, RealityTreeReference, TileTreeReference, Viewport } from "@bentley/imodeljs-frontend";

/** @packageDocumentation
 * @module Tools
 */

export class TerrainDrapeTool extends PrimitiveTool {
  private _drapePoints = new GrowableXYZArray();
  private _drapeViewport?: Viewport;
  private _drapeTreeRef?: TileTreeReference;
  public static toolId = "TerrainDrape";
  public requireWriteableTarget(): boolean { return false; }
  public onPostInstall() {
    super.onPostInstall();
    this.setupAndPromptForNextAction();
  }

  public onUnsuspend(): void { this.showPrompt(); }
  public decorate(context: DecorateContext): void {
    if (this._drapeTreeRef && this._drapeViewport && this._drapePoints.length > 1) {
      const drapeTree = this._drapeTreeRef.treeOwner.load();

      if (drapeTree instanceof RealityTileTree) {
        const lineStrings = new Array<LineString3d>();
        const builder =  context.createGraphicBuilder(GraphicType.WorldDecoration);
        builder.setSymbology(ColorDef.white, ColorDef.white, 5);
        const drapeRange = Range3d.createNull();
        drapeRange.extendArray(this._drapePoints);
        const tolerance = drapeRange.diagonal().magnitude() / 1000.0;
        drapeTree.drapeLinestring(lineStrings, this._drapePoints, tolerance, this._drapeViewport);
        lineStrings.forEach((lineString) => builder.addLineString(lineString.points));
        context.addDecorationFromBuilder(builder);
      }
    }
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

  public async onResetButtonDown(_ev: BeButtonEvent): Promise<EventHandled> {
    this._drapePoints.pop();
    return EventHandled.No;
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === this._drapeTreeRef) {
      const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
      if (hit?.modelId) {
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

  public parseAndRun(..._args: string[]): boolean {
    this.run();
    return true;
  }
}

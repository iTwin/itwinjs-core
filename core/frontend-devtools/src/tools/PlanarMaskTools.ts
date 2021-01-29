/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import { Id64String } from "@bentley/bentleyjs-core";
import { PlanarClipMaskSettings, PlanarClipMaskMode, PlanarClipMaskProps } from "@bentley/imodeljs-common";
import { BeButtonEvent, ContextRealityModelState, EventHandled, GeometricModelState, HitDetail, IModelApp, LocateFilterStatus, LocateResponse, PrimitiveTool, ScreenViewport, Tool, ViewPose } from "@bentley/imodeljs-frontend";
import { parseToggle } from "./parseToggle";

function applyMapMasking(onOff: boolean | undefined, maskProps: PlanarClipMaskProps) {
  const vp = IModelApp.viewManager.selectedView;
  if (undefined === vp || !vp.view.isSpatialView())
    if (undefined === vp || !vp.view.isSpatialView())
      return false;

  const maskOn = (onOff === undefined) ? !vp.displayStyle.backgroundMapSettings.planarClipMask.anyDefined : onOff;

  vp.changeBackgroundMapProps({ planarClipMask: maskOn ? maskProps : { mode: PlanarClipMaskMode.None } });
  vp.invalidateRenderPlan();

  return true;
}

/** Set Map Masking by selected models.
 * @alpha
 */
export class SetMapHigherPriorityMasking extends Tool {
  public static toolId = "SetMapHigherPriorityMask";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  public run(onOff?: boolean): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp)
      return false;

    applyMapMasking(onOff, PlanarClipMaskSettings.create(PlanarClipMaskMode.HigherPriorityModels)!.toJSON());
    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const toggle = parseToggle(args[0]);
    return this.run(typeof toggle === "string" ? undefined : toggle);
  }
}

/** Unmask Mask.
 * @alpha
 */
export class UnmaskMapTool extends Tool {
  public static toolId = "UnmaskMap";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 0; }

  public run(): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp)
      return false;

    vp.changeBackgroundMapProps({ planarClipMask: { mode: PlanarClipMaskMode.None } });
    vp.invalidateRenderPlan();
    return true;
  }
  public parseAndRun(..._args: string[]): boolean { return this.run(); }
}

function applyToRealityModel(vp: ScreenViewport, index: number, func: (indexOrId: Id64String | number) => boolean): boolean {
  if (index < 0) {
    let i = 0;
    let changed = false;
    vp.displayStyle.forEachRealityModel((_model: ContextRealityModelState) => changed = changed || func(i++));
    vp.view.forEachModel((model: GeometricModelState) => { if (model.asSpatialModel && model.asSpatialModel.isRealityModel) changed = changed || func(model.id); });
    return changed
  } else {
    return func(index);
  }
}

function applyMaskToRealityModel(index: number, onOff: boolean | undefined, mask: PlanarClipMaskSettings): boolean {
  const vp = IModelApp.viewManager.selectedView;
  if (vp === undefined)
    return false;

  return applyToRealityModel(vp, index, (indexOrId: Id64String | number) => {
    const currentMask = vp.getRealityModelPlanarClipMask(indexOrId);
    const maskOn = (onOff === undefined) ? currentMask === undefined : onOff;
    return maskOn ? vp.overrideRealityModelPlanarClipMask(indexOrId, mask) : vp.dropRealityModelPlanarClipMask(indexOrId);
  });
}

/** Base class for the reality model planar masking tools.
 * @beta
 */

export abstract class PlanarMaskBaseTool extends PrimitiveTool {
  protected readonly _acceptedModelIds = new Set<Id64String>();
  protected readonly _acceptedSubCategoryIds = new Set<Id64String>();
  protected readonly _acceptedElementIds = new Set<Id64String>();
  protected _useSelection: boolean = false;
  protected _targetModelId?: Id64String | number;

  public requireWriteableTarget(): boolean { return false; }
  public onPostInstall() { super.onPostInstall(); this.setupAndPromptForNextAction(); }
  public onCleanup(): void { if (0 !== this._acceptedElementIds.size) this.iModel.hilited.setHilite(this._acceptedElementIds, false); }
  public onUnsuspend(): void { this.showPrompt(); }
  private setupAndPromptForNextAction(): void {
    this._useSelection = (undefined !== this.targetView && this.targetView.iModel.selectionSet.isActive);
    this.initLocateElements();
    IModelApp.locateManager.options.allowDecorations = true;    // So we can select "contextual" reality models.
    this.showPrompt();
  }
  protected abstract targetModelRequired(): boolean;
  protected abstract showPrompt(): void;
  protected abstract createToolInstance(): PlanarMaskBaseTool;
  protected abstract applyMask(vp: ScreenViewport): void;

  public onRestartTool(): void {
    const tool = this.createToolInstance();
    if (!tool.run())
      this.exitTool();
  }

  public async filterHit(hit: HitDetail, _out?: LocateResponse): Promise<LocateFilterStatus> {
    if (!hit.modelId)
      return LocateFilterStatus.Reject;

    if (undefined === this._targetModelId && this.targetModelRequired()) {
      const realityIndex = hit.viewport.getRealityModelIndexFromTransientId(hit.modelId);
      if (realityIndex >= 0)
        return LocateFilterStatus.Accept;

      const model = this.iModel.models.getLoaded(hit.modelId)?.asSpatialModel;
      return model?.isRealityModel ? LocateFilterStatus.Accept : LocateFilterStatus.Reject;
    }
    else
      return (hit.isElementHit && !hit.isModelHit && !this._acceptedElementIds.has(hit.sourceId)) ? LocateFilterStatus.Accept : LocateFilterStatus.Reject;
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === hit || undefined === vp)
      return EventHandled.No;

    if (undefined === this._targetModelId && this.targetModelRequired()) {
      if (hit.modelId) {
        const realityIndex = hit.viewport.getRealityModelIndexFromTransientId(hit.modelId);
        this._targetModelId = realityIndex >= 0 ? realityIndex : hit.modelId;
      }
    } else if (hit.isElementHit) {
      const sourceId = hit.sourceId;
      if (!this._acceptedElementIds.has(sourceId)) {
        this._acceptedElementIds.add(sourceId);
        this._acceptedModelIds.add(hit.modelId!)
        if (hit.subCategoryId)
          this._acceptedSubCategoryIds.add(hit.subCategoryId);
        this.applyMask(vp);
      }
    }
    this.setupAndPromptForNextAction();
    return EventHandled.No;
  }
}
/** Tool to mask background map by elements
 * @beta
 */
export class MaskBackgroundMapByElementTool extends PlanarMaskBaseTool {
  public static toolId = "MaskBackgroundMapByElement";
  protected targetModelRequired() { return false; }
  protected showPrompt(): void {
    IModelApp.notifications.outputPromptByKey("FrontendDevTools:tools.MaskBackgroundMapByElement.Prompts.IdentifyMaskElement");
  }
  protected createToolInstance(): PlanarMaskBaseTool { return new MaskBackgroundMapByElementTool(); }
  protected applyMask(vp: ScreenViewport): void {
    vp.changeBackgroundMapProps({ planarClipMask: PlanarClipMaskSettings.create(PlanarClipMaskMode.Elements, this._acceptedModelIds, this._acceptedElementIds) });
  }
}

/** Tool to mask background map by SubCategories
 * @beta
 */
export class MaskBackgroundMapBySubCategoryTool extends PlanarMaskBaseTool {
  public static toolId = "MaskBackgroundMapBySubCategory";
  protected targetModelRequired() { return false; }
  protected showPrompt(): void {
    IModelApp.notifications.outputPromptByKey("FrontendDevTools:tools.MaskBackgroundMapBySubCategory.Prompts.IdentifyMaskSubCategory");
  }
  protected createToolInstance(): PlanarMaskBaseTool { return new MaskBackgroundMapBySubCategoryTool(); }
  protected applyMask(vp: ScreenViewport): void {
    vp.changeBackgroundMapProps({ planarClipMask: PlanarClipMaskSettings.create(PlanarClipMaskMode.SubCategories, this._acceptedModelIds, this._acceptedSubCategoryIds) });
  }
}

/** Tool to mask background map by geometric models
 * @beta
 */
export class MaskBackgroundMapByModelTool extends PlanarMaskBaseTool {
  public static toolId = "MaskBackgroundMapByModel";
  protected targetModelRequired() { return false; }
  protected showPrompt(): void {
    IModelApp.notifications.outputPromptByKey("FrontendDevTools:tools.MaskBackgroundMapByModel.Prompts.IdentifyMaskModel");
  }
  protected createToolInstance(): PlanarMaskBaseTool { return new MaskBackgroundMapByModelTool(); }
  protected applyMask(vp: ScreenViewport): void {
    vp.changeBackgroundMapProps({ planarClipMask: PlanarClipMaskSettings.create(PlanarClipMaskMode.Models, this._acceptedModelIds) });
  }
}

/** Tool to mask reality model by elements
 * @beta
 */
export class MaskRealityModelByElementTool extends PlanarMaskBaseTool {
  public static toolId = "MaskRealityModelByElement";
  protected targetModelRequired() { return true; }

  protected showPrompt(): void {
    const key = "FrontendDevTools:tools.MaskRealityModelByElement.Prompts." + (this._targetModelId === undefined ? "IdentifyRealityModel" : "IdentifyMaskElement");
    IModelApp.notifications.outputPromptByKey(key);
  }
  protected createToolInstance(): PlanarMaskBaseTool { return new MaskRealityModelByElementTool(); }
  protected applyMask(vp: ScreenViewport): void {
    vp.overrideRealityModelPlanarClipMask(this._targetModelId!, PlanarClipMaskSettings.create(PlanarClipMaskMode.Elements, this._acceptedModelIds, this._acceptedElementIds)!);
  }
}

/** Tool to mask reality model by geometric models */

export class MaskRealityModelByModelTool extends PlanarMaskBaseTool {
  public static toolId = "MaskRealityModelByModel";
  protected targetModelRequired() { return true; }

  protected showPrompt(): void {
    const key = "FrontendDevTools:tools.MaskRealityModelByModel.Prompts." + (this._targetModelId === undefined ? "IdentifyRealityModel" : "IdentifyMaskModel");
    IModelApp.notifications.outputPromptByKey(key);
  }
  protected createToolInstance(): PlanarMaskBaseTool { return new MaskRealityModelByElementTool(); }
  protected applyMask(vp: ScreenViewport): void {
    vp.overrideRealityModelPlanarClipMask(this._targetModelId!, PlanarClipMaskSettings.create(PlanarClipMaskMode.Models, this._acceptedModelIds)!);
  }
}

/** Tool to mask reality model by SubCategories */
export class MaskRealityModelBySubCategoryTool extends PlanarMaskBaseTool {
  public static toolId = "MaskRealityModelBySubCategory";
  protected targetModelRequired() { return true; }

  protected showPrompt(): void {
    const key = "FrontendDevTools:tools.MaskRealityModelByModel.Prompts." + (this._targetModelId === undefined ? "IdentifyRealityModel" : "IdentifyMaskSubCategory");
    IModelApp.notifications.outputPromptByKey(key);
  }
  protected createToolInstance(): PlanarMaskBaseTool { return new MaskRealityModelBySubCategoryTool(); }
  protected applyMask(vp: ScreenViewport): void {
    vp.overrideRealityModelPlanarClipMask(this._targetModelId!, PlanarClipMaskSettings.create(PlanarClipMaskMode.SubCategories, this._acceptedModelIds, this._acceptedSubCategoryIds)!);
  }
}

/** Tool to mask reality model by higher priority models.
 * @beta
 */
export class SetHigherPriorityRealityModelMasking extends PlanarMaskBaseTool {
  public static toolId = "SetHigherPriorityRealityModelMasking";
  protected targetModelRequired() { return true; }

  protected showPrompt(): void {
    IModelApp.notifications.outputPromptByKey("FrontendDevTools:tools.SetHigherPriorityRealityModelMasking.Prompts.IdentifyRealityModel");
  }
  protected createToolInstance(): PlanarMaskBaseTool { return new UnmaskRealityModelTool(); }
  protected applyMask(vp: ScreenViewport): void {
    vp.overrideRealityModelPlanarClipMask(this._targetModelId!, PlanarClipMaskSettings.create(PlanarClipMaskMode.SubCategories, this._acceptedModelIds, this._acceptedSubCategoryIds)!);
  }
  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
    if (hit?.modelId) {
      const realityIndex = hit.viewport.getRealityModelIndexFromTransientId(hit.modelId)
      hit.viewport.overrideRealityModelPlanarClipMask(realityIndex >= 0 ? realityIndex : hit.modelId, PlanarClipMaskSettings.create(PlanarClipMaskMode.HigherPriorityModels)!);
      this.onRestartTool();
    }

    return EventHandled.No
  }
}

/** Remove masks from reality model.
 * @beta
 */
export class UnmaskRealityModelTool extends PlanarMaskBaseTool {
  public static toolId = "UnmaskRealityModel";
  protected targetModelRequired() { return true; }

  protected showPrompt(): void {
    IModelApp.notifications.outputPromptByKey("FrontendDevTools:tools.UnmaskRealityModel.Prompts.IdentifyRealityModel");
  }
  protected createToolInstance(): PlanarMaskBaseTool { return new UnmaskRealityModelTool(); }
  protected applyMask(vp: ScreenViewport): void {
    vp.overrideRealityModelPlanarClipMask(this._targetModelId!, PlanarClipMaskSettings.create(PlanarClipMaskMode.SubCategories, this._acceptedModelIds, this._acceptedSubCategoryIds)!);
  }
  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
    if (hit?.modelId) {
      const realityIndex = hit.viewport.getRealityModelIndexFromTransientId(hit.modelId)
      hit.viewport.dropRealityModelPlanarClipMask(realityIndex >= 0 ? realityIndex : hit.modelId);
      this.onRestartTool();
    }

    return EventHandled.No;
  }
}

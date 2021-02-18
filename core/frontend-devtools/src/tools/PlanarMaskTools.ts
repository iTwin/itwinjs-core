/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import { Id64String } from "@bentley/bentleyjs-core";
import { PlanarClipMaskMode, PlanarClipMaskPriority, PlanarClipMaskSettings } from "@bentley/imodeljs-common";
import {
  BeButtonEvent, EventHandled, HitDetail, IModelApp, LocateFilterStatus, LocateResponse, PrimitiveTool, ScreenViewport, Tool,
} from "@bentley/imodeljs-frontend";

/** Set Map Masking by selected models.
 * @beta
 */
export class SetMapHigherPriorityMasking extends Tool {
  public static toolId = "SetMapHigherPriorityMask";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  public run(transparency?: number): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp)
      return false;

    vp.changeBackgroundMapProps({ planarClipMask: { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap, transparency } });
    vp.invalidateRenderPlan();
    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const transparency =  parseFloat(args[0]);
    return this.run( (transparency !== undefined && transparency  < 1.0) ? transparency : undefined);
  }
}

/** Unmask Mask.
 * @beta
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
  public parseAndRun(..._args: string[]): boolean {
    return this.run();
  }
}

/** Base class for the reality model planar masking tools.
 * @beta
 */
export abstract class PlanarMaskBaseTool extends PrimitiveTool {
  protected readonly _acceptedModelIds = new Set<Id64String>();
  protected readonly _acceptedSubCategoryIds = new Set<Id64String>();
  protected readonly _acceptedElementIds = new Set<Id64String>();
  protected _transparency?: number;
  protected _useSelection: boolean = false;
  protected _targetMaskModelId?: Id64String | number;

  public requireWriteableTarget(): boolean { return false; }
  public onPostInstall() { super.onPostInstall(); this.setupAndPromptForNextAction(); }

  public onUnsuspend(): void { this.showPrompt(); }
  private setupAndPromptForNextAction(): void {
    this._useSelection = (undefined !== this.targetView && this.iModel.selectionSet.isActive);
    this.initLocateElements(!this._useSelection || (this.targetModelRequired() && !this._targetMaskModelId));
    IModelApp.locateManager.options.allowDecorations = true;    // So we can select "contextual" reality models.
    this.showPrompt();
  }
  protected targetModelRequired(): boolean { return true; }
  protected elementRequired(): boolean { return true; }
  protected allowSelection(): boolean { return true; }
  protected abstract showPrompt(): void;
  protected abstract createToolInstance(): PlanarMaskBaseTool;
  protected abstract applyMask(vp: ScreenViewport): void;
  private clearIds() {
    this._acceptedElementIds.clear();
    this._acceptedModelIds.clear();
  }
  public exitTool() {
    super.exitTool();
    this._transparency = undefined;
  }

  public onRestartTool(): void {
    this.clearIds();
    this._acceptedSubCategoryIds.clear();
    const tool = this.createToolInstance();
    if (!tool.run())
      this.exitTool();
  }

  public parseAndRun(...args: string[]): boolean {
    const transparency =  parseFloat(args[0]);
    this._transparency = (transparency !== undefined && transparency  < 1.0) ? transparency : undefined;
    return this.run();
  }

  public onCleanup(): void {
    if (0 !== this._acceptedElementIds.size)
      this.iModel.hilited.setHilite(this._acceptedElementIds, false);
    this.clearIds();
  }

  public async filterHit(hit: HitDetail, _out?: LocateResponse): Promise<LocateFilterStatus> {
    if (!hit.modelId)
      return LocateFilterStatus.Reject;

    if (undefined === this._targetMaskModelId && this.targetModelRequired()) {
      const realityIndex = hit.viewport.getRealityModelIndexFromTransientId(hit.modelId);
      if (realityIndex >= 0)
        return LocateFilterStatus.Accept;

      const model = this.iModel.models.getLoaded(hit.modelId)?.asSpatialModel;
      return model?.isRealityModel ? LocateFilterStatus.Accept : LocateFilterStatus.Reject;
    } else
      return (hit.isElementHit && !hit.isModelHit && !this._acceptedElementIds.has(hit.sourceId)) ? LocateFilterStatus.Accept : LocateFilterStatus.Reject;
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp)
      return EventHandled.No;

    if (undefined !== hit && undefined === this._targetMaskModelId && this.targetModelRequired()) {
      if (hit.modelId) {
        const realityIndex = hit.viewport.getRealityModelIndexFromTransientId(hit.modelId);
        this._targetMaskModelId = realityIndex >= 0 ? realityIndex : hit.modelId;
        if (!this.elementRequired()) {
          this.applyMask(vp);
          this.onRestartTool();
        }
      }
    } else if (this._useSelection && this.iModel.selectionSet.isActive) {
      const elements = await this.iModel.elements.getProps(this.iModel.selectionSet.elements);
      for (const element of elements) {
        if (element.id && element.model) {
          this._acceptedElementIds.add(element.id);
          this._acceptedModelIds.add(element.model);
        }
      }
      this.applyMask(vp);
      this.exitTool();
      return EventHandled.No;
    } else if (undefined !== hit && hit.isElementHit) {
      const sourceId = hit.sourceId;
      if (!this._acceptedElementIds.has(sourceId)) {
        this._acceptedElementIds.add(sourceId);
        this._acceptedModelIds.add(hit.modelId!);
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
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }
  protected targetModelRequired() { return false; }
  protected showPrompt(): void {
    IModelApp.notifications.outputPromptByKey(`FrontendDevTools:tools.MaskBackgroundMapByElement.Prompts.${this._useSelection ? "AcceptSelection" : "IdentifyMaskElement"}`);
  }
  protected createToolInstance(): PlanarMaskBaseTool { return new MaskBackgroundMapByElementTool(); }
  protected applyMask(vp: ScreenViewport): void {
    vp.changeBackgroundMapProps({ planarClipMask: PlanarClipMaskSettings.create(PlanarClipMaskMode.IncludeElements, this._acceptedModelIds, this._acceptedElementIds, this._transparency) });
  }
}
/** Tool to mask background map by excluded elements
 * @beta
 */
export class MaskBackgroundMapByExcludedElementTool extends PlanarMaskBaseTool {
  public static toolId = "MaskBackgroundMapByExcludedElement";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }
  protected targetModelRequired() { return false; }
  protected showPrompt(): void {
    IModelApp.notifications.outputPromptByKey(`FrontendDevTools:tools.MaskBackgroundMapByExcludedElement.Prompts.${this._useSelection ? "AcceptSelection" : "IdentifyMaskElement"}`);
  }
  protected createToolInstance(): PlanarMaskBaseTool { return new MaskBackgroundMapByExcludedElementTool(); }
  protected applyMask(vp: ScreenViewport): void {
    vp.changeBackgroundMapProps({ planarClipMask: PlanarClipMaskSettings.create(PlanarClipMaskMode.ExcludeElements, this._acceptedModelIds, this._acceptedElementIds, this._transparency) });
  }
}

/** Tool to mask background map by SubCategories
 * @beta
 */
export class MaskBackgroundMapBySubCategoryTool extends PlanarMaskBaseTool {
  public static toolId = "MaskBackgroundMapBySubCategory";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }
  protected targetModelRequired() { return false; }
  protected allowSelection(): boolean { return false; }   // Need picking to get subcategory.
  protected showPrompt(): void {
    IModelApp.notifications.outputPromptByKey("FrontendDevTools:tools.MaskBackgroundMapBySubCategory.Prompts.IdentifyMaskSubCategory");
  }
  protected createToolInstance(): PlanarMaskBaseTool { return new MaskBackgroundMapBySubCategoryTool(); }
  protected applyMask(vp: ScreenViewport): void {
    vp.changeBackgroundMapProps({ planarClipMask: PlanarClipMaskSettings.create(PlanarClipMaskMode.IncludeSubCategories, this._acceptedModelIds, this._acceptedSubCategoryIds, this._transparency) });
  }
}

/** Tool to mask background map by geometric models
 * @beta
 */
export class MaskBackgroundMapByModelTool extends PlanarMaskBaseTool {
  public static toolId = "MaskBackgroundMapByModel";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }
  protected targetModelRequired() { return false; }
  protected showPrompt(): void {
    IModelApp.notifications.outputPromptByKey(`FrontendDevTools:tools.MaskBackgroundMapByModel.Prompts.${this._useSelection ? "AcceptSelection" : "IdentifyMaskModel"}`);
  }
  protected createToolInstance(): PlanarMaskBaseTool { return new MaskBackgroundMapByModelTool(); }
  protected applyMask(vp: ScreenViewport): void {
    vp.changeBackgroundMapProps({ planarClipMask: PlanarClipMaskSettings.create(PlanarClipMaskMode.Models, this._acceptedModelIds, undefined, this._transparency) });
  }
}

/** Tool to mask reality model by elements
 * @beta
 */
export class MaskRealityModelByElementTool extends PlanarMaskBaseTool {
  public static toolId = "MaskRealityModelByElement";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }
  protected targetModelRequired() { return true; }

  protected showPrompt(): void {
    const key = `FrontendDevTools:tools.MaskRealityModelByElement.Prompts.${  this._targetMaskModelId === undefined ? "IdentifyRealityModel" : (this._useSelection ? "AcceptSelection" : "IdentifyMaskElement")}`;
    IModelApp.notifications.outputPromptByKey(key);
  }
  protected createToolInstance(): PlanarMaskBaseTool { return new MaskRealityModelByElementTool(); }
  protected applyMask(vp: ScreenViewport): void {
    vp.displayStyle.overrideRealityModelPlanarClipMask(this._targetMaskModelId!, PlanarClipMaskSettings.create(PlanarClipMaskMode.IncludeElements, this._acceptedModelIds, this._acceptedElementIds, this._transparency)!);
  }
}

/** Tool to mask reality model by excluded elements
 * @beta
 */
export class MaskRealityModelByExcludedElementTool extends PlanarMaskBaseTool {
  public static toolId = "MaskRealityModelByExcludedElement";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }
  protected targetModelRequired() { return true; }

  protected showPrompt(): void {
    const key = `FrontendDevTools:tools.MaskRealityModelByExcludedElement.Prompts.${this._targetMaskModelId === undefined ? "IdentifyRealityModel" : (this._useSelection ? "AcceptSelection" : "IdentifyMaskElement")}`;
    IModelApp.notifications.outputPromptByKey(key);
  }
  protected createToolInstance(): PlanarMaskBaseTool { return new MaskRealityModelByExcludedElementTool(); }
  protected applyMask(vp: ScreenViewport): void {
    vp.displayStyle.overrideRealityModelPlanarClipMask(this._targetMaskModelId!, PlanarClipMaskSettings.create(PlanarClipMaskMode.ExcludeElements, this._acceptedModelIds, this._acceptedElementIds, this._transparency)!);
  }
}

/** Tool to mask reality model by geometric models
 * @beta
 */

export class MaskRealityModelByModelTool extends PlanarMaskBaseTool {
  public static toolId = "MaskRealityModelByModel";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  protected targetModelRequired() { return true; }

  protected showPrompt(): void {
    const key = `FrontendDevTools:tools.MaskRealityModelByModel.Prompts.${this._targetMaskModelId === undefined ? "IdentifyRealityModel" : (this._useSelection ? "AcceptSelection" : "IdentifyMaskModel")}`;
    IModelApp.notifications.outputPromptByKey(key);
  }
  protected createToolInstance(): PlanarMaskBaseTool { return new MaskRealityModelByModelTool(); }
  protected applyMask(vp: ScreenViewport): void {
    vp.displayStyle.overrideRealityModelPlanarClipMask(this._targetMaskModelId!, PlanarClipMaskSettings.create(PlanarClipMaskMode.Models, this._acceptedModelIds, undefined,  this._transparency)!);
  }
}

/** Tool to mask reality model by SubCategories
 * @beta
 */
export class MaskRealityModelBySubCategoryTool extends PlanarMaskBaseTool {
  public static toolId = "MaskRealityModelBySubCategory";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }
  protected targetModelRequired() { return true; }
  protected allowSelection(): boolean { return false; }   // Need picking to get subcategory.

  protected showPrompt(): void {
    const key = `FrontendDevTools:tools.MaskRealityModelByModel.Prompts.${  this._targetMaskModelId === undefined ? "IdentifyRealityModel" : "IdentifyMaskSubCategory"}`;
    IModelApp.notifications.outputPromptByKey(key);
  }
  protected createToolInstance(): PlanarMaskBaseTool { return new MaskRealityModelBySubCategoryTool(); }
  protected applyMask(vp: ScreenViewport): void {
    vp.displayStyle.overrideRealityModelPlanarClipMask(this._targetMaskModelId!, PlanarClipMaskSettings.create(PlanarClipMaskMode.IncludeSubCategories, this._acceptedModelIds, this._acceptedSubCategoryIds, this._transparency)!);
  }
}

/** Tool to mask reality model by higher priority models.
 * @beta
 */
export class SetHigherPriorityRealityModelMasking extends PlanarMaskBaseTool {
  public static toolId = "SetHigherPriorityRealityModelMasking";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 2; }
  protected targetModelRequired() { return true; }
  protected elementRequired() { return false; }
  private _priority = 0;

  protected showPrompt(): void {
    IModelApp.notifications.outputPromptByKey("FrontendDevTools:tools.SetHigherPriorityRealityModelMasking.Prompts.IdentifyRealityModel");
  }
  protected createToolInstance(): PlanarMaskBaseTool { return new SetHigherPriorityRealityModelMasking(); }
  protected applyMask(vp: ScreenViewport): void {
    const basePriority = this._targetMaskModelId === vp.displayStyle.getOSMBuildingDisplayIndex() ? PlanarClipMaskPriority.GlobalRealityModel : PlanarClipMaskPriority.RealityModel;
    vp.displayStyle.overrideRealityModelPlanarClipMask(this._targetMaskModelId!, PlanarClipMaskSettings.createByPriority(basePriority + this._priority, this._transparency)!);
  }

  public parseAndRun(...args: string[]): boolean {
    super.parseAndRun(...args);
    const priority = parseInt(args[1], 10);
    this._priority = (priority === undefined || isNaN(priority)) ? 0 : priority;
    return this.run();
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
    vp.displayStyle.overrideRealityModelPlanarClipMask(this._targetMaskModelId!, PlanarClipMaskSettings.create(PlanarClipMaskMode.IncludeSubCategories, this._acceptedModelIds, this._acceptedSubCategoryIds)!);
  }
  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
    if (hit?.modelId) {
      const realityIndex = hit.viewport.getRealityModelIndexFromTransientId(hit.modelId);
      hit.viewport.displayStyle.dropRealityModelPlanarClipMask(realityIndex >= 0 ? realityIndex : hit.modelId);
      this.onRestartTool();
    }

    return EventHandled.No;
  }
}

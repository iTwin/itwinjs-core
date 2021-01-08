/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import { Id64, Id64Array, Id64String } from "@bentley/bentleyjs-core";
import { FeatureAppearance, FeatureAppearanceProps, PlanarClipMask, PlanarClipMaskMode, PlanarClipMaskProps, RgbColorProps } from "@bentley/imodeljs-common";
import { BeButtonEvent, ContextRealityModelState, EventHandled, GeometricModelState, getCesiumAssetUrl, HitDetail, HitGeomType, IModelApp, LocateFilterStatus, LocateResponse, NotifyMessageDetails, OutputMessagePriority, PrimitiveTool, ScreenViewport, Tool, Viewport, ViewPose } from "@bentley/imodeljs-frontend";
import { copyStringToClipboard } from "../ClipboardUtilities";
import { parseBoolean } from "./parseBoolean";
import { parseToggle } from "./parseToggle";

/** @alpha */
export class AttachRealityModelTool extends Tool {
  public static toolId = "AttachRealityModelTool";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 1; }

  public run(data: string): boolean {
    const props = JSON.parse(data);
    const vp = IModelApp.viewManager.selectedView;
    if (vp === undefined)
      return false;

    if (props === undefined || props.tilesetUrl === undefined) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, `Properties ${props} are not valid`));
    }

    vp.attachRealityModel(props);
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Reality Model ${props.tilesetUrl} attached`));

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run(args[0]);
  }
}

/** @alpha */
export class SaveRealityModelTool extends Tool {
  public static toolId = "SaveRealityModelTool";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  public run(name: string | undefined): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (vp === undefined)
      return false;
    vp.displayStyle.forEachRealityModel((realityModel) => {
      if (name === undefined || realityModel.name === name) {
        copyStringToClipboard(JSON.stringify(realityModel.toJSON()));
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Reality Model ${realityModel.name} copied to clipboard`));
      }
    });

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run(args.length > 0 ? args[0] : undefined);
  }
}

function changeRealityModelAppearanceOverrides(vp: Viewport, overrides: FeatureAppearanceProps, index: number): boolean {
  const existingOverrides = vp.getRealityModelAppearanceOverride(index);
  return vp.overrideRealityModelAppearance(index, existingOverrides ? existingOverrides.clone(overrides) : FeatureAppearance.fromJSON(overrides));
}

/** Set reality model appearance override for transparency in display style.
 * @beta
 */
export class SetRealityModelTransparencyTool extends Tool {
  public static toolId = "SetRealityModelTransparencyTool";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 2; }

  public run(transparency: number, index: number): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (vp === undefined)
      return false;

    const changed = changeRealityModelAppearanceOverrides(vp, { transparency }, index);

    if (changed)
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Reality Model at Index: ${index} set to transparency: ${transparency}`));

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run(parseFloat(args[0]), args.length > 1 ? parseInt(args[1], 10) : -1);
  }
}
/** Set reality model appearance override for locatable in display style.
 * @beta
 */
export class SetRealityModelLocateTool extends Tool {
  public static toolId = "SetRealityModelLocateTool";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 2; }

  public run(locate: boolean, index: number): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (vp === undefined)
      return false;

    const nonLocatable = locate ? undefined : true;
    const changed = changeRealityModelAppearanceOverrides(vp, { nonLocatable }, index);

    if (changed)
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Reality Model at Index: ${index} set to locate: ${locate}`));

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const locate = parseBoolean(args[0]);
    return locate === undefined ? false : this.run(locate, args.length > 1 ? parseInt(args[1], 10) : -1);
  }
}

/** Set reality model appearance override for emphasized in display style.
 * @beta
 */
export class SetRealityModelEmphasizedTool extends Tool {
  public static toolId = "SetRealityModelEmphasizedTool";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 2; }

  public run(emphasized: true | undefined, index: number): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (vp === undefined)
      return false;

    const changed = changeRealityModelAppearanceOverrides(vp, { emphasized }, index);

    if (changed)
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Reality Model at Index: ${index} set to emphasized: ${emphasized}`));

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const emphasized = parseBoolean(args[0]);
    return emphasized === undefined ? false : this.run(emphasized ? true : undefined, args.length > 1 ? parseInt(args[1], 10) : -1);
  }
}

/** Detach reality model from display style.
 * @beta
 */
export class DetachRealityModelTool extends Tool {
  public static toolId = "ViewportDetachRealityModel";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  public run(index: number): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (vp === undefined)
      return false;

    vp.detachRealityModelByIndex(index);
    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run(args.length > 1 ? parseInt(args[1], 10) : -1);
  }
}

/** Set reality model appearance override for color in display style.
 * @beta
 */
export class SetRealityModelColorTool extends Tool {
  public static toolId = "SetRealityModelColorTool";
  public static get minArgs() { return 3; }
  public static get maxArgs() { return 4; }

  public run(rgb: RgbColorProps, index: number): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (vp === undefined)
      return false;

    const changed = changeRealityModelAppearanceOverrides(vp, { rgb }, index);

    if (changed)
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Reality Model at Index: ${index} set to color: ${rgb}`));

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run({ r: parseFloat(args[0]), g: parseFloat(args[1]), b: parseFloat(args[2]) }, args.length > 3 ? parseInt(args[3], 10) : -1);
  }
}

/** Clear reality model appearance override in display style.
 * @beta
 */
export class ClearRealityModelAppearanceOverrides extends Tool {
  public static toolId = "ClearRealityModelAppearanceOverrides";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  public run(index: number): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (vp)
      vp.dropRealityModelAppearanceOverride(index);

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run(args[0] === undefined ? -1 : parseInt(args[0], 10));
  }
}

/** Attach a cesium asset from the Ion ID and key.
 * @beta
 */
export class AttachCesiumAssetTool extends Tool {
  public static toolId = "AttachCesiumAssetTool";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 2; }

  public run(assetId: number, requestKey: string): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (vp === undefined)
      return false;
    const props = { tilesetUrl: getCesiumAssetUrl(assetId, requestKey) };
    vp.attachRealityModel(props);
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Cesium Asset #${assetId} attached`));
    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const assetId = parseInt(args[0], 10);
    return Number.isNaN(assetId) ? false : this.run(assetId, args[1]);
  }
}

/** Turn on/off display of OpenStreetMap buildings
 * @beta
 */
export class ToggleOSMBuildingDisplay extends Tool {
  public static toolId = "SetBuildingDisplay";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 2; }

  public run(onOff?: boolean, transparency?: number): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (vp === undefined)
      return false;

    if (onOff === undefined)
      onOff = vp.displayStyle.getOSMBuildingDisplayIndex() < 0;    // Toggle current state.

    const appearanceOverrides = (transparency !== undefined && transparency > 0 && transparency < 1) ? FeatureAppearance.fromJSON({ transparency }) : undefined;

    vp.setOSMBuildingDisplay({ onOff, appearanceOverrides });
    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const toggle = parseToggle(args[0]);
    const transparency = args.length > 0 ? parseFloat(args[1]) : undefined;
    return typeof toggle === "string" ? false : this.run(toggle, transparency);
  }
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

function applyMaskToRealityModel(index: number, onOff: boolean | undefined, mask: PlanarClipMask): boolean {
  const vp = IModelApp.viewManager.selectedView;
  if (vp === undefined)
    return false;

  return applyToRealityModel(vp, index, (indexOrId: Id64String | number) => {
    const currentMask = vp.getRealityModelPlanarClipMask(indexOrId);
    const maskOn = (onOff === undefined) ? currentMask === undefined || !currentMask.anyDefined : onOff;
    return maskOn ? vp.overrideRealityModelPlanarClipMask(indexOrId, mask) : vp.dropRealityModelPlanarClipMask(indexOrId);
  });
}
/** Control reality model masking.
 * @beta
 */
export class SetHigherPriorityRealityModelMasking extends Tool {
  public static toolId = "SetHigherPriorityRealityModelMasking";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 2; }

  public run(index: number, onOff?: boolean): boolean {
    return applyMaskToRealityModel(index, onOff, PlanarClipMask.create(PlanarClipMaskMode.HigherPriorityModels)!);
  }

  public parseAndRun(...args: string[]): boolean {
    const toggle = parseToggle(args[0]);
    const index = args[1] === undefined ? -1 : parseInt(args[1], 10)
    return this.run(index, typeof toggle === "string" ? undefined : toggle);
  }
}

/** Mask reality model by element
 * @beta
 */

export abstract class MaskRealityModelBaseTool extends PrimitiveTool {
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
    this.showPrompt();
  }
  protected abstract showPrompt(): void;
  protected abstract createToolInstance(): MaskRealityModelBaseTool;
  protected abstract applyMask(vp: ScreenViewport, targetModelId: Id64String | number): void;

  public onRestartTool(): void {
    const tool = this.createToolInstance();
    if (!tool.run())
      this.exitTool();
  }

  public async filterHit(hit: HitDetail, _out?: LocateResponse): Promise<LocateFilterStatus> {
    if (!hit.modelId)
      return LocateFilterStatus.Reject;

    const model = this.iModel.models.getLoaded(hit.modelId)?.asSpatialModel;
    if (!model)
      return LocateFilterStatus.Reject;

    if (undefined === this._targetModelId)
      return model.isRealityModel ? LocateFilterStatus.Accept : LocateFilterStatus.Reject;
    else
      return (hit.isElementHit && !hit.isModelHit && !this._acceptedElementIds.has(hit.sourceId)) ? LocateFilterStatus.Accept : LocateFilterStatus.Reject;
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === hit || undefined === vp)
      return EventHandled.No;

    if (undefined === this._targetModelId) {
      this._targetModelId = hit.modelId;
    } else if (hit.isElementHit) {
      const sourceId = hit.sourceId;
      if (!this._acceptedElementIds.has(sourceId)) {
        this._acceptedElementIds.add(sourceId);
        this._acceptedModelIds.add(hit.modelId!)
        if (hit.subCategoryId)
          this._acceptedSubCategoryIds.add(hit.subCategoryId);
        this.applyMask(vp, this._targetModelId);
      }
    }
    this.setupAndPromptForNextAction();
    return EventHandled.No;
  }
}

export class MaskRealityModelByElementTool extends MaskRealityModelBaseTool {
  public static toolId = "MaskRealityModelByElement";

  protected showPrompt(): void {
    const key = "FrontendDevTools:tools.MaskRealityModelByElement.Prompts." + (this._targetModelId === undefined ? "IdentifyRealityModel" : "IdentifyMaskElement");
    IModelApp.notifications.outputPromptByKey(key);
  }
  protected createToolInstance(): MaskRealityModelBaseTool { return new MaskRealityModelByElementTool(); }
  protected applyMask(vp: ScreenViewport, targetModel: Id64String | number): void {
    vp.overrideRealityModelPlanarClipMask(targetModel, PlanarClipMask.create(PlanarClipMaskMode.Elements, this._acceptedModelIds, this._acceptedElementIds)!);
  }
}

export class MaskRealityModelByModelTool extends MaskRealityModelBaseTool {
  public static toolId = "MaskRealityModelByModel";

  protected showPrompt(): void {
    const key = "FrontendDevTools:tools.MaskRealityModelByModel.Prompts." + (this._targetModelId === undefined ? "IdentifyRealityModel" : "IdentifyMaskModel");
    IModelApp.notifications.outputPromptByKey(key);
  }
  protected createToolInstance(): MaskRealityModelBaseTool { return new MaskRealityModelByElementTool(); }
  protected applyMask(vp: ScreenViewport, targetModel: Id64String | number): void {
    vp.overrideRealityModelPlanarClipMask(targetModel, PlanarClipMask.create(PlanarClipMaskMode.Models, this._acceptedModelIds)!);
  }
}

export class MaskRealityModelBySubCategoryTool extends MaskRealityModelBaseTool {
  public static toolId = "MaskRealityModelBySubCategory";

  protected showPrompt(): void {
    const key = "FrontendDevTools:tools.MaskRealityModelByModel.Prompts." + (this._targetModelId === undefined ? "IdentifyRealityModel" : "IdentifyMaskSubCategory");
    IModelApp.notifications.outputPromptByKey(key);
  }
  protected createToolInstance(): MaskRealityModelBaseTool { return new MaskRealityModelByElementTool(); }
  protected applyMask(vp: ScreenViewport, targetModel: Id64String | number): void {
    vp.overrideRealityModelPlanarClipMask(targetModel, PlanarClipMask.create(PlanarClipMaskMode.SubCategories, this._acceptedModelIds, this._acceptedSubCategoryIds)!);
  }
}

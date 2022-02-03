/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore Sharepoint

import type {
  BeButtonEvent, HitDetail} from "@itwin/core-frontend";
import { CoordinateLockOverrides, EventHandled, IModelApp,
  LocateFilterStatus, LocateResponse, PrimitiveTool,
  SelectionMethod, SelectionMode,
} from "@itwin/core-frontend";
import type { Point3d } from "@itwin/core-geometry";
import { UiFramework } from "@itwin/appui-react";
import { ToolbarItemUtilities } from "@itwin/appui-abstract";
import genericToolSvg from "./generic-tool.svg?sprite";
import { UiItemsProvidersTest } from "../ui-items-providers-test";

/** Sample Primitive tool where user selects an element for processing */
export class GenericLocateTool extends PrimitiveTool {
  public userPoint: Point3d | undefined;
  public elementId: string | undefined;
  public static override get toolId() { return "uiItemsProvidersTest-GenericLocateTool"; }
  public static get toolStringKey() { return `tools.${GenericLocateTool.toolId}.`; }
  public static override iconSpec = `svg:${genericToolSvg}`;
  public static useDefaultPosition = false;
  public override autoLockTarget(): void { } // NOTE: For selecting elements we only care about iModel, so don't lock target model automatically.
  protected wantSelectionClearOnMiss(_ev: BeButtonEvent): boolean { return SelectionMode.Replace === this.getSelectionMode(); }
  protected wantPickableDecorations(): boolean { return false; } // Allow pickable decorations selection to be independent of manipulators...
  protected getSelectionMethod(): SelectionMethod { return SelectionMethod.Pick; }
  protected getSelectionMode(): SelectionMode { return SelectionMode.Replace; }
  public override requireWriteableTarget() { return false; }
  public override async filterHit(_hit: HitDetail, _out?: LocateResponse) { return Promise.resolve(LocateFilterStatus.Accept); }

  public static getPrompt(name: string): string {
    const key = `tools.${this.toolId}.Prompts.${name}`;
    return UiItemsProvidersTest.translate(key);
  }

  public async process(_elementId: string, _point?: Point3d) {
    // Exit the tool
    return this.exitTool();
  }

  public override async onDataButtonUp(ev: BeButtonEvent): Promise<EventHandled> {
    const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
    if (this.elementId === undefined) {
      if (hit !== undefined) {
        this.elementId = hit.sourceId;
        // Process right away if user wants default position
        if (GenericLocateTool.useDefaultPosition)
          await this.process(hit.sourceId);
        else
          this.setupAndPromptForNextAction();
      }
    } else if (!GenericLocateTool.useDefaultPosition) {
      this.userPoint = ev.point;
      if (hit !== undefined)
        this.userPoint = hit.hitPoint;
      // Process with the defined point
      await this.process(this.elementId, this.userPoint);
    }

    return EventHandled.Yes;
  }

  public override async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    await this.onReinitialize();
    return EventHandled.No;
  }

  protected outputMarkupPrompt(msg: string) { IModelApp.notifications.outputPrompt(GenericLocateTool.getPrompt(msg)); }

  public setupAndPromptForNextAction() {
    if (!this.elementId) {
      this.outputMarkupPrompt("identifyElement");
    } else if (!GenericLocateTool.useDefaultPosition) {
      this.outputMarkupPrompt("identifyPosition");
      // Enable snapping for accurate positions
      IModelApp.accuSnap.enableSnap(true);
    }
  }

  public override async onPostInstall() {
    await super.onPostInstall();

    const iModelConnection = UiFramework.getIModelConnection();
    if (!iModelConnection)
      return;

    if (iModelConnection.selectionSet.size === 1) {
      // Process and exit tool
      iModelConnection.selectionSet.elements.forEach((elementId: string, _val: string, _set: Set<string>) => { this.process(elementId); }); // eslint-disable-line @typescript-eslint/no-floating-promises
      await IModelApp.toolAdmin.startDefaultTool();
    } else {
      // Empty all before starting tool
      iModelConnection.selectionSet.emptyAll();
      // Show prompt for identifying the element
      this.outputMarkupPrompt("identifyElement");

      IModelApp.toolAdmin.setCursor("arrow");
      IModelApp.toolAdmin.setLocateCircleOn(true);

      IModelApp.toolAdmin.toolState.coordLockOvr = CoordinateLockOverrides.All;
      IModelApp.locateManager.initToolLocate();
      IModelApp.locateManager.options.allowDecorations = true; // Always locate to display tool tip even if we reject for adding to selection set...

      // Locate elements
      IModelApp.accuSnap.enableLocate(true);
      IModelApp.accuSnap.enableSnap(false);
    }
  }

  public async onRestartTool() {
    return this.exitTool();
  }

  public static async startTool(): Promise<boolean> {
    return (new GenericLocateTool()).run();
  }

  public static getActionButtonDef(itemPriority: number, groupPriority?: number) {
    const overrides = undefined !== groupPriority ? { groupPriority } : {};
    return ToolbarItemUtilities.createActionButton(GenericLocateTool.toolId, itemPriority, GenericLocateTool.iconSpec, GenericLocateTool.flyover,
      async () => { await IModelApp.tools.run(GenericLocateTool.toolId, IModelApp.viewManager.selectedView, true); },
      overrides);
  }
}

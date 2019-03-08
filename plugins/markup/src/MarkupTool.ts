/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { XAndY } from "@bentley/geometry-core";
import { CoordinateLockOverrides, IModelApp, PrimitiveTool, Viewport, BeTouchEvent, EventHandled, BeButton } from "@bentley/imodeljs-frontend";
import { Element as MarkupElement, LinkedHTMLElement } from "@svgdotjs/svg.js";
import { markupApp, Markup } from "./Markup";

export abstract class MarkupTool extends PrimitiveTool {
  public markup!: Markup;
  public static toolKey = "MarkupTools:tools.";
  public requireWriteableTarget(): boolean { return false; }
  public isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean { return (super.isCompatibleViewport(vp, isSelectedViewChange) && undefined !== vp && vp === IModelApp.toolAdmin.markupView); }
  public onInstall(): boolean { if (undefined === markupApp.markup) return false; this.markup = markupApp.markup; return super.onInstall(); }
  public onPostInstall() { super.onPostInstall(); this.setupAndPromptForNextAction(); }
  public onUnsuspend(): void { this.showPrompt(); }
  public onRestartTool(): void { this.exitTool(); }

  protected showPrompt(): void { }
  protected setupAndPromptForNextAction(): void {
    IModelApp.toolAdmin.toolState.coordLockOvr = CoordinateLockOverrides.All; // Don't adjust point to ACS or grid...
    this.showPrompt();
  }
  protected outputMarkupPrompt(msg: string) { IModelApp.notifications.outputPromptByKey(MarkupTool.toolKey + msg); }

  public async onTouchMoveStart(ev: BeTouchEvent, startEv: BeTouchEvent): Promise<EventHandled> {
    if (startEv.isSingleTouch)
      await IModelApp.toolAdmin.convertTouchMoveStartToButtonDownAndMotion(startEv, ev);
    return EventHandled.Yes; // View tools are not allowed during redlining; use touch events to create markup and don't pass event to IdleTool...
  }

  public async onTouchMove(ev: BeTouchEvent): Promise<void> { return IModelApp.toolAdmin.convertTouchMoveToMotion(ev); }
  public async onTouchComplete(ev: BeTouchEvent): Promise<void> { return IModelApp.toolAdmin.convertTouchEndToButtonUp(ev); }
  public async onTouchCancel(ev: BeTouchEvent): Promise<void> { return IModelApp.toolAdmin.convertTouchEndToButtonUp(ev, BeButton.Reset); }

  public async undoPreviousStep(): Promise<boolean> {
    if (await this.onUndoPreviousStep())
      return true;
    this.markup.undo.doUndo();
    return true;
  }

  public async redoPreviousStep(): Promise<boolean> {
    if (await this.onRedoPreviousStep())
      return true;
    this.markup.undo.doRedo();
    return true;
  }

  /** Find the topmost MarkupElement at the specified point in the markup view.
   * @param pt the point in view coordinates
   * @returns The topmost element, or undefined if no elements under pt.
   */
  public pickElement(pt: XAndY): MarkupElement | undefined {
    const markup = this.markup;
    const rect = markup.vp.getClientRect();
    const node = document.elementFromPoint(pt.x + rect.left, pt.y + rect.top) as LinkedHTMLElement | null;
    if (!node || !node.instance)
      return undefined;
    const el = node.instance;
    return el.getChildOrGroupOf(markup.svgMarkup!);
  }
}

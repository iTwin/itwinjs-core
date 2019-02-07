/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { BeButtonEvent, EventHandled } from "@bentley/imodeljs-frontend";
import { Markup, MarkupElement } from "./Markup";
import { MarkupTool } from "./MarkupTool";

export class SelectTool extends MarkupTool {
  public static toolId = "Markup.Select";
  private _flashedElement?: MarkupElement;
  public get flashedElement(): MarkupElement | undefined { return this._flashedElement; }
  public set flashedElement(el: MarkupElement | undefined) {
    if (undefined !== this._flashedElement) Markup.unFlash(this._flashedElement);
    if (undefined !== el) Markup.flash(el);
    this._flashedElement = el;
  }

  constructor(markup: Markup) {
    super(markup);
    markup.enablePick();
  }
  public onMouseEnter(_ev: MouseEvent, el: MarkupElement) { this.flashedElement = el; }
  public onMouseLeave(_ev: MouseEvent, _el: MarkupElement) { this.flashedElement = undefined; }
  public onRestartTool(): void { this.markup.selected.emptyAll(); }

  public async onDataButtonUp(ev: BeButtonEvent): Promise<EventHandled> {
    const el = this.flashedElement;
    const selected = this.markup.selected;
    if (ev.isControlKey) {
      if (el && selected.drop(el))
        return EventHandled.Yes;
    } else {
      selected.emptyAll();
    }

    if (el !== undefined)
      selected.add(el);
    return EventHandled.Yes;
  }

  public async onKeyTransition(wentDown: boolean, key: KeyboardEvent): Promise<EventHandled> {
    if (!wentDown)
      return EventHandled.No;

    switch (key.key) {
      case "Delete":
      case "Backspace":
        this.markup.deleteSelected();
        return EventHandled.Yes;
      case "f":
        this.markup.bringToFront();
        return EventHandled.Yes;
      case "b":
        this.markup.sendToBack();
        return EventHandled.Yes;
    }
    return EventHandled.No;
  }
}

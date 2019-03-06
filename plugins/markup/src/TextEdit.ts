/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { BeButtonEvent, EventHandled, IModelApp } from "@bentley/imodeljs-frontend";
import { Svg, Text as SvgText } from "@svgdotjs/svg.js";
import { MarkupProps } from "./MarkupConfig";
import { MarkupTool } from "./MarkupTool";
import { RedlineTool } from "./RedlineTool";

export class PlaceTextTool extends RedlineTool {
  public static toolId = "Markup.Text.Place";
  protected _nRequiredPoints = 1;
  protected _minPoints = 0;
  protected _value!: string;

  public onPostInstall(): void {
    this._value = IModelApp.i18n.translate(MarkupTool.toolKey + "Text.Place.startValue");
    super.onPostInstall();
  }

  protected showPrompt(): void { this.outputMarkupPrompt("Text.Place.Prompts.FirstPoint"); }

  protected createMarkup(svg: Svg, ev: BeButtonEvent, isDynamics: boolean): void {
    const start = ev.viewPoint;
    const text = svg.plain(this._value);
    this.setCurrentTextStyle(text);
    text.move(start.x, start.y);
    const box = text.bbox();
    if (isDynamics)
      svg.rect(box.w, box.h).move(box.x, box.y).attr(MarkupProps.text.edit.box);
    else {
      this.onAdded(text, false);
      new EditTextTool(text, true).run();
    }
  }
  public onRestartTool(): void { }
  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> { this.exitTool(); return EventHandled.Yes; }

}

const lastSize = { width: "180px", height: "60px" };
export class EditTextTool extends MarkupTool {
  public static toolId = "Markup.Text.Edit";
  public editor?: HTMLTextAreaElement;
  constructor(public text?: SvgText, private _selectAll = false) { super(); }

  public startEditor() {
    const text = this.text;
    if (text === undefined)
      return;

    const markupDiv = this.markup.markupDiv!;
    const divRect = markupDiv.getBoundingClientRect();

    const rbox = text.rbox();
    const bbox = text.bbox();
    const editor = this.editor = document.createElement("textarea");
    editor.className = "markup-textedit";
    editor.contentEditable = "true";
    editor.spellcheck = true;
    editor.wrap = "off";
    const mouselistener = (ev: Event) => {
      ev.stopPropagation();
      return true;
    };

    (editor as any).onselectstart = mouselistener;
    editor.oncontextmenu = editor.onmousedown = editor.onmouseup = mouselistener;
    editor.onkeydown = (ev: KeyboardEvent) => {
      switch (ev.key) {
        case "Tab":
        case "Escape":
          this.exitTool();
          ev.stopPropagation();
          break;
      }
      if (ev.key === "Enter" && (ev.shiftKey || ev.ctrlKey)) {
        this.exitTool();
        ev.stopPropagation();
      }

    };
    const textElStyle = window.getComputedStyle(text.node);

    const style = editor.style;
    style.pointerEvents = "auto";
    style.position = "absolute";
    style.top = ((rbox.cy - (bbox.h / 2)) - divRect.top) + "px";
    style.left = ((rbox.cx - (bbox.w / 2)) - divRect.left) + "px";
    style.height = lastSize.height;
    style.width = lastSize.width;
    style.resize = "both";
    style.backgroundColor = "blanchedalmond";
    style.fontFamily = textElStyle.fontFamily;
    style.fontSize = "14pt";
    style.textAnchor = textElStyle.textAnchor;

    const parentZ = parseInt(window.getComputedStyle(markupDiv).zIndex || "0", 10);
    style.zIndex = (parentZ + 200).toString();

    markupDiv.appendChild(editor);
    editor.innerHTML = text.getMarkup();
    this.editor.focus();
    this.editor.setSelectionRange(this._selectAll ? 0 : editor.value.length, editor.value.length);
  }

  public onCleanup() {
    if (this.editor) {
      const text = this.text!;
      const undo = this.markup.undo;
      undo.doGroup(() => {
        const newText = text.clone();
        const fontSize = parseFloat(window.getComputedStyle(text.node).fontSize!);
        newText.createMarkup(this.editor!.value, fontSize);
        text.replace(newText);
        undo.onModified(newText, text);
      });
      lastSize.height = this.editor.style.height!;
      lastSize.width = this.editor.style.width!;
      this.editor.remove();
      this.editor = undefined;
    }
  }

  public onInstall() {
    if (!super.onInstall())
      return false;
    this.startEditor();
    return true;
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    this.exitTool(); return EventHandled.Yes;
  }
  public async onDataButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    this.exitTool(); return EventHandled.Yes;
  }
  public async onMouseStartDrag(_ev: BeButtonEvent): Promise<EventHandled> {
    this.exitTool(); return EventHandled.Yes;
  }
}

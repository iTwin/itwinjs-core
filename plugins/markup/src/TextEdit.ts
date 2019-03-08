/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { BeButtonEvent, EventHandled } from "@bentley/imodeljs-frontend";
import { Svg, Text as MarkupText } from "@svgdotjs/svg.js";
import { MarkupTool } from "./MarkupTool";
import { RedlineTool } from "./RedlineTool";
import { markupApp } from "./Markup";

/** Tool to place new text notes on a Markup. */
export class PlaceTextTool extends RedlineTool {
  public static toolId = "Markup.Text.Place";
  protected _nRequiredPoints = 1;
  protected _minPoints = 0;
  protected _value!: string;

  public onPostInstall(): void {
    this._value = markupApp.props.text.startValue;
    super.onPostInstall();
  }

  protected showPrompt(): void { this.outputMarkupPrompt("Text.Place.Prompts.FirstPoint"); }

  protected createMarkup(svg: Svg, ev: BeButtonEvent, isDynamics: boolean): void {
    const start = ev.viewPoint;
    const text = new MarkupText().plain(this._value);
    svg.put(text);
    this.setCurrentTextStyle(text);
    text.translate(start.x, start.y);
    if (isDynamics) {
      svg.add(text.getOutline().attr(markupApp.props.text.edit.box).addClass("markup-editBox"));
    } else {
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
  public editDiv?: HTMLDivElement;
  constructor(public text?: MarkupText, private _fromPlaceTool = false) { super(); }

  public startEditor() {
    const text = this.text;
    if (text === undefined)
      return;

    const markupDiv = this.markup.markupDiv!;
    const editDiv = this.editDiv = document.createElement("div");
    let style = editDiv.style;
    style.backgroundColor = "blanchedalmond";
    style.top = style.left = "0";
    style.right = style.bottom = "100%";

    markupDiv.appendChild(editDiv);

    const divRect = markupDiv.getBoundingClientRect();

    const outline = text.getOutline(); // use the outline rather than the text in case it's blank.
    text.after(outline); // we have to add it to the DOM or the rbox call doesn't work.
    const rbox = outline.rbox();
    const bbox = outline.bbox();
    outline.remove(); // take it out again.
    const editor = this.editor = document.createElement("textarea");
    editDiv.appendChild(editor);
    editor.className = "markup-textEditor";
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

    style = editor.style;
    style.pointerEvents = "auto";
    style.position = "absolute";
    style.top = ((rbox.cy - (bbox.h / 2)) - divRect.top) + "px";
    style.left = ((rbox.cx - (bbox.w / 2)) - divRect.left) + "px";
    style.height = lastSize.height;
    style.width = lastSize.width;
    style.resize = "both";
    style.fontFamily = textElStyle.fontFamily;
    style.fontSize = "14pt";
    style.textAnchor = textElStyle.textAnchor;

    const parentZ = parseInt(window.getComputedStyle(markupDiv).zIndex || "0", 10);
    style.zIndex = (parentZ + 200).toString();

    editor.innerHTML = text.getMarkup();
    this.editor.focus();
    this.editor.setSelectionRange(this._fromPlaceTool ? 0 : editor.value.length, editor.value.length);
  }

  public onCleanup() {
    if (this.editDiv) {
      const text = this.text!;
      const undo = this.markup.undo;
      undo.doGroup(() => {
        const newVal = this.editor!.value;
        if (newVal.trim() === "") {
          text.remove();
          if (!this._fromPlaceTool)
            undo.onDelete(text);
          return;
        }

        const newText = text.clone();
        const fontSize = parseFloat(window.getComputedStyle(text.node).fontSize!);
        newText.createMarkup(newVal, fontSize);
        text.replace(newText);
        if (this._fromPlaceTool) {
          undo.onAdded(newText);
        } else {
          undo.onModified(newText, text);
        }
      });
      lastSize.height = this.editor!.style.height!;
      lastSize.width = this.editor!.style.width!;
      this.editDiv.remove();
      this.editDiv = undefined;
      this.editor = undefined;
    }
  }

  public onInstall() {
    if (!super.onInstall())
      return false;
    this.startEditor();
    return true;
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> { this.exitTool(); return EventHandled.Yes; }
  public async onDataButtonUp(_ev: BeButtonEvent): Promise<EventHandled> { this.exitTool(); return EventHandled.Yes; }
  public async onMouseStartDrag(_ev: BeButtonEvent): Promise<EventHandled> { this.exitTool(); return EventHandled.Yes; }
}

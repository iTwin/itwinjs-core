/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelApp, Plugin, PluginAdmin, ScreenViewport } from "@bentley/imodeljs-frontend";
import * as SVG from "svg.js";
import { MarkupTool } from "./MarkupTool";
import { SelectTool } from "./SelectTool";
import { UndoManager } from "./Undo";

/** An SVG.Element with additional properties added for the Markup system. */
export type MarkupElement = SVG.Element & {
  _inSelection?: boolean;
  _oldColor?: { fill: any; stroke: any; };
};

// temporary, for testing.
function getSvgFile(uri: string) {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", uri, false);
  xhr.send();
  return xhr.responseText;
}

class MarkupApp extends Plugin {
  public markup?: Markup;

  public async onExecute(_args: string[]) {
    if (this.markup) {
      IModelApp.toolAdmin.markupView = undefined;
      this.markup.destroy();
      this.markup = undefined;
      return;
    }

    const view = IModelApp.toolAdmin.markupView = IModelApp.viewManager.selectedView;
    if (view)
      this.markup = new Markup(view, getSvgFile("DemoMarkup.svg"));
  }
}

/**
 * The set of currently selected SVG elements. When elements are added to the set, they are hilited.
 */
export class SelectionSet {
  public readonly elements = new Set<MarkupElement>();
  public get size() { return this.elements.size; }
  public get isActive() { return this.size !== 0; }
  public has(el: MarkupElement) { return this.elements.has(el); }
  public emptyAll(): void {
    this.elements.forEach((el) => Markup.unHilite(el));
    this.elements.clear();
  }
  public add(el: MarkupElement) {
    this.elements.add(el);
    Markup.hilite(el);
  }
  public drop(el: MarkupElement): boolean {
    if (!this.elements.delete(el))
      return false;
    Markup.unHilite(el);
    return true;
  }
  public deleteAll(undo: UndoManager) {
    undo.doGroup(() => this.elements.forEach((el) => { undo.onDelete(el); el.remove(); }));
    this.emptyAll();
  }
  public reposition(undo: UndoManager, fn: (el: MarkupElement) => void) {
    undo.doGroup(() => this.elements.forEach((el) => {
      const oldParent = el.parent() as MarkupElement;
      const oldPos = el.position();
      fn(el);
      undo.onRepositioned(el, oldPos, oldParent);
    }));
  }
}

/**
 * The current markup being created/edited. Holds the SVG elements, plus the active MarkupTool.
 * When starting a Markup, a new Div is added as a child of the ScreenViewport's parentDiv.
 */
export class Markup {
  public static hiliteColor = "magenta";
  public static flashColor = "cyan";
  public readonly markupDiv: HTMLDivElement;
  public readonly undo = new UndoManager();
  public readonly selected = new SelectionSet();
  public tool!: MarkupTool;
  public readonly svgMarkup?: SVG.Nested;
  public readonly svgDecorations?: SVG.Nested;

  /** Called when the Markup is destroyed */
  public destroy() { this.markupDiv.parentNode!.removeChild(this.markupDiv); }
  public enablePick() { this.markupDiv.style.pointerEvents = "auto"; }
  public disablePick() { this.markupDiv.style.pointerEvents = "none"; }

  private static overrideColor(el: MarkupElement, color: string) {
    if (undefined === el._oldColor)
      el._oldColor = { fill: el.style("fill"), stroke: el.style("stroke") };
    const toColor = (val: string) => (val === "none") ? "none" : color;
    el.style({ fill: toColor(el._oldColor.fill), stroke: toColor(el._oldColor.stroke) });
  }
  public static resetColor(el: MarkupElement) { if (undefined !== el._oldColor) { el.style(el._oldColor); el._oldColor = undefined; } }
  public static hilite(el: MarkupElement) { if (undefined === el._inSelection) { this.overrideColor(el, Markup.hiliteColor); el._inSelection = true; } }
  public static unHilite(el: MarkupElement) { if (undefined !== el._inSelection) { this.resetColor(el); el._inSelection = undefined; } }
  public static flash(el: MarkupElement) { if (undefined === el._inSelection) this.overrideColor(el, Markup.flashColor); }
  public static unFlash(el: MarkupElement) { if (undefined === el._inSelection) this.resetColor(el); }

  /** Delete all the entries in the selection set, then empty it. */
  public deleteSelected() { this.selected.deleteAll(this.undo); }
  /** Bring all the entries in the selection set to the front. */
  public bringToFront() { this.selected.reposition(this.undo, (el) => el.front()); }
  /** Send all the entries in the selection set to the back. */
  public sendToBack() { this.selected.reposition(this.undo, (el) => el.back()); }

  public makePickable(el: MarkupElement) {
    if (el instanceof SVG.Shape) {
      el.attr("cursor", "move");
      el.on("mouseenter", (ev: MouseEvent) => this.tool.onMouseEnter(ev, el));
      el.on("mouseleave", (ev: MouseEvent) => this.tool.onMouseLeave(ev, el));
    }
  }

  public constructor(vp: ScreenViewport, svgData: string) {
    this.markupDiv = vp.addNewDiv("overlay-markup", true, 20); // this div goes on top of the canvas, but behind UI layers
    const svgContainer = SVG(this.markupDiv).attr("id", "markup-container"); // SVG container to hold both Markup SVG and svg-based Markup decorators
    this.svgMarkup = svgContainer.nested().svg(svgData).attr("id", "markup-svg").each((i, children) => this.makePickable(children[i]), true); // The actual SVG for the markup
    this.svgDecorations = svgContainer.nested().attr("id", "markup-decorations"); // only for temporary decorations of SVG graphics.

    new SelectTool(this).run();
  }
}

declare var IMODELJS_VERSIONS_REQUIRED: string;
declare var PLUGIN_NAME: string;
export const markupApp = new MarkupApp(PLUGIN_NAME, IMODELJS_VERSIONS_REQUIRED);
PluginAdmin.register(markupApp);

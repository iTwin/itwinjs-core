/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelApp, Plugin, PluginAdmin, ScreenViewport } from "@bentley/imodeljs-frontend";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { Svg, SVG } from "@svgdotjs/svg.js";
import * as redlineTool from "./RedlineTool";
import * as textTool from "./TextEdit";
import { SelectionSet, SelectTool } from "./SelectTool";
import { svgInit } from "./SvgJsExt";
import { UndoManager } from "./Undo";

// temporary, for testing.
// function getSvgFile(uri: string) {
//   const xhr = new XMLHttpRequest();
//   xhr.open("GET", uri, false);
//   xhr.send();
//   return xhr.responseText;
// }

export class MarkupApp extends Plugin {
  public markup?: Markup;
  public markupNamespace: I18NNamespace;
  public props = {
    handles: {
      size: 12,
      stretch: { "fill-opacity": .85, "stroke": "black", "fill": "white" },
      rotateLine: { "stroke": "grey", "fill-opacity": .85 },
      rotate: { "cursor": "url(Markup/rotate.png) 12 12, auto", "fill-opacity": .85, "stroke": "black", "fill": "lightBlue" },
      moveOutline: { "cursor": "move", "stroke-dasharray": "6,6", "fill": "none", "stroke-opacity": .85, "stroke": "white" },
      move: { "cursor": "move", "opacity": 0, "stroke-width": 6, "stroke": "white" },
      vertex: { "cursor": "url(cursors/crosshair.cur), crosshair", "fill-opacity": .85, "stroke": "black", "fill": "white" },
    },
    hilite: {
      color: "magenta",
      flash: "cyan",
    },
    active: {
      text: {
        "font-family": "sans-serif",
        "font-size": "30px",
        "stroke": "red",
        "fill": "red",
      },
      element: {
        "stroke": "red",
        "stroke-opacity": 0.8,
        "stroke-width": 3,
        "fill-opacity": 0.2,
        "fill": "blue",
      },
    },
    text: {
      startValue: "Note: ",
      edit: {
        box: { "fill": "lightGrey", "fill-opacity": .1, "stroke-opacity": .85, "stroke": "lightBlue" },
      },
    },
  };
  private _saveDefaultToolId = "";
  private _saveDefaultToolArgs?: any[];

  /** called when the plugin is executed by its host */
  public async onExecute(_args: string[]) {
    if (this.markup) {
      if (IModelApp.toolAdmin.defaultToolId === "Markup.Select" && (undefined === IModelApp.toolAdmin.activeTool || "Markup.Select" !== IModelApp.toolAdmin.activeTool.toolId)) {
        IModelApp.toolAdmin.startDefaultTool();
        return;
      }

      IModelApp.toolAdmin.markupView = undefined;
      this.markup.destroy();
      this.markup = undefined;

      IModelApp.toolAdmin.defaultToolId = this._saveDefaultToolId;
      IModelApp.toolAdmin.defaultToolArgs = this._saveDefaultToolArgs;
      this._saveDefaultToolId = "";
      this._saveDefaultToolArgs = undefined;
      IModelApp.toolAdmin.startDefaultTool();
      return;
    }

    await this.markupNamespace.readFinished; // make sure our localized messages are ready.
    const view = IModelApp.toolAdmin.markupView = IModelApp.viewManager.selectedView;
    if (view) {
      this.markup = new Markup(view);

      this._saveDefaultToolId = IModelApp.toolAdmin.defaultToolId;
      this._saveDefaultToolArgs = IModelApp.toolAdmin.defaultToolArgs;
      IModelApp.toolAdmin.defaultToolId = "Markup.Select";
      IModelApp.toolAdmin.defaultToolArgs = undefined;
      IModelApp.toolAdmin.startDefaultTool();
    }
  }

  public constructor(name: string, versions: string) {
    super(name, versions);
    this.markupNamespace = IModelApp.i18n.registerNamespace("MarkupTools");
    IModelApp.tools.register(SelectTool, this.markupNamespace);
    IModelApp.tools.registerModule(redlineTool, this.markupNamespace);
    IModelApp.tools.registerModule(textTool, this.markupNamespace);
  }
}

/**
 * The current markup being created/edited. Holds the SVG elements, plus the active MarkupTool.
 * When starting a Markup, a new Div is added  aa child of the ScreenViewport's parentDiv.
 */
export class Markup {
  public readonly markupDiv: HTMLDivElement;
  public readonly undo = new UndoManager();
  public readonly selected: SelectionSet;
  public readonly svgMarkup?: Svg;
  public readonly svgDynamics?: Svg;
  public readonly svgDecorations?: Svg;

  public constructor(public vp: ScreenViewport, svgData?: string) {
    this.markupDiv = vp.addNewDiv("overlay-markup", true, 20); // this div goes on top of the canvas, but behind UI layers
    const svgContainer = SVG().addTo(SVG(this.markupDiv)).id("markup-container").size("100%", "100%"); // SVG container to hold both Markup SVG and svg-based Markup decorators
    this.svgMarkup = svgContainer.nested().id("markup-svg");
    if (svgData) {
      this.svgMarkup.svg(svgData); // if supplied, add the SVG
      this.svgMarkup.each(() => { }, true); // create an SVG.Element for each entry in the SVG file.
    }
    this.svgDynamics = svgContainer.nested().id("markup-dynamics"); // only for tool dynamics of SVG graphics.
    this.svgDecorations = svgContainer.nested().id("markup-decorations"); // only for temporary decorations of SVG graphics.
    this.selected = new SelectionSet(this.svgDecorations);
  }

  /** Called when the Markup is destroyed */
  public destroy() { this.markupDiv.parentNode!.removeChild(this.markupDiv); }
  public enablePick() { this.markupDiv.style.pointerEvents = "auto"; }
  public disablePick() { this.markupDiv.style.pointerEvents = "none"; }
  public setCursor(cursor: string) { this.markupDiv.style.cursor = cursor; }

  /** Delete all the entries in the selection set, then empty it. */
  public deleteSelected() { this.selected.deleteAll(this.undo); }
  /** Bring all the entries in the selection set to the front. */
  public bringToFront() { this.selected.reposition(this.undo, (el) => el.front()); }
  /** Send all the entries in the selection set to the back. */
  public sendToBack() { this.selected.reposition(this.undo, (el) => el.back()); }
  /** Group all the entries in the selection set, then select the group. */
  public groupSelected() { if (undefined !== this.svgMarkup) this.selected.groupAll(this.undo); }
  /** Ungroup all the group entries in the selection set. */
  public ungroupSelected() { if (undefined !== this.svgMarkup) this.selected.ungroupAll(this.undo); }
}

svgInit(); // to ensure we load the SvgJsExt extensions

declare var IMODELJS_VERSIONS_REQUIRED: string;
declare var PLUGIN_NAME: string;
export const markupApp = new MarkupApp(PLUGIN_NAME, IMODELJS_VERSIONS_REQUIRED);
PluginAdmin.register(markupApp);

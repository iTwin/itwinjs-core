/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ImageSource, ImageSourceFormat } from "@bentley/imodeljs-common";
import { imageElementFromImageSource, IModelApp, ScreenViewport } from "@bentley/imodeljs-frontend";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { adopt, create, Svg, SVG } from "@svgdotjs/svg.js";
import { SelectionSet, SelectTool } from "./SelectTool";
import { UndoManager } from "./Undo";
import * as redlineTool from "./RedlineTool";
import * as textTool from "./TextEdit";

/** Markup data returned by [MarkupApp.stop] */
export interface MarkupData {
  /** The size of the image, in pixels. This also indicates the aspect ratio of the SVG data. */
  rect: { width: number; height: number; };
  /** a string holding the svg data for the markup. Will be undefined if [MarkupApp.stop] is called without an active Markup */
  svg?: string;
  /** a base64 encoded string with the image of the view that was marked up. See [MarkupApp.props.result] for options. */
  image?: string;
}
/**
 * The main object for the Markup module. It has only static members and methods.
 * Applications may customize and control the behavior of the Markup by setting members of [MarkupApp.props].
 * When [MarkupApp.start] is first called, it registers a set of "Markup.xx" tools that may be invoked from UI controls.
 */
export class MarkupApp {
  /** the current Markup being created */
  public static markup?: Markup;
  /** The namespace for the Markup tools */
  public static markupNamespace: I18NNamespace;
  /** By setting members of this object, applications can control the appearance and behavior of various parts of MarkupApp. */
  public static props = {
    /** the UI controls displayed on Elements by the Select Tool to allow users to modify them. */
    handles: {
      /** the radius  */
      size: 10,
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
    dropShadow: {
      enable: true,
      attr: {
        "stdDeviation": 2,
        "dx": 0.8,
        "dy": 1,
        "flood-color": "#1B3838",
      },
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
        "stroke-linecap": "round",
      },
    },
    /** Values for placing and editing Text. */
    text: {
      /** A default string for the Markup.Text.Place command. Applications can turn this off, or supply the user's initials, for example. */
      startValue: "Note: ",
      /** Parameters for the size and appearance of the text editor */
      edit: {
        /** Starting size, will be updated if user stretches the box */
        size: { width: "180px", height: "60px" },
        /** font size of the text editor */
        fontSize: "14pt",
        /** A background box drawn around text so user can tell what's being selected */
        textBox: { "fill": "lightGrey", "fill-opacity": .1, "stroke-opacity": .85, "stroke": "lightBlue" },
      },
    },
    /** Used to draw a border around the view while it is being marked up so the user can tell Markup is active */
    border: {
      "stroke": "yellow",
      "stroke-width": 7,
      "rx": 7,
      "ry": 7,
      "stroke-opacity": 0.4,
      "fill": "none",
    },
    /** Determines what is returned by MarkupApp.stop */
    result: {
      /** The format for the image data. */
      imageFormat: "image/png",
      /** If true, the markup graphics will be imprinted in the returned image. */
      imprintSvgOnImage: true,
      /** the maximum width for the returned image. If the source view width is larger than this, it will be scaled down to this size. */
      maxWidth: 2048,
    },
  };
  private static _saveDefaultToolId = "";

  /** determine whether there's a markup session currently active */
  public static get isActive() { return undefined !== this.markup; }

  /** Start a markup session */
  public static async start(view: ScreenViewport, svgData?: string) {
    await this.init();

    IModelApp.toolAdmin.markupView = view;
    if (view) {
      // first, lock the viewport to its current size while the markup session is running
      const parentDiv = view.vpDiv;
      const rect = parentDiv.getBoundingClientRect();
      const style = parentDiv.style;
      style.width = rect.width + "px";
      style.height = rect.height + "px";

      this.markup = new Markup(view, svgData); // start a markup against the selected view.

      // set the markup Select tool as the default tool and start it, saving current default tool
      this._saveDefaultToolId = IModelApp.toolAdmin.defaultToolId;
      IModelApp.toolAdmin.defaultToolId = "Markup.Select";
      IModelApp.toolAdmin.startDefaultTool();
    }
  }

  /** Read the result of a Markup session. and stop it.
   * @note see [MarkupApp.props.result] for options.
   */
  public static async stop(): Promise<MarkupData> {
    const data = await this.readMarkup();
    if (!this.markup)
      return data;

    if (IModelApp.toolAdmin.defaultToolId === "Markup.Select" && (undefined === IModelApp.toolAdmin.activeTool || "Markup.Select" !== IModelApp.toolAdmin.activeTool.toolId)) {
      IModelApp.toolAdmin.startDefaultTool();
      return data;
    }
    // restore original size for vp.
    ScreenViewport.setToParentSize(this.markup.vp.vpDiv);

    // restore vp to match its parent size.
    ScreenViewport.setToParentSize(this.markup.vp.vpDiv);

    IModelApp.toolAdmin.markupView = undefined; // so we don't continue to stop viewing tools
    this.markup.destroy();
    this.markup = undefined;
    // now restore the default tool and start it
    IModelApp.toolAdmin.defaultToolId = this._saveDefaultToolId;
    this._saveDefaultToolId = "";
    IModelApp.toolAdmin.startDefaultTool();
    return data;
  }

  protected static async init() {
    if (this.markupNamespace)
      return;
    this.markupNamespace = IModelApp.i18n.registerNamespace("MarkupTools");
    IModelApp.tools.register(SelectTool, this.markupNamespace);
    IModelApp.tools.registerModule(redlineTool, this.markupNamespace);
    IModelApp.tools.registerModule(textTool, this.markupNamespace);
    return this.markupNamespace.readFinished; // make sure our localized messages are ready.
  }

  /** convert the current markup SVG into a string, but don't include decorations or dynamics */
  protected static readMarkupSvg() {
    const markup = this.markup;
    if (!markup || !markup.svgContainer)
      return undefined;
    markup.svgDecorations!.remove(); // we don't want the decorations or dynamics to be included
    markup.svgDynamics!.remove();
    IModelApp.toolAdmin.startDefaultTool();
    const svgData = markup.svgContainer.svg(); // string-ize the SVG data
    markup.svgContainer!.add(markup.svgDecorations!); // put them back in case the session isn't over
    markup.svgContainer!.add(markup.svgDynamics!);
    return svgData;
  }

  protected static async readMarkup(): Promise<MarkupData> {
    const result = this.props.result;
    let canvas = this.markup!.vp.canvas;
    const svg = this.readMarkupSvg(); // read the current svg data for the markup
    if (svg && result.imprintSvgOnImage) {
      const svgImage = await imageElementFromImageSource(new ImageSource(svg, ImageSourceFormat.Svg));
      canvas.getContext("2d")!.drawImage(svgImage, 0, 0); // draw markup onto view's canvas2d
    }
    // is the source view too wide?
    if (canvas.width > result.maxWidth) {
      // yes, we have to scale it down, create a new canvas and set its size
      const newCanvas = document.createElement("canvas");
      newCanvas.width = result.maxWidth;
      newCanvas.height = canvas.height * (result.maxWidth / canvas.width);
      newCanvas.getContext("2d")!.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, newCanvas.width, newCanvas.height);
      canvas = newCanvas; // return the image from this canvas, not view canvas.
    }

    return { rect: { width: canvas.width, height: canvas.height }, svg, image: !result.imageFormat ? undefined : canvas.toDataURL(result.imageFormat) };
  }
}

const dropShadowId = "markup-dropShadow";
/**
 * The current markup being created/edited. Holds the SVG elements, plus the active MarkupTool.
 * When starting a Markup, a new Div is added as a child of the ScreenViewport's vpDiv.
 */
export class Markup {
  public readonly markupDiv: HTMLDivElement;
  public readonly undo = new UndoManager();
  public readonly selected: SelectionSet;
  public readonly svgContainer?: Svg;
  public readonly svgMarkup?: Svg;
  public readonly svgDynamics?: Svg;
  public readonly svgDecorations?: Svg;

  private createDropShadow(svg: Svg) {
    let filter = SVG("#" + dropShadowId);
    if (filter)
      filter.remove();
    filter = adopt(create("filter")).id(dropShadowId);
    const effect = adopt(create("feDropShadow"));
    effect.attr(MarkupApp.props.dropShadow.attr);
    filter.add(effect);
    svg.defs().add(filter);
    return filter;
  }
  private removeSvgNamespace(svg: Svg) { svg.node.removeAttribute("xmlns:svgjs"); return svg; }
  private addSvg(className: string) {
    const svg = SVG().addTo(this.markupDiv).addClass(className);
    const rect = this.markupDiv.getBoundingClientRect();
    this.removeSvgNamespace(svg);
    svg.viewbox(0, 0, rect.width, rect.height);
    return svg;
  }
  private addNested(className: string): Svg { return this.removeSvgNamespace(this.svgContainer!.nested().addClass(className)); }
  public constructor(public vp: ScreenViewport, svgData?: string) {
    this.markupDiv = vp.addNewDiv("overlay-markup", true, 20); // this div goes on top of the canvas, but behind UI layers
    this.svgContainer = this.addSvg("markup-container");  // container to hold both Markup SVG and svg-based Markup decorators
    this.svgMarkup = this.addNested("markup-svg");
    if (MarkupApp.props.dropShadow.enable) {
      this.createDropShadow(this.svgContainer);
      this.svgMarkup.attr("filter", "url(#" + dropShadowId + ")");
    }

    if (svgData) {
      this.svgMarkup.svg(svgData); // if supplied, add the SVG
      this.svgMarkup.each(() => { }, true); // create an SVG.Element for each entry in the SVG file.
    }
    this.svgDynamics = this.addNested("markup-dynamics"); // only for tool dynamics of SVG graphics.
    this.svgDecorations = this.addNested("markup-decorations"); // only for temporary decorations of SVG graphics.

    const rect = this.markupDiv.getBoundingClientRect();
    const inset = MarkupApp.props.border["stroke-width"];
    this.svgDecorations.rect(rect.width - inset, rect.height - inset).move(inset / 2, inset / 2).attr(MarkupApp.props.border);
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

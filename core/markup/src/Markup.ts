/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ImageSource, ImageSourceFormat } from "@bentley/imodeljs-common";
import { imageElementFromImageSource, IModelApp, ScreenViewport } from "@bentley/imodeljs-frontend";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { adopt, create, Svg, SVG, G, Matrix, Point } from "@svgdotjs/svg.js";
import { SelectionSet, SelectTool } from "./SelectTool";
import { UndoManager } from "./Undo";
import * as redlineTool from "./RedlineTool";
import * as textTool from "./TextEdit";
import { Point3d, XAndY } from "@bentley/geometry-core";

export interface WidthAndHeight {
  width: number;
  height: number;
}

export interface MarkupSvgData {
  /** The size of the image, in pixels. This also indicates the aspect ratio of the SVG data. */
  rect: WidthAndHeight;
  /** a string holding the svg data for the markup. Will be undefined if [MarkupApp.stop] is called without an active Markup */
  svg?: string;
}

/** Markup data returned by [MarkupApp.stop] */
export interface MarkupData extends MarkupSvgData {
  /** a base64 encoded string with the image of the view that was marked up. See [MarkupApp.props.result] for options. */
  image?: string;
}

/**
 * The main object for the Markup package. It is a singleton that stores the "state" of the Markup application.
 * It has only static members and methods. Applications may customize and control the behavior of the Markup by
 * setting members of [MarkupApp.props]. When [MarkupApp.start] is first called, it registers a set of "Markup.xxx"
 * tools that may be invoked from UI controls.
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
      /** The diameter of the circles for the handles. */
      size: 10,
      /** The attributes of the stretch handles */
      stretch: { "fill-opacity": .85, "stroke": "black", "fill": "white" },
      /** The attributes of the line that connects the top-center stretch handle to the rotate handle. */
      rotateLine: { "stroke": "grey", "fill-opacity": .85 },
      /** The attributes of the rotate handle. */
      rotate: { "cursor": "url(Markup/rotate.png) 12 12, auto", "fill-opacity": .85, "stroke": "black", "fill": "lightBlue" },
      /** The attributes of box around the element. */
      moveOutline: { "cursor": "move", "stroke-dasharray": "6,6", "fill": "none", "stroke-opacity": .85, "stroke": "white" },
      /** The attributes of box that provides the move cursor. */
      move: { "cursor": "move", "opacity": 0, "stroke-width": 6, "stroke": "white" },
      /** The attributes of handles on the vertices of lines. */
      vertex: { "cursor": "url(cursors/crosshair.cur), crosshair", "fill-opacity": .85, "stroke": "black", "fill": "white" },
    },
    /** properties for providing feedback about selected elements. */
    hilite: {
      /** the color of a selected element */
      color: "magenta",
      /** the color of an element as the cursor passes over it */
      flash: "cyan",
    },
    /** optionally, show a drop-shadow behind all markup elements. */
    dropShadow: {
      /** if false, no drop shadow */
      enable: true,
      /** the attributes of the drop shadow. See https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feDropShadow */
      attr: {
        "stdDeviation": 2,
        "dx": 1,
        "dy": 1.2,
        "flood-color": "#1B3838",
      },
    },
    /** The "active placement" parameters. New elements are created with these parameters, so UI controls should set them. */
    active: {
      /** the CSS style properties of new text elements. */
      text: {
        "font-family": "sans-serif",
        "font-size": "30px",
        "stroke": "red",
        "fill": "red",
      },
      /** the CSS style properties of new elements. */
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
    /** Used to draw a border outline around the view while it is being marked up so the user can tell Markup is active */
    borderOutline: {
      "stroke": "gold",
      "stroke-width": 6,
      "stroke-opacity": 0.4,
      "fill": "none",
    },
    /** Used to draw a border corner symbols the view while it is being marked up so the user can tell Markup is active */
    borderCorners: {
      "stroke": "black",
      "stroke-width": 2,
      "stroke-opacity": 0.2,
      "fill": "gold",
      "fill-opacity": 0.2,
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
  public static screenToVbMtx = new Matrix();
  public static getVpToScreenMtx(): Matrix { const rect = this.markup!.markupDiv.getBoundingClientRect(); return (new Matrix()).translateO(rect.left, rect.top); }
  public static getVpToVbMtx(): Matrix { return this.getVpToScreenMtx().lmultiplyO(this.screenToVbMtx); }
  public static convertVpToVb(pt: XAndY): Point3d {
    const pt0 = new Point(pt.x, pt.y);
    pt0.transformO(this.getVpToVbMtx());
    return new Point3d(pt0.x, pt0.y, 0);
  }

  /** determine whether there's a markup session currently active */
  public static get isActive() { return undefined !== this.markup; }
  public static markupSelectToolId = "Markup.Select";

  protected static createMarkup(view: ScreenViewport, markupData?: MarkupSvgData) { return new Markup(view, markupData); }

  protected static lockViewportSize(view: ScreenViewport, markupData?: MarkupSvgData) {
    const parentDiv = view.vpDiv;
    const rect = parentDiv.getBoundingClientRect();
    let height = rect.height;
    if (markupData)
      height = Math.floor(rect.width * (markupData.rect.height / markupData.rect.width));
    const style = parentDiv.style;
    style.width = rect.width + "px";
    style.height = height + "px";
  }

  /** Start a markup session */
  public static async start(view: ScreenViewport, markupData?: MarkupSvgData): Promise<void> {
    if (this.markup)
      return; // a markup session is already active.

    await this.init();

    // first, lock the viewport to its current size while the markup session is running
    this.lockViewportSize(view, markupData);

    this.markup = this.createMarkup(view, markupData); // start a markup against the provided view.
    if (!this.markup.svgMarkup) {
      ScreenViewport.setToParentSize(this.markup.vp.vpDiv);
      this.markup.markupDiv.remove();
      return;
    }

    IModelApp.toolAdmin.markupView = view; // so viewing tools won't operate on the view.

    // set the markup Select tool as the default tool and start it, saving current default tool
    this._saveDefaultToolId = IModelApp.toolAdmin.defaultToolId;
    IModelApp.toolAdmin.defaultToolId = this.markupSelectToolId;
    IModelApp.toolAdmin.startDefaultTool();
  }

  /** Read the result of a Markup session. and stop it.
   * @note see [MarkupApp.props.result] for options.
   */
  public static async stop(): Promise<MarkupData> {
    const data = await this.readMarkup();
    if (!this.markup)
      return data;

    // restore original size for vp.
    ScreenViewport.setToParentSize(this.markup.vp.vpDiv);

    IModelApp.toolAdmin.markupView = undefined; // re-enable viewing tools for the view being marked-up
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
      return; // only need to do this once

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
    return markup.svgContainer.svg(); // string-ize the SVG data
  }

  protected static async readMarkup(): Promise<MarkupData> {
    const result = this.props.result;
    let canvas = this.markup!.vp.canvas;
    const svg = this.readMarkupSvg(); // read the current svg data for the markup
    if (svg && result.imprintSvgOnImage) {
      try {
        const svgImage = await imageElementFromImageSource(new ImageSource(svg, ImageSourceFormat.Svg));
        canvas.getContext("2d")!.drawImage(svgImage, 0, 0); // draw markup svg onto view's canvas2d
      } catch (e) { }
    }

    // is the source view too wide? If so, we need to scale the image down.
    if (canvas.width > result.maxWidth) {
      // yes, we have to scale it down, create a new canvas and set the new canvas' size
      const newCanvas = document.createElement("canvas");
      newCanvas.width = result.maxWidth;
      newCanvas.height = canvas.height * (result.maxWidth / canvas.width);
      newCanvas.getContext("2d")!.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, newCanvas.width, newCanvas.height);
      canvas = newCanvas; // return the image from adjusted canvas, not view canvas.
    }

    // return the markup data to be saved by the application.
    return { rect: { width: canvas.width, height: canvas.height }, svg, image: !result.imageFormat ? undefined : canvas.toDataURL(result.imageFormat) };
  }
}

const dropShadowId = "markup-dropShadow"; // this is referenced in the markup Svg to apply the drop-shadow filter to all markup elements.
const cornerId = "markup-photoCorner";
const containerClass = "markup-container";
const dynamicsClass = "markup-dynamics";
const decorationsClass = "markup-decorations";
const markupSvgClass = "markup-svg";

const removeSvgNamespace = (svg: Svg) => { svg.node.removeAttribute("xmlns:svgjs"); return svg; };
const newSvgElement = (name: string) => adopt(create(name));
/**
 * The current markup being created/edited. Holds the SVG elements, plus the active MarkupTool.
 * When starting a Markup, a new Div is added as a child of the ScreenViewport's vpDiv.
 */
export class Markup {
  public readonly markupDiv: HTMLDivElement;
  public readonly undo = new UndoManager();
  public readonly selected!: SelectionSet;
  public readonly svgContainer?: Svg;
  public readonly svgMarkup?: G;
  public readonly svgDynamics?: G;
  public readonly svgDecorations?: G;

  /** create the drop-shadow filter in the Defs section of the supplied svg element */
  private createDropShadow(svg: Svg) {
    const filter = SVG("#" + dropShadowId); // see if we already have one?
    if (filter) filter.remove(); // yes, remove it. This must be someone modifying the drop shadow properties

    // create a new filter, and add it to the Defs of the supplied svg
    svg.defs()
      .add(newSvgElement("filter").id(dropShadowId)
        .add(newSvgElement("feDropShadow").attr(MarkupApp.props.dropShadow.attr)));
  }
  private addNested(className: string): G { return this.svgContainer!.group().addClass(className); }
  private addBorder() {
    const rect = this.svgContainer!.viewbox();
    const inset = MarkupApp.props.borderOutline["stroke-width"];
    const cornerSize = inset * 6;
    const cornerPts = [0, 0, cornerSize, 0, cornerSize * .7, cornerSize * .3, cornerSize * .3, cornerSize * .3, cornerSize * .3, cornerSize * .7, 0, cornerSize];
    const decorations = this.svgDecorations!;
    const photoCorner = decorations.symbol().polygon(cornerPts).attr(MarkupApp.props.borderCorners).id(cornerId);
    const cornerGroup = decorations.group();
    cornerGroup.rect(rect.width - inset, rect.height - inset).move(inset / 2, inset / 2).attr(MarkupApp.props.borderOutline);
    cornerGroup.use(photoCorner);
    cornerGroup.use(photoCorner).rotate(90).translate(rect.width - cornerSize, 0);
    cornerGroup.use(photoCorner).rotate(180).translate(rect.width - cornerSize, rect.height - cornerSize);
    cornerGroup.use(photoCorner).rotate(270).translate(0, rect.height - cornerSize);
  }

  /** Create a new Markup for the supplied ScreenViewport. Adds a new "overlay-markup" div into the "vpDiv"
   * of the viewport.
   * @note you must call destroy on this object at end of markup to remove the markup div.
   */
  public constructor(public vp: ScreenViewport, markupData?: MarkupSvgData) {
    this.markupDiv = vp.addNewDiv("overlay-markup", true, 20); // this div goes on top of the canvas, but behind UI layers
    const rect = this.markupDiv.getBoundingClientRect();

    /** create the container that will be returned as the "svg" data for this markup */
    if (markupData && markupData.svg) {
      this.markupDiv.innerHTML = markupData.svg;
      this.svgContainer = SVG("." + containerClass) as Svg | undefined;
      this.svgMarkup = SVG("." + markupSvgClass) as G | undefined;
      if (!this.svgContainer || !this.svgMarkup)
        return;
      removeSvgNamespace(this.svgContainer);
      this.svgMarkup.each(() => { }, true); // create an SVG.Element for each entry in the SVG file.
    } else {
      this.svgContainer = SVG().addTo(this.markupDiv).addClass(containerClass).viewbox(0, 0, rect.width, rect.height);
      removeSvgNamespace(this.svgContainer);
      this.svgMarkup = this.addNested(markupSvgClass);
    }

    if (MarkupApp.props.dropShadow.enable) {
      this.createDropShadow(this.svgContainer);
      this.svgContainer.attr("filter", "url(#" + dropShadowId + ")");
    }

    /** add two nested groups for providing feedback during the markup session. These Svgs are removed before the data is returned. */
    this.svgDynamics = this.addNested(dynamicsClass); // only for tool dynamics of SVG graphics.
    this.svgDecorations = this.addNested(decorationsClass); // only for temporary decorations of SVG graphics.
    this.addBorder();
    this.selected = new SelectionSet(this.svgDecorations);
    MarkupApp.screenToVbMtx = this.svgMarkup.screenCTM().inverse();
  }

  /** Called when the Markup is destroyed */
  public destroy() { this.markupDiv.remove(); }
  /** Turn on picking the markup elements in the markup view */
  public enablePick() { this.markupDiv.style.pointerEvents = "auto"; }
  /** Turn off picking the markup elements in the markup view */
  public disablePick() { this.markupDiv.style.pointerEvents = "none"; }
  /** Change the default cursor for the markup view */
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

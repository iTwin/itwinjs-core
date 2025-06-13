/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BaselineShift, ColorDef, FractionRun, LineBreakRun, Placement2dProps, TextAnnotation, TextAnnotationAnchor, TextAnnotationFrameShape, TextAnnotationProps, TextBlock, TextBlockJustification, TextBlockMargins, TextFrameStyleProps, TextRun, TextStyleSettingsProps } from "@itwin/core-common";
import { DecorateContext, Decorator, GraphicType, IModelApp, IModelConnection, readElementGraphics, RenderGraphicOwner, Tool } from "@itwin/core-frontend";
import { DtaRpcInterface } from "../common/DtaRpcInterface";
import { Id64, Id64String } from "@itwin/core-bentley";
import { Point3d, YawPitchRollAngles } from "@itwin/core-geometry";

// Ignoring the spelling of the keyins. They're case insensitive, so we check against lowercase.
// cspell:ignore superscript, subscript, widthfactor, fractionscale, fractiontype

class TextEditor implements Decorator {
  // Geometry properties
  private _categoryId: Id64String = Id64.invalid;
  private _iModel?: IModelConnection;
  private _entityId: Id64String = Id64.invalid;
  private _graphic?: RenderGraphicOwner;

  // TextAnnotation properties
  public origin: Point3d = new Point3d(0, 0, 0);
  public rotation = 0;
  public offset = { x: 0, y: 0 };
  public anchor: TextAnnotationAnchor = { horizontal: "left", vertical: "top" };
  public frame: TextFrameStyleProps = { borderWeight: 1, shape: "none" };
  public debugAnchorPointAndRange = false;

  // Properties applied to the entire document
  public get documentStyle(): Pick<TextStyleSettingsProps, "lineHeight" | "widthFactor" | "lineSpacingFactor"> {
    return this._textBlock.styleOverrides;
  }

  public get annotationProps(): TextAnnotationProps {
    const annotation = TextAnnotation.fromJSON({
      textBlock: this._textBlock.toJSON(),
      // origin: this.origin,
      anchor: this.anchor,
      orientation: YawPitchRollAngles.createDegrees(this.rotation, 0, 0).toJSON(),
      offset: this.offset,
      frame: this.frame,
    });

    return annotation.toJSON();
  }

  public get placementProps(): Placement2dProps {
    return {
      origin: this.origin,
      angle: 0,
    }
  }

  // Properties to be applied to the next run
  public runStyle: Omit<TextStyleSettingsProps, "lineHeight" | "widthFactor" | "lineSpacingFactor"> = { fontName: "Arial" };
  public baselineShift: BaselineShift = "none";

  private _textBlock = TextBlock.createEmpty();

  public init(iModel: IModelConnection, category: Id64String): void {
    this.clear();

    this._iModel = iModel;
    this._entityId = iModel.transientIds.getNext();
    this._categoryId = category;

    IModelApp.viewManager.addDecorator(this);
  }

  public clear(): void {
    IModelApp.viewManager.dropDecorator(this);

    this._iModel = undefined;
    this._graphic?.disposeGraphic();
    this._graphic = undefined;
    this._textBlock = TextBlock.createEmpty();
    this.origin.setZero();
    this.rotation = 0;
    this.offset.x = this.offset.y = 0;
    this.anchor = { horizontal: "center", vertical: "middle" };
    this.debugAnchorPointAndRange = false;
    this.runStyle = { fontName: "Arial" };
    this.baselineShift = "none";
    this.frame = { borderWeight: 1, shape: "none" };
  }

  public appendText(content: string): void {
    this._textBlock.appendRun(TextRun.create({
      styleName: "",
      styleOverrides: this.runStyle,
      content,
      baselineShift: this.baselineShift,
    }));
  }

  public appendFraction(numerator: string, denominator: string): void {
    this._textBlock.appendRun(FractionRun.create({
      styleName: "",
      styleOverrides: this.runStyle,
      numerator,
      denominator,
    }));
  }

  public appendBreak(): void {
    this._textBlock.appendRun(LineBreakRun.create({
      styleName: "",
      styleOverrides: this.runStyle,
    }));
  }

  public appendParagraph(): void {
    this._textBlock.appendParagraph();
  }

  public setDocumentWidth(width: number): void {
    this._textBlock.width = width;
  }

  public justify(justification: TextBlockJustification): void {
    this._textBlock.justification = justification;
  }

  public setMargins(margins: Partial<TextBlockMargins>): void {
    this._textBlock.margins = {
      left: margins.left ?? this._textBlock.margins.left,
      right: margins.right ?? this._textBlock.margins.right,
      top: margins.top ?? this._textBlock.margins.top,
      bottom: margins.bottom ?? this._textBlock.margins.bottom,
    };
  }

  public setFrame(frame: Partial<TextFrameStyleProps>) {
    this.frame = { ...this.frame, ...frame };
  }

  /**
   * Draws the graphics for the decoration. Text annotation graphics require a call to the backend to generate the geometry.
   * In this case, we're using the `TextAnnotationGeometry` RPC endpoint that calls [[IModelDb.generateElementGraphics]]
   * with the values from [[appendTextAnnotationGeometry]].
   * These graphics can be added to the [[RenderSystem]] via [[readElementGraphics]] and [[RenderSystem.createGraphicOwner]]
   * or via an [[ElementGeometryGraphicsProvider]]. In this case, we're using the former.
   */
  public async update(): Promise<void> {
    if (!this._iModel) {
      throw new Error("Invoke `dta text init` first");
    }

    if (this._textBlock.isEmpty) {
      return;
    }

    const rpcProps = this._iModel.getRpcProps();

    const gfx = await DtaRpcInterface.getClient().generateTextAnnotationGeometry(
      rpcProps,
      this.annotationProps,
      this._categoryId,
      this.placementProps,
      this.debugAnchorPointAndRange
    );

    const graphic = undefined !== gfx ? await readElementGraphics(gfx, this._iModel, this._entityId, false) : undefined;
    this._graphic = graphic ? IModelApp.renderSystem.createGraphicOwner(graphic) : undefined;

    IModelApp.viewManager.invalidateCachedDecorationsAllViews(this);
  }

  public get useCachedDecorations(): true { return true; }
  public decorate(context: DecorateContext): void {
    if (this._graphic) {
      context.addDecoration(GraphicType.Scene, this._graphic);
    }
  }
}

const editor = new TextEditor();

export class TextDecorationTool extends Tool {
  public static override toolId = "AddTextDecoration";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return undefined; }

  public override async parseAndRun(...inArgs: string[]): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp) {
      return false;
    }

    const cmd = inArgs[0].toLowerCase();
    const arg = inArgs[1];

    switch (cmd) {
      case "clear":
        editor.clear();
        return true;
      case "init":
        // Use the first category if the user doesn't specify one. This is just a convenience.
        const category = arg ?? vp.view.categorySelector.categories.values().next().value;
        if (undefined === category || category === "") {
          throw new Error("No category provided.");
        }

        editor.init(vp.iModel, category);
        break;
      case "center":
        editor.origin = vp.view.getCenter();
        break;
      case "rotation":
        editor.rotation = Number(arg);
        break;
      case "offset":
        if (inArgs.length !== 3) {
          throw new Error("Expected x and y");
        }

        editor.offset.x = Number(arg);
        editor.offset.y = Number(inArgs[2]);
        break;
      case "font":
        editor.runStyle.fontName = arg;
        break;
      case "text":
        editor.appendText(arg);
        break;
      case "fraction":
        if (inArgs.length !== 3) {
          throw new Error("Expected numerator and denominator");
        }

        editor.appendFraction(inArgs[1], inArgs[2]);
        break;
      case "break":
        editor.appendBreak();
        break;
      case "paragraph":
        editor.appendParagraph();
        break;
      case "color":
        editor.runStyle.color = ColorDef.fromString(arg).toJSON();
        break;
      case "height":
        editor.documentStyle.lineHeight = Number.parseFloat(arg);
        break;
      case "widthfactor":
        editor.documentStyle.widthFactor = Number.parseFloat(arg);
        break;
      case "width":
        editor.setDocumentWidth(Number.parseFloat(arg));
        break;
      case "justify": {
        const just = arg.toLowerCase();
        switch (just) {
          case "left":
          case "center":
          case "right":
            editor.justify(just);
            break;
          default:
            throw new Error("Expected left, right, or center");
        }
        break;
      }
      case "spacing":
        editor.documentStyle.lineSpacingFactor = Number.parseFloat(arg);
        break;
      case "bold":
        editor.runStyle.isBold = !editor.runStyle.isBold;
        break;
      case "italic":
        editor.runStyle.isItalic = !editor.runStyle.isItalic;
        break;
      case "underline":
        editor.runStyle.isUnderlined = !editor.runStyle.isUnderlined;
        break;
      case "fractionscale":
        editor.runStyle.stackedFractionScale = Number.parseFloat(arg);
        break;
      case "fractiontype": {
        const type = arg.toLowerCase();
        switch (type) {
          case "horizontal":
          case "diagonal":
            editor.runStyle.stackedFractionType = type;
            break;
          default:
            throw new Error("Expected horizontal or diagonal");
        }
        break;
      }
      case "shift": {
        const shift = arg.toLowerCase();
        switch (shift) {
          case "none":
          case "superscript":
          case "subscript":
            editor.baselineShift = shift;
            break;
          default:
            throw new Error("Expected none, superscript, or subscript");
        }
        break;
      }
      case "anchor": {
        const val = arg.toLowerCase();
        switch (val) {
          case "left":
          case "center":
          case "right":
            editor.anchor.horizontal = val;
            break;
          case "top":
          case "middle":
          case "bottom":
            editor.anchor.vertical = val;
            break;
          default:
            throw new Error("Expected top, middle, bottom, left, center, or right");
        }
        break;
      }
      case "margin": {
        const marginLocation = inArgs[1].toLowerCase();
        const val = Number(inArgs[2]);
        if (isNaN(val)) {
          throw new Error("Expected margin location followed by a number. Margin location can be left, right, top, bottom, all, horizontal, or vertical");
        }

        switch (marginLocation) {
          case "left":
          case "right":
          case "top":
          case "bottom":
            editor.setMargins({ [marginLocation]: val });
            break;
          case "all":
            editor.setMargins({ left: val, right: val, top: val, bottom: val });
            break;
          case "horizontal":
            editor.setMargins({ left: val, right: val });
            break;
          case "vertical":
            editor.setMargins({ top: val, bottom: val });
            break;
          default:
            throw new Error("Expected left, right, top, bottom, all, horizontal, or vertical");
        }
        break;
      }
      case "debug": {
        editor.debugAnchorPointAndRange = !editor.debugAnchorPointAndRange;
        break;
      }
      case "frame": {
        const key = inArgs[1];
        const val = inArgs[2];
        if (key === "fill") editor.setFrame({ fill: (val === "background" || val === "subcategory") ? val : val ? ColorDef.fromString(val).toJSON() : undefined });
        else if (key === "border") editor.setFrame({ border: val ? ColorDef.fromString(val).toJSON() : undefined });
        else if (key === "borderWeight") editor.setFrame({ borderWeight: Number(val) });
        else if (key === "shape") editor.setFrame({ shape: val as TextAnnotationFrameShape });
        else throw new Error("Expected shape, fill, border, borderWeight");

        break;
      }

      default:
        throw new Error(`unrecognized command ${cmd}`);
    }

    await editor.update();
    return true;
  }

  public override async run(): Promise<boolean> {
    throw new Error("handled in parseAndRun");
  }
}

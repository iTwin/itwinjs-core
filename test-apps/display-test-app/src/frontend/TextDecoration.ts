/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BaselineShift, ColorDef, FractionRun, GeometryStreamBuilder, IModelTileRpcInterface, LineBreakRun, TextAnnotation, TextAnnotationAnchor, TextBlock, TextBlockJustification, TextRun, TextStyleSettingsProps } from "@itwin/core-common";
import { DecorateContext, Decorator, GraphicType, IModelApp, IModelConnection, readElementGraphics, RenderGraphicOwner, Tool } from "@itwin/core-frontend";
import { DtaRpcInterface } from "../common/DtaRpcInterface";
import { Guid, Id64, Id64String } from "@itwin/core-bentley";
import { Point3d } from "@itwin/core-geometry";

class TextEditor implements Decorator {
  // Geometry properties
  private _categoryId: Id64String = Id64.invalid;
  private _iModel?: IModelConnection;
  private _entityId: Id64String = Id64.invalid;
  private _graphic?: RenderGraphicOwner;

  // TextAnnotation properties
  public origin: Point3d = new Point3d(0, 0, 0);
  public anchor: TextAnnotationAnchor = { horizontal: "center", vertical: "middle" };

  // Properties applied to the entire document
  public get documentStyle(): Pick<TextStyleSettingsProps, "lineHeight" | "widthFactor" | "lineSpacingFactor"> {
    return this._textBlock.styleOverrides;
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
    this.anchor = { horizontal: "center", vertical: "middle" };
    this.runStyle = { fontName: "Arial" };
    this.baselineShift = "none";
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

  public async update(): Promise<void> {
    if (!this._iModel) {
      throw new Error("Invoke `dta text init` first");
    }

    if (this._textBlock.isEmpty) {
      return;
    }

    const annotation = TextAnnotation.fromJSON({
      textBlock: this._textBlock.toJSON(),
      anchor: this.anchor,
    });

    const rpcProps = this._iModel.getRpcProps();
    const geom = await DtaRpcInterface.getClient().produceTextAnnotationGeometry(rpcProps, annotation.toJSON());
    const builder = new GeometryStreamBuilder();
    builder.appendTextBlock(geom);

    const gfx = await IModelTileRpcInterface.getClient().requestElementGraphics(rpcProps, {
      id: Guid.createValue(),
      toleranceLog10: -5,
      type: "2d",
      placement: {
        origin: this.origin.toJSON(),
        angle: 0,
      },
      categoryId: this._categoryId,
      geometry: {
        format: "json",
        data: builder.geometryStream,
      },
    });

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
        editor.init(vp.iModel, arg);
        break;
      case "center":
        editor.origin = vp.view.getCenter();
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

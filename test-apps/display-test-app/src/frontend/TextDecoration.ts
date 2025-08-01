/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BaselineShift, ColorDef, FractionRun, LeaderTextPointOptions, LineBreakRun, Placement2dProps, TabRun, TextAnnotation, TextAnnotationAnchor, TextAnnotationFrameShape, TextAnnotationLeader, TextAnnotationProps, TextBlock, TextBlockJustification, TextBlockMargins, TextFrameStyleProps, TextRun, TextStyleSettingsProps } from "@itwin/core-common";
import { DecorateContext, Decorator, GraphicType, IModelApp, IModelConnection, readElementGraphics, RenderGraphicOwner, Tool } from "@itwin/core-frontend";
import { DtaRpcInterface } from "../common/DtaRpcInterface";
import { assert, Id64, Id64String } from "@itwin/core-bentley";
import { Angle, Point3d, Vector3d, YawPitchRollAngles } from "@itwin/core-geometry";
import { dtaIpc } from "./App";

// Ignoring the spelling of the keyins. They're case insensitive, so we check against lowercase.
// cspell:ignore superscript, subscript, widthfactor, fractionscale, fractiontype, textpoint, subscriptscale, superscriptscale, insertstyle, updatestyle, deletestyle, applystyle

class TextEditor implements Decorator {
  // Geometry properties
  private _iModel?: IModelConnection;
  private _entityId: Id64String = Id64.invalid;
  private _graphic?: RenderGraphicOwner;
  public categoryId: Id64String = Id64.invalid;
  public modelId: Id64String = Id64.invalid;

  // TextAnnotation properties
  public origin: Point3d = new Point3d(0, 0, 0);
  public rotation = 0;
  public offset = { x: 0, y: 0 };
  public anchor: TextAnnotationAnchor = { horizontal: "left", vertical: "top" };
  public leaders: TextAnnotationLeader[] = [];
  public debugAnchorPointAndRange = false;

  // Properties applied to the entire document
  public get documentStyle(): Pick<
    TextStyleSettingsProps,
    "lineHeight" |
    "widthFactor" |
    "lineSpacingFactor" |
    "frame"> {
    return this.textBlock.styleOverrides;
  }

  public get annotationProps(): TextAnnotationProps {
    const annotation = TextAnnotation.fromJSON({
      textBlock: this.textBlock.toJSON(),
      anchor: this.anchor,
      orientation: YawPitchRollAngles.createDegrees(this.rotation, 0, 0).toJSON(),
      offset: this.offset,
      leaders: this.leaders
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

  public textBlock = TextBlock.createEmpty();

  public init(iModel: IModelConnection, category: Id64String): void {
    this.clear();

    this._iModel = iModel;
    this._entityId = iModel.transientIds.getNext();
    this.categoryId = category;

    IModelApp.viewManager.addDecorator(this);
  }

  public clear(): void {
    IModelApp.viewManager.dropDecorator(this);

    this._iModel = undefined;
    this._graphic?.disposeGraphic();
    this._graphic = undefined;
    this.textBlock = TextBlock.createEmpty();
    this.origin.setZero();
    this.rotation = 0;
    this.offset.x = this.offset.y = 0;
    this.anchor = { horizontal: "center", vertical: "middle" };
    this.debugAnchorPointAndRange = false;
    this.runStyle = { fontName: "Arial" };
    this.baselineShift = "none";
    this.leaders = [];
  }

  public appendText(content: string): void {
    this.textBlock.appendRun(TextRun.create({
      styleOverrides: this.runStyle,
      content,
      baselineShift: this.baselineShift,
    }));
  }

  public appendFraction(numerator: string, denominator: string): void {
    this.textBlock.appendRun(FractionRun.create({
      styleOverrides: this.runStyle,
      numerator,
      denominator,
    }));
  }

  public appendTab(spaces?: number): void {
    this.textBlock.appendRun(TabRun.create({
      styleOverrides: { ... this.runStyle, tabInterval: spaces },
    }));
  }

  public appendBreak(): void {
    this.textBlock.appendRun(LineBreakRun.create({
      styleOverrides: this.runStyle,
    }));
  }

  public appendParagraph(): void {
    this.textBlock.appendParagraph();
  }

  public setDocumentWidth(width: number): void {
    this.textBlock.width = width;
  }

  public justify(justification: TextBlockJustification): void {
    this.textBlock.justification = justification;
  }

  public setMargins(margins: Partial<TextBlockMargins>): void {
    this.textBlock.margins = {
      left: margins.left ?? this.textBlock.margins.left,
      right: margins.right ?? this.textBlock.margins.right,
      top: margins.top ?? this.textBlock.margins.top,
      bottom: margins.bottom ?? this.textBlock.margins.bottom,
    };
  }

  public setLeaderProps() {
    this.leaders?.push({ startPoint: Point3d.createZero().plusScaled(Vector3d.unitX().negate(), 20), attachment: { mode: "Nearest" } });
  }

  public setLeaderStartPoint(leader: TextAnnotationLeader, angle: number) {
    const point = Point3d.createZero();
    const distance = 10;
    const angleRadians = Angle.createDegrees(angle);
    const directionVector = Vector3d.createPolar(distance, angleRadians);
    leader.startPoint = point.plus(directionVector);
  }

  public setLeaderKeyPoint(leader: TextAnnotationLeader, curveIndex: number, fraction: number) {
    leader.attachment = { mode: "KeyPoint", curveIndex, fraction };
  }
  public setLeaderTextPoint(leader: TextAnnotationLeader, arg: LeaderTextPointOptions) {
    leader.attachment = { mode: "TextPoint", position: arg };
  }
  public setLeaderNearest(leader: TextAnnotationLeader) {
    leader.attachment = { mode: "Nearest" };
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

    if (this.textBlock.isEmpty || this.textBlock.isWhitespace) {
      return;
    }

    const rpcProps = this._iModel.getRpcProps();

    const gfx = await DtaRpcInterface.getClient().generateTextAnnotationGeometry(
      rpcProps,
      this.annotationProps,
      this.categoryId,
      this.modelId,
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

    if (vp.view.is2d()) {
      editor.modelId = vp.view.baseModelId;
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
      case "tab":
        const spaces = inArgs[1] ? parseFloat(inArgs[1]) : undefined;
        editor.appendTab(spaces);
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
      case "subscriptscale" : {
        const subScale = Number.parseFloat(arg);
        if (isNaN(subScale)) {
          throw new Error("Expected a number for subscript scale");
        }
        editor.runStyle.subScriptScale = subScale;
        break;
      };
      case "superscriptscale": {
        const superScale = Number.parseFloat(arg);
        if (isNaN(superScale)) {
          throw new Error("Expected a number for superscript scale");
        }
        editor.runStyle.superScriptScale = superScale;
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
      case "log": {
        // Log the current text block to the console
        const anno = TextAnnotation.fromJSON(editor.annotationProps);
        // eslint-disable-next-line no-console
        console.log(anno.textBlock.stringify({ paragraphBreak: "\n", lineBreak: "\n" }));
        // eslint-disable-next-line no-console
        console.log("Object > ", anno);
        // eslint-disable-next-line no-console
        console.log("Props > ", editor.annotationProps);
        break;
      }
      case "frame": {
        const key = inArgs[1];
        const val = inArgs[2];
        const frame: TextFrameStyleProps = editor.documentStyle.frame ?? { shape: "none" };
        if (key === "fill") frame.fill = (val === "background" || val === "subcategory") ? val : val ? ColorDef.fromString(val).toJSON() : undefined;
        else if (key === "border") frame.border = val ? ColorDef.fromString(val).toJSON() : undefined;
        else if (key === "borderWeight") frame.borderWeight = Number(val);
        else if (key === "shape") frame.shape = val as TextAnnotationFrameShape;
        else throw new Error("Expected shape, fill, border, borderWeight");

        editor.documentStyle.frame = frame;

        break;
      }
      case "insertstyle": {
        if (!arg) {
          throw new Error("Expected style name");
        }
        const style: TextStyleSettingsProps = {...editor.documentStyle, ...editor.runStyle };
        const styleId = await dtaIpc.insertTextStyle(
          vp.iModel.key,
          arg,
          style,
        );

        // eslint-disable-next-line no-console
        console.log(`Inserted text style with id ${styleId} and name ${arg}`);

        return true;
      }
      case "updatestyle": {
        if (!arg) {
          throw new Error("Expected style name");
        }
        const style: TextStyleSettingsProps = {...editor.documentStyle, ...editor.runStyle };
        await dtaIpc.updateTextStyle(
          vp.iModel.key,
          arg,
          style,
        );
        return true;
      }
      case "deletestyle": {
        if (!arg) {
          throw new Error("Expected style name");
        }
        await dtaIpc.deleteTextStyle(
          vp.iModel.key,
          arg,
        );
        return true;
      }
      case "applystyle": {
        editor.textBlock.styleId = arg;
        editor.textBlock.clearStyleOverrides();
        break;
      }
      case "insert": {
        assert(vp.view.is2d() === true, "View is not 2d");
        const id = await dtaIpc.insertText(
          vp.iModel.key,
          editor.categoryId,
          editor.modelId,
          editor.placementProps,
          editor.annotationProps
        );

        // eslint-disable-next-line no-console
        console.log(`Inserted text annotation with id ${id}`);

        return true;
      }
      case "update": {
        if (!arg) {
          throw new Error("Expected annotation ID");
        }

        await dtaIpc.updateText(
          vp.iModel.key,
          arg,
          editor.categoryId,
          editor.placementProps,
          editor.annotationProps
        );

        return true;
      }
      case "delete": {
        if (!arg) {
          throw new Error("Expected annotation ID");
        }

        await dtaIpc.deleteText(
          vp.iModel.key,
          arg
        );

        return true;
      }
      case "scale": {
        if (!arg) {
          throw new Error("Expected scale factor");
        }

        const scaleFactor = Number(arg);
        if (isNaN(scaleFactor)) {
          throw new Error("Expected a number for scale factor");
        }

        await dtaIpc.setScaleFactor(
          vp.iModel.key,
          editor.modelId,
          scaleFactor
        );

        break;
      }
      case "leader":
        const command = inArgs[1];
        const value = inArgs[2];
        if (command === "new") {
          editor.setLeaderProps();
        } else {
          if (editor.leaders && editor.leaders.length > 0) {
            const latestLeaderIndex = editor.leaders.length - 1;
            if (command === "start") editor.setLeaderStartPoint(editor.leaders[latestLeaderIndex], Number(value));
            else if (command === "keypoint") {
              const curveIndex = inArgs[2];
              const fraction = inArgs[3]
              editor.setLeaderKeyPoint(editor.leaders[latestLeaderIndex], Number(curveIndex), Number(fraction));
            }
            else if (command === "nearest") editor.setLeaderNearest(editor.leaders[latestLeaderIndex]);
            else if (command === "textpoint") {
              const position = inArgs[2] as LeaderTextPointOptions;
              editor.setLeaderTextPoint(editor.leaders[latestLeaderIndex], position);

            }
            else throw new Error("Expected start, keypoint, nearest, textpoint");
          } else {
            throw new Error("No leaders created. Use dta text leader new.");
          }

        }
        break;

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

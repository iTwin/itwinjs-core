/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ColorDefProps, ElementGeometry, GeometryStreamBuilder, IModelReadRpcInterface, IModelTileRpcInterface, Placement2d, TextAnnotation, TextAnnotationAnchor, TextBlock, TextRun, TextStyleSettingsProps } from "@itwin/core-common";
import { DecorateContext, Decorator, GraphicType, IModelApp, IModelConnection, RenderGraphic, RenderGraphicOwner, Tool, readElementGraphics } from "@itwin/core-frontend";
import { parseArgs } from "@itwin/frontend-devtools";
import { DtaRpcInterface } from "../common/DtaRpcInterface";
import { Guid, Id64, Id64String } from "@itwin/core-bentley";
import { Point3d } from "@itwin/core-geometry";

const decorators: Decorator[] = [];

function addTextDecoration(graphic: RenderGraphic): void {
  graphic = IModelApp.renderSystem.createGraphicOwner(graphic);

  const decorator: Decorator = {
    decorate: (context) => {
      context.addDecoration(GraphicType.WorldOverlay, graphic);
    },
  };
  
  IModelApp.viewManager.addDecorator(decorator);
  decorators.push(decorator);
}

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
  public runStyle: Omit<TextStyleSettingsProps, "lineHeight" | "widthFactor" | "lineSpacingFactor"> = { };

  private _textBlock = TextBlock.createEmpty();
  
  public init(iModel: IModelConnection, category: Id64String): void {
    this.clear();

    this._iModel = iModel;
    this._entityId = iModel.transientIds.getNext();
    this._categoryId = category;

    IModelApp.viewManager.addDecorator(this);

    // ###TODO remove this
    this._textBlock.appendRun(TextRun.create({
      styleOverrides: { fontName: "Arial" },
      styleName: "",
      content: "###TODO remove me",
    }));
  }

  public clear(): void {
    IModelApp.viewManager.dropDecorator(this);
    
    this._iModel = undefined;
    this._graphic?.disposeGraphic();
    this._graphic = undefined;
    this._textBlock = TextBlock.createEmpty();
    this.origin.setZero();
    this.anchor = { horizontal: "center", vertical: "middle" };
    this.runStyle = { };
  }

  public async update(): Promise<void> {
    if (!this._iModel) {
      throw new Error("Invoke `dta text init` first");
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
      toleranceLog10: -3,
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
    const iModel = IModelApp.viewManager.selectedView?.iModel;
    if (!iModel) {
      return false;
    }

    const cmd = inArgs[0].toLowerCase();
    const args = inArgs.slice(1);

    switch (cmd) {
      case "init":
        editor.init(iModel, args[0]);
        break;
      case "clear":
        editor.clear();
        return true;
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

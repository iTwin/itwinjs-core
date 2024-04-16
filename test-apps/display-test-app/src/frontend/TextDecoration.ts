/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ElementGeometry, GeometryStreamBuilder, IModelReadRpcInterface, IModelTileRpcInterface, Placement2d, TextAnnotation, TextBlock, TextRun } from "@itwin/core-common";
import { Decorator, GraphicType, IModelApp, RenderGraphic, Tool, readElementGraphics } from "@itwin/core-frontend";
import { parseArgs } from "@itwin/frontend-devtools";
import { DtaRpcInterface } from "../common/DtaRpcInterface";
import { Guid, Id64, Id64String } from "@itwin/core-bentley";

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

export class TextDecorationTool extends Tool {
  public static override toolId = "AddTextDecoration";
  public static override get minArgs() { return 2; }
  public static override get maxArgs() { return undefined; }

  private _text?: string;
  private _category?: Id64String;

  public override async parseAndRun(...inArgs: string[]): Promise<boolean> {
    if (inArgs.length === 1 && inArgs[0].toLowerCase() === "clear") {
      for (const decorator of decorators) {
        IModelApp.viewManager.dropDecorator(decorator);
      }

      decorators.length = 0;
      return true;
    }
    
    const args = parseArgs(inArgs);
    this._text = args.get("t");
    this._category = args.get("c");
    return this.run();
  }

  public override async run(): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp || !this._text || !this._category || !vp.view.is2d()) {
      return false;
    }

    const textBlock = TextBlock.createEmpty();
    textBlock.appendRun(TextRun.create({
      styleName: "",
      content: this._text,
      styleOverrides: {
        fontName: "Arial",
      },
    }));

    const annotation = TextAnnotation.fromJSON({
      textBlock: textBlock.toJSON(),
    });

    const geom = await DtaRpcInterface.getClient().produceTextAnnotationGeometry(vp.iModel.getRpcProps(), annotation.toJSON());
    const builder = new GeometryStreamBuilder();
    builder.appendTextBlock(geom);

    const gfx = await IModelTileRpcInterface.getClient().requestElementGraphics(vp.iModel.getRpcProps(), {
      id: Guid.createValue(),
      toleranceLog10: -3,
      type: "2d",
      placement: {
        origin: vp.view.getCenter(),
        angle: 0,
      },
      categoryId: this._category,
      geometry: {
        format: "json",
        data: builder.geometryStream,
      }
    });

    if (undefined === gfx) {
      return false;
    }

    const graphic = await readElementGraphics(gfx, vp.iModel, vp.iModel.transientIds.getNext(), false);
    if (!graphic) {
      return false;
    }

    addTextDecoration(graphic);
    return true;
  }
}

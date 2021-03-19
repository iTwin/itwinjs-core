/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@bentley/imodeljs-frontend";
import { ToolItemDef } from "@bentley/ui-framework";
import { PlaceBlockTool } from "./PlaceBlockTool";
import { PlaceLineStringTool } from "./PlaceLineStringTool";
import { DeleteElementsTool, MoveElementsTool, RotateElementsTool } from "@bentley/imodeljs-editor-frontend";

export class EditTools {
  public static get deleteElementTool() {
    return new ToolItemDef({
      toolId: DeleteElementsTool.toolId,
      iconSpec: DeleteElementsTool.iconSpec,
      label: DeleteElementsTool.flyover,
      tooltip: DeleteElementsTool.description,
      execute: () => {
        IModelApp.tools.run(DeleteElementsTool.toolId);
      },
    });
  }

  public static get moveElementTool() {
    return new ToolItemDef({
      toolId: MoveElementsTool.toolId,
      iconSpec: MoveElementsTool.iconSpec,
      label: MoveElementsTool.flyover,
      tooltip: MoveElementsTool.description,
      execute: () => {
        IModelApp.tools.run(MoveElementsTool.toolId);
      },
    });
  }

  public static get rotateElementTool() {
    return new ToolItemDef({
      toolId: RotateElementsTool.toolId,
      iconSpec: RotateElementsTool.iconSpec,
      label: RotateElementsTool.flyover,
      tooltip: RotateElementsTool.description,
      execute: () => {
        IModelApp.tools.run(RotateElementsTool.toolId);
      },
    });
  }

  public static get placeLineStringTool() {
    return new ToolItemDef({
      toolId: PlaceLineStringTool.toolId,
      iconSpec: PlaceLineStringTool.iconSpec,
      label: PlaceLineStringTool.flyover,
      tooltip: PlaceLineStringTool.description,
      execute: () => {
        IModelApp.tools.run(PlaceLineStringTool.toolId);
      },
    });
  }

  public static get placeBlockTool() {
    return new ToolItemDef({
      toolId: PlaceBlockTool.toolId,
      iconSpec: PlaceBlockTool.iconSpec,
      label: PlaceBlockTool.flyover,
      tooltip: PlaceBlockTool.description,
      execute: async () => {
        IModelApp.tools.run(PlaceBlockTool.toolId);
      },
    });
  }
}

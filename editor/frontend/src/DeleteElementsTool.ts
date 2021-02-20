/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { CompressedId64Set, IModelStatus, OrderedId64Array } from "@bentley/bentleyjs-core";
import { BasicManipulationCommandIpc, editorBuiltInCmdIds } from "@bentley/imodeljs-editor-common";
import { ElementSetTool } from "@bentley/imodeljs-frontend";
import { EditTools } from "./EditTool";

/** Delete elements immediately from active selection set or prompt user to identify elements to delete. */
export class DeleteElementsTool extends ElementSetTool {
  public static toolId = "DeleteElements";

  protected get allowSelectionSet(): boolean { return true; }
  protected get allowGroups(): boolean { return true; }
  protected get allowDragSelect(): boolean { return true; }
  protected get controlKeyContinuesSelection(): boolean { return true; }
  protected get requireAcceptForSelectionSetOperation(): boolean { return false; }

  public static callCommand<T extends keyof BasicManipulationCommandIpc>(method: T, ...args: Parameters<BasicManipulationCommandIpc[T]>): ReturnType<BasicManipulationCommandIpc[T]> {
    return EditTools.callCommand(method, ...args) as ReturnType<BasicManipulationCommandIpc[T]>;
  }

  public async processAgendaImmediate(): Promise<void> {
    try {
      await EditTools.startCommand<string>(editorBuiltInCmdIds.cmdBasicManipulation, this.iModel.key);

      const ids = new OrderedId64Array(); // TODO: ElementAgenda method to get OrderedId64Array...
      this.agenda.elements.forEach((id) => ids.insert(id));

      if (IModelStatus.Success === await DeleteElementsTool.callCommand("deleteElements", CompressedId64Set.compressIds(ids)))
        await this.iModel.saveChanges();
    } catch (err) {
      // TODO: NotificationManager message?
    }
  }

  public onRestartTool(): void {
    const tool = new DeleteElementsTool();
    if (!tool.run())
      this.exitTool();
  }
}

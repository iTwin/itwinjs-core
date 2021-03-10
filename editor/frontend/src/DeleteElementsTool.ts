/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelStatus } from "@bentley/bentleyjs-core";
import { BasicManipulationCommandIpc, editorBuiltInCmdIds } from "@bentley/imodeljs-editor-common";
import { ElementSetTool, IModelApp, NotifyMessageDetails, OutputMessagePriority } from "@bentley/imodeljs-frontend";
import { EditTools } from "./EditTool";

/** @alpha Delete elements immediately from active selection set or prompt user to identify elements to delete. */
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
      if (IModelStatus.Success === await DeleteElementsTool.callCommand("deleteElements", this.agenda.compressIds()))
        await this.saveChanges();
    } catch (err) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, err.toString()));
    }
  }

  public onRestartTool(): void {
    const tool = new DeleteElementsTool();
    if (!tool.run())
      this.exitTool();
  }
}

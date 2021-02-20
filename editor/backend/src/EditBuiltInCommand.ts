/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { CompressedId64Set, IModelStatus } from "@bentley/bentleyjs-core";
import { IModelDb } from "@bentley/imodeljs-backend";
import { EditorBasicManipulationCommandIpc, editorBuiltInCmdIds } from "@bentley/imodeljs-editor-common";
import { EditCommand } from "./EditCommand";

export class EditorBasicManipulationCommand extends EditCommand implements EditorBasicManipulationCommandIpc {
  public static commandId = editorBuiltInCmdIds.cmdBasicManipulation;

  public constructor(iModel: IModelDb, protected _str: string) { super(iModel); }

  public async deleteElements(ids: CompressedId64Set): Promise<IModelStatus> {
    for (const id of CompressedId64Set.iterable(ids))
      this.iModel.elements.deleteElement(id);
    return IModelStatus.Success;
  }
}

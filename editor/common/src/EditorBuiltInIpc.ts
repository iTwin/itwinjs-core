/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { CompressedId64Set, IModelStatus } from "@bentley/bentleyjs-core";
import { EditCommandIpc } from "./EditorIpc";

/** @alpha */
export const editorBuiltInCmdIds = {
  cmdBasicManipulation: "basicManipulation",
};

/** @alpha */
export interface BasicManipulationCommandIpc extends EditCommandIpc {
  deleteElements: (ids: CompressedId64Set) => Promise<IModelStatus>;
}

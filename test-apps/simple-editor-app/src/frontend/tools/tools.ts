/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { SimpleEditorApp } from "../api/SimpleEditorApp";
import { PlaceLinestringTool, DeleteElementTool, MoveElementTool } from "./TestPrimitiveTools";

export class Tools {
  public static registerTools() {
    PlaceLinestringTool.register(SimpleEditorApp.namespace);
    DeleteElementTool.register(SimpleEditorApp.namespace);
    MoveElementTool.register(SimpleEditorApp.namespace);
  }
}

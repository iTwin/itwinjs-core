/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { registerTool, ViewManager } from "@itwin/core-extension";
import { SelectionTool } from "./SelectTool";

export default function activate() {
  registerTool(SelectionTool);
  console.log("hello world");
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { registerTool } from "@itwin/core-extension";
import { ExtensionSelectTool } from "./SelectTool";

export default function activate() {
  registerTool(ExtensionSelectTool);
  console.log("hello world");
}

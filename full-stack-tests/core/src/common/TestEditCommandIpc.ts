/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EditCommandIpc } from "@bentley/imodeljs-editor-common";

export const testCmdIds = {
  cmd1: "test.command.1",
  cmd2: "test.command.2",
};

export interface TestCmdOjb1 {
  i1: number;
  i2: number;
}

export interface TestCmdResult {
  str: string;
  num: number;
}

export interface TestCommandIpc extends EditCommandIpc {
  testMethod1: (str1: string, str2: string, obj1: TestCmdOjb1) => Promise<TestCmdResult>;
}

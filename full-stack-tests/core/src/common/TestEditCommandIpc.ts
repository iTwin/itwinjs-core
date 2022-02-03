/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { EditCommandIpc } from "@itwin/editor-common";

export const testCmdIds = {
  cmd1: "testcommand.1",
  cmd2: "testcommand.2",
};

export interface TestCmdOjb1 {
  i1: number;
  i2: number;
  buf: Int8Array;
}

export interface TestCmdResult {
  str: string;
  num: number;
  buf: Int32Array;
}

export interface TestCommandIpc extends EditCommandIpc {
  testMethod1: (str1: string, str2: string, obj1: TestCmdOjb1) => Promise<TestCmdResult>;
}

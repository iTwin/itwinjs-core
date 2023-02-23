/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelDb } from "@itwin/core-backend";
import { EditCommand } from "@itwin/editor-backend";
import { testCmdIds, TestCmdOjb1, TestCmdResult, TestCommandIpc } from "../common/TestEditCommandIpc";

export abstract class TestCommand extends EditCommand implements TestCommandIpc {
  public count = 4;
  public constructor(iModel: IModelDb, protected _str: string) { super(iModel); }
  public abstract testMethod1(str1: string, str2: string, obj1: TestCmdOjb1): Promise<TestCmdResult>;
  public override async requestFinish(): Promise<string> {
    return --this.count >= 0 ? "edit command is busy" : "done";
  }
}

export class TestEditCommand1 extends TestCommand {
  public static override commandId = testCmdIds.cmd1;

  public override async onStart() {
    return `${this._str}:1`;
  }
  public async testMethod1(str1: string, str2: string, obj1: TestCmdOjb1) {
    const arr = Array.from(obj1.buf);
    arr.push(-22);
    return { str: str1 + str2, num: obj1.i1 + obj1.i2, buf: Int32Array.from(arr) };
  }
}

export class TestEditCommand2 extends TestCommand {
  public static override commandId = testCmdIds.cmd2;

  public override async onStart() {
    return `${this._str}:2`;
  }

  public async testMethod1(str1: string, str2: string, obj1: TestCmdOjb1) {
    const arr = Array.from(obj1.buf);
    arr.push(-32);
    return { str: str2 + str1, num: obj1.i1 - obj1.i2, buf: Int32Array.from(arr) };
  }
}

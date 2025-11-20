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

export class MockTestEditCommand extends EditCommand {
  public static override commandId = "Test.MockTestEditCommand";
  private _hasStarted = false;
  private _startupDelay = 2000; // 2 seconds

  public override async onStart(): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, this._startupDelay));
    this._hasStarted = true;
    return "Mock edit command started";
  }

  public async testMethod(): Promise<string> {
    return "testMethod executed";
  }

  public async requiresStartup(): Promise<boolean> {
    if (!this._hasStarted) {
      throw new Error("Command has not finished starting up");
    }
    return true;
  }

  public async getStartupStatus(): Promise<{ hasStarted: boolean; message: string }> {
    return {
      hasStarted: this._hasStarted,
      message: this._hasStarted ? "Command has started" : "Command is starting",
    };
  }
}

export class MockTestEditCommand2 extends EditCommand {
  public static override commandId = "Test.MockTestEditCommand2";

  public override async onStart(): Promise<string> {
    // Fast command with minimal startup time
    return "Mock edit command 2 started";
  }
}

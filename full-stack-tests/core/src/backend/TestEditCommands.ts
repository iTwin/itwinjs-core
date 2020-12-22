/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelDb } from "@bentley/imodeljs-backend";
import { EditCommand } from "@bentley/imodeljs-editor-backend";
import { CommandResult } from "@bentley/imodeljs-editor-common";
import { cmdIds, Test1Args, Test1Response } from "../common/TestEditCommandProps";

export class TestEditCommand1 extends EditCommand {
  public static commandId = cmdIds.cmd1;

  public constructor(iModel: IModelDb, private _str: string) { super(iModel); }

  public onStart(): CommandResult<string> {
    return { result: `${this._str}:1` };
  }
  public testMethod1(args: Test1Args): CommandResult<Test1Response> {
    return {
      result: {
        outStr: args.str1 + args.str2,
        outNum: args.obj1.i1 + args.obj1.i2,
      },
    };
  }
};

export class TestEditCommand2 extends EditCommand {
  public static commandId = cmdIds.cmd2;

  public constructor(iModel: IModelDb, private _str: string) { super(iModel); }

  public onStart(): CommandResult<string> {
    return { result: `${this._str}:2` };
  }
  public testMethod1(args: Test1Args): CommandResult<Test1Response> {
    return {
      result: {
        outStr: args.str2 + args.str1,
        outNum: args.obj1.i1 - args.obj1.i2,
      },
    };
  }
};

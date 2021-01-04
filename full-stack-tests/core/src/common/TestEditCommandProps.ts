/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export const cmdIds = {
  cmd1: "test.command.1",
  cmd2: "test.command.2",
};

export interface Test1Args {
  str1: string;
  str2: string;
  obj1: {
    i1: number;
    i2: number;
  };
}

export interface Test1Response {
  outStr: string;
  outNum: number;
}

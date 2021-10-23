/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/// <reference types="node" />

declare module "fs-write-stream-atomic" {

  import stream = require("stream");

  class WriteStreamAtomic extends stream.Writable {
    public constructor(path: string, options?: any);
  }

  export = WriteStreamAtomic;
}

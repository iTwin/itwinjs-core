/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/// <reference types="node" />

declare module 'fs-write-stream-atomic' {

  import stream = require('stream');

  class WriteStreamAtomic extends stream.Writable {
    public constructor(path: string, options?: any);
  }

  export = WriteStreamAtomic;
}

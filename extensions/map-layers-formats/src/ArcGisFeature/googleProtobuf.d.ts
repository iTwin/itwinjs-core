/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "google-protobuf";

// @types/google-protobuf only describes the 3.x API. google-protobuf 4.x replaces BinaryReader.readPacked*() with these.
declare module "google-protobuf" {
  interface BinaryReader {
    readPackableUint32Into(values: number[]): void;
    readPackableSint64Into(values: number[]): void;
    readPackableUint64Into(values: number[]): void;
  }
}

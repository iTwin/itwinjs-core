/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.system.runtime;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { ABuffer } from "../buffer/ABuffer";
import { StringMap } from "../collection/StringMap";

/**
 * Class Downloader defines a platform independant download tool.
 */
/** @internal */
export class Downloader {
  /** The default instance of this tool for this runtime. This needs to be set by the host application on startup. */
  public static INSTANCE: Downloader = null;

  // create a new downloader
  //
  public constructor() {}

  // download a byte array
  //
  public async downloadBytes(
    method: string,
    requestURL: string,
    requestHeaders: StringMap<string>,
    postText: string,
    postData: ABuffer,
    responseHeaders: StringMap<string>
  ): Promise<ABuffer> {
    return null;
  }

  // download a text
  //
  public async downloadText(
    method: string,
    requestURL: string,
    requestHeaders: StringMap<string>,
    postText: string,
    postData: ABuffer,
    responseHeaders: StringMap<string>
  ): Promise<string> {
    return null;
  }

  // download a text without request options
  //
  public async downloadText2(requestURL: string): Promise<string> {
    return null;
  }
}

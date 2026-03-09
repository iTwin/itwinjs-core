/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export type CertaBackendCallback = (...args: any[]) => void | null | undefined | number | string | boolean | Promise<void> | Promise<null> | Promise<undefined> | Promise<number> | Promise<string> | Promise<boolean>;

export interface BridgeRequest {
  name: string;
  args: any[];
}

export interface BridgeResponse {
  result?: any;
  error?: { message: string; stack?: string };
}

export interface CertaBridgeOptions {
  /** Path to the backend init module (relative to project root). The module should export a function that optionally returns a cleanup callback. */
  backendInitModule?: string;
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BackendBuffer, PlatformUtilities } from "@itwin/core-common";
import * as os from "os";
import { Buffer } from "buffer";

/** @internal */
export class PlatformUtilitiesBackend extends PlatformUtilities {
  public static initialize() {
    const utilities = new PlatformUtilitiesBackend();
    this.supplyUtilities(utilities);
  }

  public override toBase64(value: Uint8Array | string): string {
    return Buffer.from(value).toString("base64");
  }

  public override getHostname(): string {
    return os.hostname();
  }

  public override isBackendBuffer(value: any): value is BackendBuffer {
    return Buffer.isBuffer(value);
  }
}

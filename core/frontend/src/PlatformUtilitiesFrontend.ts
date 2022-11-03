/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BackendBuffer, PlatformUtilities } from "@itwin/core-common";

/** @internal */
export class PlatformUtilitiesFrontend extends PlatformUtilities {
  public static initialize() {
    const utilities = new PlatformUtilitiesFrontend();
    this.supplyUtilities(utilities);
  }

  public override toBase64(value: Uint8Array | string): string {
    let decodedValue: string;
    if (typeof (value) === "string") {
      decodedValue = value;
    } else {
      const decoder = new TextDecoder("utf8");
      decodedValue = decoder.decode(value);
    }

    // eslint-disable-next-line deprecation/deprecation
    return btoa(decodedValue); // NOTE: The btoa function is only deprecated when running in node.js
  }

  public override getHostname(): string {
    if (globalThis.window) {
      return globalThis.window.location.host;
    } else {
      return "imodeljs-mobile";
    }
  }

  public override isBackendBuffer(_value: any): _value is BackendBuffer {
    return false;
  }
}

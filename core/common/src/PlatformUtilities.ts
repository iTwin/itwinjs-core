/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyStatus, IModelError } from "./IModelError";
import type { Readable, Writable } from "stream"; // Must be "import type" to avoid polyfill errors
import type { Buffer } from "buffer"; // Must be "import type" to avoid polyfill errors

const UTILITIES = Symbol.for("@itwin/core-common/PlatformUtilities");

/** @internal */
export type BackendReadable = Readable;

/** @internal */
export type BackendWritable = Writable;

/** @internal */
export type BackendBuffer = Buffer;

/** @internal */
export abstract class PlatformUtilities {
  private static global: any = typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};

  protected static supplyUtilities(utilities: PlatformUtilities) {
    this.global[UTILITIES] = utilities;
  }

  public static get initialized(): boolean {
    return typeof (this.global[UTILITIES]) !== "undefined";
  }

  public static get utilities(): PlatformUtilities {
    if (!this.initialized) {
      throw new IModelError(BentleyStatus.ERROR, "PlatformUtilities not available. Has IModelApp or IModelHost been started yet?");
    }

    return this.global[UTILITIES];
  }

  public abstract toBase64(value: Uint8Array | string): string;

  public abstract getHostname(): string;

  public abstract isBackendBuffer(value: any): value is BackendBuffer;
}

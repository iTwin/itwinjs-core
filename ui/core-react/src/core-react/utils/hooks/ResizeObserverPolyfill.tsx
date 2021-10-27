/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */
import * as ResizeObserverPolyfill from "resize-observer-polyfill";

/** @internal */
export type ResizeObserverType = typeof import("resize-observer-polyfill").default;

function getModule(mod: any) {
  /* istanbul ignore if */
  if (mod.default)
    return mod.default;
  return mod;
}

/** @internal */
export const ResizeObserver: ResizeObserverType = getModule(ResizeObserverPolyfill); // eslint-disable-line @typescript-eslint/naming-convention

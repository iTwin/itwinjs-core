/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
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
export const ResizeObserver: ResizeObserverType = getModule(ResizeObserverPolyfill); // tslint:disable-line: variable-name

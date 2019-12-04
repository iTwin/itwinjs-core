/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { IModelApp } from "../IModelApp";

/** Query the ratio of the resolution in physical pixels to the resolution in CSS pixels for the current display device.
 * See: https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
 * @alpha
 */
export function queryDevicePixelRatio(): number {
  return false !== IModelApp.renderSystem.options.dpiAwareViewports ? window.devicePixelRatio || 1 : 1;
}

/** Convert a number in CSS pixels to actual device pixels.
 * @param num The number in CSS pixels to scale
 * @returns The resulting number in device pixels
 * @alpha
 */
export function cssPixelsToDevicePixels(cssPixels: number): number { return Math.round(cssPixels * queryDevicePixelRatio()); }

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import * as React from "react";
import { throttle } from "lodash-es";

/** lodash throttle options
 * @internal
 */
export interface ThrottleSettings {
  leading: boolean;
  trailing: boolean;
}

const defaultOptions: ThrottleSettings = {
  leading: false,
  trailing: true,
};

/** Used to throttle function calls
 * @internal
 */
export function useThrottledFn<T extends (...args: any) => any>(
  functionToThrottle: T,
  waitTime: number,
  dependencies: React.DependencyList,
  options: ThrottleSettings = defaultOptions,
) {
  const throttledFunction = throttle(functionToThrottle, waitTime, options);
  return React.useCallback(throttledFunction, dependencies);
}

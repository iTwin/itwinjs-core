/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useRef, useState } from "react";

/** @internal */
interface RerenderData<T extends (arg: any) => void> {
  /** Data specific to the current rerender cycle. */
  rerenderContext: Parameters<T>[0];
  /** Identifies the current rerender cycle. Starts at 0. */
  numRerenders: number;
  /** Rerenders component with new `rerenderContext`, if one is provided. */
  rerender: T;
}

/**
 * @internal
 * Makes component able to rerender itself.
 */
export function useRerender(): RerenderData<() => void>;
/**
 * @internal
 * Makes component able to rerender itself while preserving some data between rerenders.
 * @param initialContext Data that component receives on first render cycle.
 */
export function useRerender<T>(initialContext: T): RerenderData<(newContext: T) => void>;
/** @internal */
export function useRerender<T>(initialContext?: T): RerenderData<(newContext?: T) => void> {
  const data = useRef({ numRerenders: 0, rerenderRequested: false, context: initialContext }).current;
  if (data.rerenderRequested) {
    data.numRerenders += 1;
    data.rerenderRequested = false;
  } else {
    data.context = initialContext;
    data.numRerenders = 0;
  }

  const [_, setState] = useState({});
  return {
    rerenderContext: data.context,
    numRerenders: data.numRerenders,
    rerender: (newContext) => {
      data.rerenderRequested = true;
      data.context = newContext;
      setState({});
    },
  };
}

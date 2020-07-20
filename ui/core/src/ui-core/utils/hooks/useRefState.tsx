/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import * as React from "react";

/** Stores current ref value in a state.
 * @internal
 */
export function useRefState<T>(): [React.Ref<T>, T | undefined] {
  const [state, setState] = React.useState<T>();
  const ref = React.useCallback((instance: T | null) => {
    setState(instance || undefined);
  }, []);
  return [ref, state];
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [ref, state];
}

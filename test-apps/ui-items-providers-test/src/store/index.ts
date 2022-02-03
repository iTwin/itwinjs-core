/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { StateManager } from "@itwin/appui-react";
import type { PayloadAction } from "@reduxjs/toolkit";
import { createSlice } from "@reduxjs/toolkit";

/**
 * This file sets up the state that can be used by the tools and items within this provider. The package
 * `@reduxjs/toolkit` is used to simplify the set up of this package's 'slice' of the Redux store. See the
 * call to `ReducerRegistryInstance.registerReducer` in the initialize method for the package.
 * @example
 * Setting value
 * ```ts
 * StateManager.store.dispatch(setIsTraceAvailable(true));
 * ```
 * Getting value
 * ```ts
 * const isAvailable = getTestProviderState().isTraceAvailable;
 * ```
 */

interface TestProviderState {
  isTraceAvailable: boolean;
}

const initialState = {
  isTraceAvailable: false,
} as TestProviderState;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const TestProviderSliceName = "testProviderState";

/** the TestProvider "slice" of Redux state" */
export const providerSlice = createSlice({
  name: TestProviderSliceName,
  initialState,
  reducers: {
    setIsTraceAvailable: (state: TestProviderState, action: PayloadAction<boolean>) => {
      state.isTraceAvailable = action.payload;
    },
  },
});
export const { setIsTraceAvailable } = providerSlice.actions;

/** Get the slice of the redux state that is specific to this UI provider */
export function getTestProviderState(): TestProviderState {
  return StateManager.store.getState().testProviderState as TestProviderState;
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { StateManager } from "@itwin/appui-react";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Example use:
// StateManager.store.dispatch(setIsTraceAvailable(true));

interface TestProviderState {
  selectedFiberId: string;
  isTraceAvailable: boolean;
}

const initialState = {
  selectedFiberId: "",
  isTraceAvailable: false,
} as TestProviderState;

export const TestProviderSliceName = "testProviderState";

/** the TestProvider "slice" of Redux state" */
export const providerSlice = createSlice({
  name: TestProviderSliceName,
  initialState,
  reducers: {
    setSelectedFiber: (state: TestProviderState, action: PayloadAction<string>) => {
      state.selectedFiberId = action.payload;
    },
    clearSelectedFiber: (state: TestProviderState) => {
      state.selectedFiberId = "";
    },
    setIsTraceAvailable: (state: TestProviderState, action: PayloadAction<boolean>) => {
      state.isTraceAvailable = action.payload;
    },
  },
});
export const { setSelectedFiber, clearSelectedFiber, setIsTraceAvailable } = providerSlice.actions;

/** Get the slice of the redux state that is specific to this UI provider */
export function getTestProviderState(): TestProviderState {
  return StateManager.store.getState().testProviderState as TestProviderState;
}

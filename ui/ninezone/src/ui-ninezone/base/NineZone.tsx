/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import * as React from "react";
import { v4 } from "uuid";
import { NineZoneState, TabsState, WidgetsState, PanelsState, FloatingWidgetsState, NineZoneActionTypes, DraggedTabState } from "./NineZoneState";
import { CursorType } from "../widget-panels/CursorOverlay";
import { DragProvider, DraggedWidgetContext, DraggedResizeHandleContext, DraggedPanelSideContext } from "./DragManager";
import { PanelSide } from "../widget-panels/Panel";

/** @internal future */
export type NineZoneDispatch = (action: NineZoneActionTypes) => void;

/** @internal future */
export interface NineZoneProviderProps {
  children?: React.ReactNode;
  state: NineZoneState;
  dispatch: NineZoneDispatch;
}

/** @internal future */
export function NineZoneProvider(props: NineZoneProviderProps) {
  return (
    <NineZoneContext.Provider value={props.state}>
      <NineZoneDispatchContext.Provider value={props.dispatch}>
        <DraggedTabStateContext.Provider value={props.state.draggedTab}>
          <DraggedTabContext.Provider value={!!props.state.draggedTab}>
            <TabsStateContext.Provider value={props.state.tabs}>
              <WidgetsStateContext.Provider value={props.state.widgets}>
                <PanelsStateContext.Provider value={props.state.panels}>
                  <FloatingWidgetsStateContext.Provider value={props.state.floatingWidgets}>
                    <DragProvider>
                      <CursorTypeProvider>
                        {props.children}
                      </CursorTypeProvider>
                    </DragProvider>
                  </FloatingWidgetsStateContext.Provider>
                </PanelsStateContext.Provider>
              </WidgetsStateContext.Provider>
            </TabsStateContext.Provider>
          </DraggedTabContext.Provider>
        </DraggedTabStateContext.Provider>
      </NineZoneDispatchContext.Provider>
    </NineZoneContext.Provider>
  );
}

/** @internal */
export const NineZoneContext = React.createContext<NineZoneState>(null!); // tslint:disable-line: variable-name
NineZoneContext.displayName = "nz:NineZoneContext";

/** @internal */
export const NineZoneDispatchContext = React.createContext<NineZoneDispatch>(null!); // tslint:disable-line: variable-name
NineZoneDispatchContext.displayName = "nz:NineZoneDispatchContext";

/** @internal */
export const DraggedTabStateContext = React.createContext<DraggedTabState | undefined>(undefined); // tslint:disable-line: variable-name
DraggedTabStateContext.displayName = "nz:DraggedTabStateContext";

/** @internal */
export const DraggedTabContext = React.createContext<boolean>(false); // tslint:disable-line: variable-name
DraggedTabContext.displayName = "nz:DraggedTabContext";

/** @internal */
export const TabsStateContext = React.createContext<TabsState>(null!); // tslint:disable-line: variable-name
TabsStateContext.displayName = "nz:TabsStateContext";

/** @internal */
export const WidgetsStateContext = React.createContext<WidgetsState>(null!); // tslint:disable-line: variable-name
WidgetsStateContext.displayName = "nz:WidgetsStateContext";

/** @internal */
export const PanelsStateContext = React.createContext<PanelsState>(null!); // tslint:disable-line: variable-name
PanelsStateContext.displayName = "nz:PanelsStateContext";

/** @internal */
export const FloatingWidgetsStateContext = React.createContext<FloatingWidgetsState>(null!); // tslint:disable-line: variable-name
FloatingWidgetsStateContext.displayName = "nz:FloatingWidgetsStateContext";

/** @internal */
export const CursorTypeContext = React.createContext<CursorType | undefined>(undefined); // tslint:disable-line: variable-name
CursorTypeContext.displayName = "nz:CursorTypeContext";

function CursorTypeProvider(props: { children?: React.ReactNode }) {
  const draggedTab = React.useContext(DraggedTabContext);
  const draggedWidget = React.useContext(DraggedWidgetContext);
  const draggedPanelSide = React.useContext(DraggedPanelSideContext);
  const draggedResizeHandle = React.useContext(DraggedResizeHandleContext);
  let type: CursorType | undefined;
  if (draggedTab || draggedWidget)
    type = "grabbing";
  else if (draggedPanelSide)
    type = sideToCursorType(draggedPanelSide);
  else if (draggedResizeHandle)
    type = sideToCursorType(draggedResizeHandle);
  return (
    <CursorTypeContext.Provider value={type}>
      {props.children}
    </CursorTypeContext.Provider>
  );
}

/** @internal */
export function sideToCursorType(side: PanelSide): CursorType {
  switch (side) {
    case "bottom":
    case "top":
      return "ns-resize";
    case "left":
    case "right":
      return "ew-resize";
  }
}

/** @internal */
export function getUniqueId() {
  return v4();
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import * as React from "react";
import { v4 } from "uuid";
import { Rectangle, useRefs, useResizeObserver } from "@bentley/ui-core";
import { CursorType } from "../widget-panels/CursorOverlay";
import { PanelSide } from "../widget-panels/Panel";
import { WidgetContentManager } from "../widget/ContentManager";
import { FloatingWidgetResizeHandle } from "../widget/FloatingWidget";
import { DraggedPanelSideContext, DraggedResizeHandleContext, DraggedWidgetIdContext, DragProvider } from "./DragManager";
import {
  DraggedTabState, FloatingWidgetsState, NineZoneActionTypes, NineZoneState, PanelsState, TabsState, ToolSettingsState, WidgetsState,
} from "./NineZoneState";
import { assert } from "@bentley/bentleyjs-core";
import { WidgetTab } from "../widget/Tab";

/** @internal future */
export type NineZoneDispatch = (action: NineZoneActionTypes) => void;

/** @internal future */
export interface NineZoneProps {
  children?: React.ReactNode;
  dispatch: NineZoneDispatch;
  state: NineZoneState;
  labels?: NineZoneLabels;
  toolSettingsContent?: React.ReactNode;
  widgetContent?: React.ReactNode;
  tab?: React.ReactNode;
}

/** @internal */
export interface NineZoneLabels {
  dockToolSettingsTitle?: string;
  moreWidgetsTitle?: string;
  moreToolSettingsTitle?: string;
  pinPanelTitle?: string;
  resizeGripTitle?: string;
  sendWidgetHomeTitle?: string;
  toolSettingsHandleTitle?: string;
  unpinPanelTitle?: string;
}

/** @internal future */
export function NineZone(props: NineZoneProps) {
  const { children, ...providerProps } = props; // eslint-disable-line @typescript-eslint/no-unused-vars
  const measurerRef = React.useRef<HTMLDivElement>(null);
  const measure = React.useCallback<() => Rectangle>(() => {
    assert(!!measurerRef.current);
    return Rectangle.create(measurerRef.current.getBoundingClientRect());
  }, []);
  return (
    <NineZoneProvider
      measure={measure}
      {...providerProps}
    >
      <Measurer ref={measurerRef} />
      {props.children}
    </NineZoneProvider>
  );
}

/** @internal */
export interface NineZoneProviderProps extends NineZoneProps {
  measure: () => Rectangle;
}

const tab = <WidgetTab />;

/** @internal */
export function NineZoneProvider(props: NineZoneProviderProps) {
  return (
    <NineZoneContext.Provider value={props.state}>
      <NineZoneDispatchContext.Provider value={props.dispatch}>
        <NineZoneLabelsContext.Provider value={props.labels}>
          <WidgetContentNodeContext.Provider value={props.widgetContent}>
            <ToolSettingsNodeContext.Provider value={props.toolSettingsContent}>
              <TabNodeContext.Provider value={props.tab || tab}>
                <DraggedTabStateContext.Provider value={props.state.draggedTab}>
                  <DraggedTabContext.Provider value={!!props.state.draggedTab}>
                    <TabsStateContext.Provider value={props.state.tabs}>
                      <WidgetsStateContext.Provider value={props.state.widgets}>
                        <PanelsStateContext.Provider value={props.state.panels}>
                          <FloatingWidgetsStateContext.Provider value={props.state.floatingWidgets}>
                            <ToolSettingsStateContext.Provider value={props.state.toolSettings}>
                              <DragProvider>
                                <CursorTypeProvider>
                                  <WidgetContentManager>
                                    <MeasureContext.Provider value={props.measure}>
                                      {props.children}
                                    </MeasureContext.Provider>
                                  </WidgetContentManager>
                                </CursorTypeProvider>
                              </DragProvider>
                            </ToolSettingsStateContext.Provider>
                          </FloatingWidgetsStateContext.Provider>
                        </PanelsStateContext.Provider>
                      </WidgetsStateContext.Provider>
                    </TabsStateContext.Provider>
                  </DraggedTabContext.Provider>
                </DraggedTabStateContext.Provider>
              </TabNodeContext.Provider>
            </ToolSettingsNodeContext.Provider>
          </WidgetContentNodeContext.Provider>
        </NineZoneLabelsContext.Provider>
      </NineZoneDispatchContext.Provider>
    </NineZoneContext.Provider>
  );
}

/** @internal */
export const NineZoneContext = React.createContext<NineZoneState>(null!); // eslint-disable-line @typescript-eslint/naming-convention
NineZoneContext.displayName = "nz:NineZoneContext";

/** @internal */
export const NineZoneDispatchContext = React.createContext<NineZoneDispatch>(null!); // eslint-disable-line @typescript-eslint/naming-convention
NineZoneDispatchContext.displayName = "nz:NineZoneDispatchContext";

/** @internal */
export const NineZoneLabelsContext = React.createContext<NineZoneLabels | undefined>(undefined); // eslint-disable-line @typescript-eslint/naming-convention
NineZoneLabelsContext.displayName = "nz:NineZoneLabelsContext";

/** @internal */
export const DraggedTabStateContext = React.createContext<DraggedTabState | undefined>(undefined); // eslint-disable-line @typescript-eslint/naming-convention
DraggedTabStateContext.displayName = "nz:DraggedTabStateContext";

/** @internal */
export const DraggedTabContext = React.createContext<boolean>(false); // eslint-disable-line @typescript-eslint/naming-convention
DraggedTabContext.displayName = "nz:DraggedTabContext";

/** @internal */
export const TabsStateContext = React.createContext<TabsState>(null!); // eslint-disable-line @typescript-eslint/naming-convention
TabsStateContext.displayName = "nz:TabsStateContext";

/** @internal */
export const WidgetsStateContext = React.createContext<WidgetsState>(null!); // eslint-disable-line @typescript-eslint/naming-convention
WidgetsStateContext.displayName = "nz:WidgetsStateContext";

/** @internal */
export const PanelsStateContext = React.createContext<PanelsState>(null!); // eslint-disable-line @typescript-eslint/naming-convention
PanelsStateContext.displayName = "nz:PanelsStateContext";

/** @internal */
export const FloatingWidgetsStateContext = React.createContext<FloatingWidgetsState>(null!); // eslint-disable-line @typescript-eslint/naming-convention
FloatingWidgetsStateContext.displayName = "nz:FloatingWidgetsStateContext";

/** @internal */
export const CursorTypeContext = React.createContext<CursorType | undefined>(undefined); // eslint-disable-line @typescript-eslint/naming-convention
CursorTypeContext.displayName = "nz:CursorTypeContext";

/** @internal */
export const WidgetContentNodeContext = React.createContext<React.ReactNode>(undefined); // eslint-disable-line @typescript-eslint/naming-convention
WidgetContentNodeContext.displayName = "nz:WidgetContentNodeContext";

/** @internal */
export const ToolSettingsNodeContext = React.createContext<React.ReactNode>(undefined); // eslint-disable-line @typescript-eslint/naming-convention
ToolSettingsNodeContext.displayName = "nz:ToolSettingsNodeContext";

/** @internal */
export const TabNodeContext = React.createContext<React.ReactNode>(undefined); // eslint-disable-line @typescript-eslint/naming-convention
TabNodeContext.displayName = "nz:TabNodeContext";

/** @internal */
export const ToolSettingsStateContext = React.createContext<ToolSettingsState>(null!); // eslint-disable-line @typescript-eslint/naming-convention
ToolSettingsStateContext.displayName = "nz:ToolSettingsStateContext";

/** @internal */
export const MeasureContext = React.createContext<() => Rectangle>(null!); // eslint-disable-line @typescript-eslint/naming-convention
MeasureContext.displayName = "nz:MeasureContext";

function CursorTypeProvider(props: { children?: React.ReactNode }) {
  const draggedTab = React.useContext(DraggedTabContext);
  const draggedWidget = React.useContext(DraggedWidgetIdContext);
  const draggedPanelSide = React.useContext(DraggedPanelSideContext);
  const draggedResizeHandle = React.useContext(DraggedResizeHandleContext);
  let type: CursorType | undefined;
  if (draggedTab || draggedWidget)
    type = "grabbing";
  else if (draggedPanelSide)
    type = sideToCursorType(draggedPanelSide);
  else if (draggedResizeHandle)
    type = handleToCursorType(draggedResizeHandle);
  return (
    <CursorTypeContext.Provider value={type}>
      {props.children}
    </CursorTypeContext.Provider>
  );
}

const Measurer = React.forwardRef<HTMLDivElement>(function Measurer(_, ref) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const size = React.useRef<{ height?: number, width?: number }>({});
  const dispatch = React.useContext(NineZoneDispatchContext);
  const handleResize = React.useCallback((width, height) => {
    if (size.current.width === width && size.current.height === height)
      return;
    size.current.height = height;
    size.current.width = width;
    dispatch({
      type: "RESIZE",
      size: {
        height,
        width,
      },
    });
  }, [dispatch]);
  const roRef = useResizeObserver(handleResize);
  const refs = useRefs(ref, roRef);
  return (
    <div
      ref={refs}
      style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        top: "0",
        left: "0",
        visibility: "hidden",
      }}
    />
  );
});

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
export function handleToCursorType(handle: FloatingWidgetResizeHandle): CursorType {
  switch (handle) {
    case "bottom":
    case "top":
      return "ns-resize";
    case "left":
    case "right":
      return "ew-resize";
    case "topLeft":
    case "bottomRight":
      return "nwse-resize";
    case "topRight":
    case "bottomLeft":
      return "nesw-resize";
  }
}

/** @internal */
export function getUniqueId() {
  return v4();
}

/** @internal */
export function useLabel(labelKey: keyof NineZoneLabels) {
  const labels = React.useContext(NineZoneLabelsContext);
  return labels?.[labelKey];
}

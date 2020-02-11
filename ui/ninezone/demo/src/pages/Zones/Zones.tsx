/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import "@bentley/icons-generic-webfont/dist/bentley-icons-generic-webfont.css";
import * as React from "react";
import ToolSettings from "./ToolSettings";
import { ToolSettingProps } from "./ToolSetting";
import { WidgetPanels } from "@src/widget-panels/Panels";
import { NineZoneProvider, createNineZoneState, NineZoneStateReducer, addPanelWidget, addTab, useNineZoneDispatch, TOGGLE_PANEL_PINNED, TOGGLE_PANEL_SPAN, TOGGLE_PANEL_COLLAPSED, isHorizontalPanelState, usePanel, useWidget } from "@src/base/NineZone";
import "./Zones.scss";

let id = 0;
const getId = () => {
  return id++;
};

const useSettings = () => {
  const [settings, setSettings] = React.useState<ReadonlyArray<ToolSettingProps>>(() => [
    {
      id: `Checkbox ${getId()}`,
      type: "checkbox",
    },
    {
      id: `Checkbox ${getId()}`,
      type: "checkbox",
    },
    {
      id: `Select ${getId()}`,
      type: "select",
    },
    {
      id: `Select ${getId()}`,
      type: "select",
    },
    {
      id: `Select ${getId()}`,
      type: "select",
    },
    {
      id: `Select ${getId()}`,
      type: "select",
    },
  ]);
  return {
    settings,
    remove: () => {
      setSettings([
        ...settings.slice(0, -1),
      ]);
    },
    removeFromStart: () => {
      setSettings([
        ...settings.slice(1),
      ]);
    },
    add: () => {
      setSettings([
        ...settings,
        {
          id: `Checkbox ${getId()}`,
          type: "checkbox",
        },
      ]);
    },
    addToStart: () => {
      setSettings([
        {
          id: `Checkbox ${getId()}`,
          type: "checkbox",
        },
        ...settings,
      ]);
    },
    update: () => {
      const removed = settings[settings.length - 1];
      setSettings([
        ...settings.slice(0, -1),
        {
          ...removed,
          type: "select",
        },
      ]);
    },
  };
};

export default function Zones() {
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    return () => {
      document.documentElement.removeAttribute("data-theme");
    };
  }, []);
  const { settings, remove, removeFromStart, add, addToStart, update } = useSettings();
  const [state, dispatch] = React.useReducer(NineZoneStateReducer, {}, () => {
    let initialState = createNineZoneState();
    initialState = addPanelWidget(initialState, "left", "topLeft");
    initialState = addPanelWidget(initialState, "left", "centerLeft");
    initialState = addPanelWidget(initialState, "left", "bottomLeft");
    initialState = addPanelWidget(initialState, "right", "topRight");
    initialState = addPanelWidget(initialState, "top", "topPanel");
    initialState = addPanelWidget(initialState, "bottom", "bottomPanel1");
    initialState = addPanelWidget(initialState, "bottom", "bottomPanel2");
    initialState = addPanelWidget(initialState, "bottom", "bottomPanel3");
    initialState = addTab(initialState, "topLeft", "topLeft_1", { label: "Tab 1" });
    initialState = addTab(initialState, "topLeft", "topLeft_2", { label: "Tab 2" });
    initialState = addTab(initialState, "topLeft", "topLeft_3", { label: "Tab 3" });
    initialState = addTab(initialState, "bottomLeft", "bottomLeft_1", { label: "Tab 1" });
    initialState = addTab(initialState, "centerLeft", "centerLeft_1", { label: "Tab 1" });
    initialState = addTab(initialState, "topRight", "topRight_1", { label: "Tab 1" });
    initialState = addTab(initialState, "topPanel", "topPanel_1", { label: "Tab 1" });
    initialState = addTab(initialState, "bottomPanel1", "bottomPanel1_1", { label: "Tab 1" });
    initialState = addTab(initialState, "bottomPanel2", "bottomPanel2_1", { label: "Tab 1" });
    initialState = addTab(initialState, "bottomPanel3", "bottomPanel3_1", { label: "Tab 1" });
    return initialState;
  });
  return (
    <React.StrictMode>
      <NineZoneProvider
        state={state}
        dispatch={dispatch}
      >
        <div
          className="nzdemo-zones-zones"
        >
          <WidgetPanels
            className="nzdemo-widgetPanels"
            widgetContent={<WidgetContent />}
            centerContent={<div className="nzdemo-toolbars"><div /><div /></div>}
          >
            <button onClick={add}>Add</button>
            <button onClick={addToStart}>Add To Start</button>
            <button onClick={remove}>Remove</button>
            <button onClick={removeFromStart}>Remove From Start</button>
            <button onClick={update}>Update</button>
          </WidgetPanels>
          <ToolSettings
            settings={settings}
          />
        </div>
      </NineZoneProvider>
    </React.StrictMode >
  );
}

export function WidgetContent() {
  const panel = usePanel();
  const widget = useWidget();
  const dispatch = useNineZoneDispatch();
  const horizontalPanel = isHorizontalPanelState(panel) ? panel : undefined;
  return (
    <>
      {widget.activeTabId === undefined ? "No active tab" : `Active tab=${widget.activeTabId}`}
      <br />
      {panel.side}
      <button
        onClick={() => dispatch({
          type: TOGGLE_PANEL_PINNED,
          side: panel.side,
        })}
      >
        pinned={String(panel.pinned)}
      </button>
      <button
        onClick={() => dispatch({
          type: TOGGLE_PANEL_COLLAPSED,
          side: panel.side,
        })}
      >
        collapse
      </button>
      {horizontalPanel && <button
        onClick={() => dispatch({
          type: TOGGLE_PANEL_SPAN,
          side: horizontalPanel.side,
        })}
      >
        span={String(!!horizontalPanel.span)}
      </button>}
    </>
  );
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./ContentRenderer.scss";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { TabsStateContext, ToolSettingsNodeContext, WidgetContentNodeContext } from "../base/NineZone";
import { TabState, toolSettingsTabId } from "../base/NineZoneState";
import { WidgetContentContainersContext, WidgetContentManagerContext } from "./ContentManager";

/** @internal */
export const WidgetContentRenderers = React.memo(function WidgetContentRenderers() { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const widgetContent = React.useContext(WidgetContentNodeContext);
  const toolSettingsContent = React.useContext(ToolSettingsNodeContext);
  const widgetContentContainers = React.useContext(WidgetContentContainersContext);
  const tabs = React.useContext(TabsStateContext);
  const tabEntries = Object.entries(tabs);
  return (
    <>
      {tabEntries.map(([, tab]) => {
        const container = widgetContentContainers[tab.id];
        const children = tab.id === toolSettingsTabId ? toolSettingsContent : widgetContent;
        return <WidgetContentRenderer
          children={children} // eslint-disable-line react/no-children-prop
          key={tab.id}
          renderTo={container}
          tabId={tab.id}
        />;
      })}
    </>
  );
});

interface WidgetContentRendererProps {
  children?: React.ReactNode;
  renderTo: Element | null | undefined;
  tabId: TabState["id"];
}

/** @internal */
export const WidgetContentRenderer = React.memo(function WidgetContentRenderer(props: WidgetContentRendererProps) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const widgetContentManager = React.useContext(WidgetContentManagerContext);
  const container = React.useRef<HTMLDivElement>(undefined!);
  if (!container.current) {
    container.current = document.createElement("div");
    container.current.classList.add("nz-widget-contentRenderer");
  }
  React.useLayoutEffect(() => {
    const parent = props.renderTo;
    if (parent) {
      while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
      }

      parent.appendChild(container.current);
      widgetContentManager.onRestoreTransientState.emit(props.tabId);
    }
    return () => {
      for (const child of parent?.children || []) {
        if (child === container.current) {
          parent!.removeChild(child);
          return;
        }
      }
    };
  }, [props.renderTo, widgetContentManager, props.tabId]);
  return ReactDOM.createPortal(
    <TabIdContext.Provider value={props.tabId}>
      {props.children}
    </TabIdContext.Provider>,
    container.current,
  );
});

/** @internal */
export const TabIdContext = React.createContext<TabState["id"]>(""); // eslint-disable-line @typescript-eslint/naming-convention
TabIdContext.displayName = "nz:TabIdContext";

/** @internal */
export function useTabTransientState(tabId: string, onSave?: () => void, onRestore?: () => void) {
  const widgetContentManager = React.useContext(WidgetContentManagerContext);
  React.useEffect(() => {
    const handleSaveTransientState = (id: TabState["id"]) => {
      tabId === id && onSave && onSave();
    };
    widgetContentManager.onSaveTransientState.add(handleSaveTransientState);
    return () => {
      widgetContentManager.onSaveTransientState.remove(handleSaveTransientState);
    };
  }, [widgetContentManager, onSave, tabId]);
  React.useEffect(() => {
    const handleRestoreTransientState = (id: TabState["id"]) => {
      tabId === id && onRestore && onRestore();
    };
    widgetContentManager.onRestoreTransientState.add(handleRestoreTransientState);
    return () => {
      widgetContentManager.onRestoreTransientState.remove(handleRestoreTransientState);
    };
  }, [widgetContentManager, onRestore, tabId]);
}

/** @internal */
export function useTransientState(onSave?: () => void, onRestore?: () => void) {
  const tabId = React.useContext(TabIdContext);
  return useTabTransientState(tabId, onSave, onRestore);
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";
import * as ReactDOM from "react-dom";
import { WidgetContentManagerContext, WidgetContentContainersContext } from "./ContentManager";
import { TabsStateContext, WidgetContentNodeContext } from "../base/NineZone";
import { TabState } from "../base/NineZoneState";
import "./ContentRenderer.scss";

/** @internal */
export const WidgetContentRenderers = React.memo(function WidgetContentRenderers() { // tslint:disable-line: variable-name no-shadowed-variable
  const widgetContentContainers = React.useContext(WidgetContentContainersContext);
  const tabs = React.useContext(TabsStateContext);
  const tabEntries = Object.entries(tabs);
  return (
    <>
      {tabEntries.map(([, tab]) => {
        const container = widgetContentContainers[tab.id];
        return <WidgetContentRenderer
          key={tab.id}
          renderTo={container}
          tabId={tab.id}
        />;
      })}
    </>
  );
});

interface WidgetContentRendererProps {
  renderTo: Element | null | undefined;
  tabId: TabState["id"];
}

/** @internal */
export const WidgetContentRenderer = React.memo(function WidgetContentRenderer(props: WidgetContentRendererProps) { // tslint:disable-line: variable-name no-shadowed-variable
  const widgetContent = React.useContext(WidgetContentNodeContext);
  const widgetContentManager = React.useContext(WidgetContentManagerContext);
  const container = React.useRef(document.createElement("div"));
  container.current.className = "nz-widget-contentRenderer";
  React.useEffect(() => {
    const parent = props.renderTo;
    const child = container.current;
    if (parent) {
      parent.appendChild(child);
      widgetContentManager.onRestoreTransientState.emit(props.tabId);
    }
    return () => {
      parent?.removeChild(child);
    };
  }, [props.renderTo, widgetContentManager, props.tabId]);
  return ReactDOM.createPortal(
    <TabIdContext.Provider value={props.tabId}>
      {widgetContent}
    </TabIdContext.Provider>,
    container.current,
  );
});

/** @internal */
export const TabIdContext = React.createContext<TabState["id"]>(""); // tslint:disable-line: variable-name
TabIdContext.displayName = "nz:TabIdContext";

/** @internal */
export function useTransientState(onSave?: () => void, onRestore?: () => void) {
  const widgetContentManager = React.useContext(WidgetContentManagerContext);
  const tabId = React.useContext(TabIdContext);
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

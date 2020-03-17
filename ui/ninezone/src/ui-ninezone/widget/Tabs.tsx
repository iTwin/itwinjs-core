/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";
import { useResizeObserver } from "@bentley/ui-core";
import { useOverflow, getChildKey } from "../tool-settings/Docked";
import { WidgetOverflow } from "./Overflow";
import { isHorizontalPanelSide, PanelSideContext } from "../widget-panels/Panel";
import { WidgetTab } from "./Tab";
import { WidgetTabTarget } from "./TabTarget";
import { WidgetStateContext } from "./Widget";
import { assert } from "../base/assert";
import { TabsStateContext } from "../base/NineZone";
import "./Tabs.scss";

// tslint:disable: no-console

/** @internal */
export const WidgetTabs = React.memo(function WidgetTabs() { // tslint:disable-line: variable-name no-shadowed-variable
  const tabs = React.useContext(TabsStateContext);
  const side = React.useContext(PanelSideContext);
  const widget = React.useContext(WidgetStateContext);
  assert(widget);
  const children = React.useMemo<React.ReactNode>(() => {
    const activeIndex = widget.activeTabId ? widget.tabs.indexOf(widget.activeTabId) : undefined;
    return widget.tabs.map((tabId, index, array) => {
      const firstInactive = activeIndex === undefined ? undefined : activeIndex + 1 === index;
      return (
        <React.Fragment
          key={tabId}
        >
          {index === 0 && <WidgetTabTarget
            tabIndex={index}
            first
          />}
          <WidgetTab
            first={index === 0}
            firstInactive={firstInactive}
            last={index === array.length - 1}
            tab={tabs[tabId]}
          />
          <WidgetTabTarget
            tabIndex={index}
          />
        </React.Fragment>
      );
    });
  }, [widget, tabs]);
  const [overflown, handleResize, handleOverflowResize, handleEntryResize] = useOverflow(children);
  const horizontal = side && isHorizontalPanelSide(side);
  const ref = useResizeObserver(handleResize);
  const childrenArray = React.useMemo(() => React.Children.toArray(children), [children]);
  const tabChildren = childrenArray.reduce<Array<[string, React.ReactNode]>>((acc, child, index) => {
    const key = getChildKey(child, index);
    if (!overflown) {
      acc.push([key, child]);
      return acc;
    }
    if (horizontal && widget.minimized)
      return acc;
    overflown.indexOf(key) < 0 && acc.push([key, child]);
    return acc;
  }, []);
  const panelChildren = tabChildren.length !== childrenArray.length ? childrenArray.map<[string, React.ReactNode]>((child, index) => {
    const key = getChildKey(child, index);
    return [key, child];
  }) : [];
  return (
    <div
      className="nz-widget-tabs"
      ref={ref}
    >
      {tabChildren.map(([key, child], index, array) => {
        return (
          <WidgetTabsEntryProvider
            children={child}
            key={key}
            id={key}
            lastNotOverflown={index === array.length - 1 && panelChildren.length > 0}
            getOnResize={handleEntryResize}
          />
        );
      })}
      <WidgetOverflow
        hidden={overflown && panelChildren.length === 0}
        onResize={handleOverflowResize}
      >
        {panelChildren.map(([key, child]) => {
          return (
            <React.Fragment
              key={key}
            >
              {child}
            </React.Fragment>
          );
        })}
      </WidgetOverflow>
    </div>
  );
});

interface WidgetTabsEntryContextArgs {
  readonly lastNotOverflown: boolean;
  readonly onResize?: (w: number) => void;
}

/** @internal */
export const WidgetTabsEntryContext = React.createContext<WidgetTabsEntryContextArgs | undefined>(undefined); // tslint:disable-line: variable-name
WidgetTabsEntryContext.displayName = "nz:WidgetTabsEntryContext";

/** @internal */
export interface WidgetTabsEntryContextProviderProps {
  children?: React.ReactNode;
  id: string;
  getOnResize: (id: string) => (w: number) => void;
  lastNotOverflown: boolean;
}

/** @internal */
export const WidgetTabsEntryProvider = React.memo<WidgetTabsEntryContextProviderProps>(function WidgetTabsEntryProvider(props) { // tslint:disable-line: variable-name no-shadowed-variable
  return (
    <WidgetTabsEntryContext.Provider value={{
      lastNotOverflown: props.lastNotOverflown,
      onResize: props.getOnResize(props.id),
    }}>
      {props.children}
    </WidgetTabsEntryContext.Provider>
  );
});

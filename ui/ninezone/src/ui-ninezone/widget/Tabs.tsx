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
import { useWidgetPanelSide, isHorizontalWidgetPanelSide } from "../widget-panels/Panel";
import { useWidget } from "../base/NineZone";
import { WidgetTab } from "./Tab";
import "./Tabs.scss";

/** @internal */
export function WidgetTabs() {
  const side = useWidgetPanelSide();
  const widget = useWidget();
  const children = React.useMemo<React.ReactNode>(() => {
    return widget.tabs.map((tabId) => {
      return (
        <WidgetTab
          id={tabId}
          key={tabId}
        />
      );
    });
  }, [widget]);
  const [overflown, handleResize, handleOverflowResize, handleEntryResize] = useOverflow(children);
  const horizontal = isHorizontalWidgetPanelSide(side);
  const ref = useResizeObserver(handleResize);

  const childrenArray = React.Children.toArray(children);
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
      {tabChildren.map(([key, child]) => {
        const onEntryResize = handleEntryResize(key);
        return (
          <WidgetTabContext.Provider
            key={key}
            value={{
              isOverflown: false,
              onResize: onEntryResize,
            }}
          >
            {child}
          </WidgetTabContext.Provider>
        );
      })}
      {(!overflown || panelChildren.length > 0) && (
        <WidgetTabContext.Provider
          value={{
            isOverflown: false,
            onResize: handleOverflowResize,
          }}
        >
          <WidgetOverflow>
            {panelChildren.map(([key, child]) => {
              return (
                <WidgetTabContext.Provider
                  key={key}
                  value={{
                    isOverflown: true,
                  }}
                >
                  {child}
                </WidgetTabContext.Provider>
              );
            })}
          </WidgetOverflow>
        </WidgetTabContext.Provider>
      )}
    </div>
  );
}

interface WidgetTabContextArgs {
  readonly isOverflown: boolean;
  readonly onResize?: (w: number) => void;
}

/** @internal */
export const WidgetTabContext = React.createContext<WidgetTabContextArgs>(null!); // tslint:disable-line: variable-name

/** @internal */
export function useWidgetTab() {
  return React.useContext(WidgetTabContext);
}

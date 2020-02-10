/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ToolSettings */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { useResizeObserver } from "../base/useResizeObserver";
import { useOverflow, getChildKey } from "../tool-settings/Docked";
import { usePane } from "../widget-panels/Panes";
import { WidgetOverflow } from "./Overflow";
import "./Tabs.scss";

/** Properties of [[WidgetTabs]] component.
 * @internal future
 */
export interface WidgetTabsProps extends CommonProps {
  /** Tool settings content. */
  children?: React.ReactNode;
}

/** @internal */
export function WidgetTabs(props: WidgetTabsProps) {
  const [overflown, handleResize, handleOverflowResize, handleEntryResize] = useOverflow(props.children);
  const pane = usePane();
  const ref = useResizeObserver(handleResize);

  const childrenArray = React.Children.toArray(props.children);
  const children = childrenArray.reduce<Array<[string, React.ReactNode]>>((acc, child, index) => {
    const key = getChildKey(child, index);
    if (pane.horizontal && pane.minimized)
      return acc;
    if (!overflown || overflown.indexOf(key) < 0) {
      acc.push([key, child]);
    }
    return acc;
  }, []);
  const panelChildren = overflown ? childrenArray.map<[string, React.ReactNode]>((child, index) => {
    const key = getChildKey(child, index);
    return [key, child];
  }) : [];
  const className = classnames(
    "nz-widget-tabs",
    props.className,
  );
  return (
    <div
      className={className}
      ref={ref}
      style={props.style}
    >
      {children.map(([key, child]) => {
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
      {(!overflown || overflown.length > 0) && (
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
export const WidgetTabContext = React.createContext<WidgetTabContextArgs>({ // tslint:disable-line: variable-name
  isOverflown: false,
});

/** @internal */
export function useWidgetTab() {
  return React.useContext(WidgetTabContext);
}

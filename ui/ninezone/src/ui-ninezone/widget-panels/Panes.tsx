/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WidgetPanels */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { getChildKey } from "../tool-settings/Docked";
import { Pane } from "./Pane";
import "./Panes.scss";

/** @internal future */
export interface PanesProps extends CommonProps {
  children?: React.ReactNode;
  horizontal?: boolean;
}

/** @internal future */
export function Panes(props: PanesProps) {
  const [panes, panesApi] = usePanes(props.children);
  const className = classnames(
    "nz-widgetPanels-panes",
    props.horizontal && "nz-horizontal",
    props.className,
  );
  const children = React.Children.toArray(props.children);
  return (
    <div
      className={className}
      style={props.style}
    >
      {children.map((child, index) => {
        const key = getChildKey(child, index);
        const pane = panes[index];
        return (
          <PaneContext.Provider
            key={key}
            value={{
              horizontal: !!props.horizontal,
              minimized: pane.minimized,
              onExpand: () => {
                panesApi.expand(index);
              },
              onMinimize: () => {
                panesApi.minimize(index);
              },
              onRestore: () => {
                panesApi.restore(index);
              },
            }}
          >
            <Pane
              key={key}
              minimized={pane.minimized}
              size={pane.size}
            >
              {child}
            </Pane>
          </PaneContext.Provider>
        );
      })}
    </div>
  );
}

/** @internal */
interface Pane {
  readonly size: number;
  readonly minimized: boolean;
}

type Panes = ReadonlyArray<Pane>;

interface PanesApi {
  expand: (index: number) => void;
  minimize: (index: number) => void;
  restore: (index: number) => void;
}

/** @internal */
export interface PaneContextArgs {
  horizontal: boolean;
  minimized: boolean;
  onExpand: () => void;
  onMinimize: () => void;
  onRestore: () => void;
}

/** @internal */
// tslint:disable-next-line: variable-name
export const paneContextDefaultValue: PaneContextArgs = {
  horizontal: false,
  minimized: false,
  onExpand: () => { },
  onMinimize: () => { },
  onRestore: () => { },
};

/** @internal */
export const PaneContext = React.createContext<PaneContextArgs>(paneContextDefaultValue); // tslint:disable-line: variable-name

/** @internal future */
export const usePane = () => {
  return React.useContext(PaneContext);
};

/** @internal */
export const usePanes = (children: React.ReactNode): [
  Panes,
  PanesApi,
] => {
  const [panes, setPanes] = React.useState<ReadonlyArray<Pane>>(() => {
    const childrenArray = React.Children.toArray(children);
    const size = 100 / childrenArray.length;
    return childrenArray.map(() => {
      return {
        minimized: false,
        size,
      };
    });
  });
  const expand = React.useCallback((paneIndex: number) => {
    setPanes((prevPanes) => {
      return prevPanes.reduce((acc, _, index) => {
        if (paneIndex === index) {
          return [
            ...acc.slice(0, index),
            {
              ...acc[index],
              minimized: false,
            },
            ...acc.slice(index + 1),
          ];
        }
        return [
          ...acc.slice(0, index),
          {
            ...acc[index],
            minimized: true,
          },
          ...acc.slice(index + 1),
        ];
      }, prevPanes);
    });
  }, []);
  const minimize = React.useCallback((paneIndex: number) => {
    setPanes((prevPanes) => {
      const prevMaximized = prevPanes.filter((prevPane) => !prevPane.minimized);
      if (prevMaximized.length <= 1)
        return prevPanes;
      return [
        ...prevPanes.slice(0, paneIndex),
        {
          ...prevPanes[paneIndex],
          minimized: true,
        },
        ...prevPanes.slice(paneIndex + 1),
      ];
    });
  }, []);
  const restore = React.useCallback((paneIndex: number) => {
    setPanes((prevPanes) => {
      return [
        ...prevPanes.slice(0, paneIndex),
        {
          ...prevPanes[paneIndex],
          minimized: false,
        },
        ...prevPanes.slice(paneIndex + 1),
      ];
    });
  }, []);
  const panesApi = React.useMemo(() => {
    return {
      expand,
      minimize,
      restore,
    };
  }, [expand, minimize, restore]);
  return [panes, panesApi];
};

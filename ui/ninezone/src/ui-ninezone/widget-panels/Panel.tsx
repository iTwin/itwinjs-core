/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WidgetPanels */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Panel.scss";

/** @internal future */
export type WidgetPanelSide = "left" | "top" | "right" | "bottom";

/** Common properties of [[WidgetPanel]] component.
 * @internal
 */
export interface CommonWidgetPanelProps extends CommonProps {
  children?: React.ReactNode;
  captured?: boolean;
  collapsed?: boolean;
  onInitialize?: (size: number) => void;
  grip?: React.ReactNode;
  side: "left" | "top" | "right" | "bottom";
  size?: number;
}

/** Properties of vertical [[WidgetPanel]] component.
 * @internal
 */
export interface VerticalWidgetPanelProps extends CommonWidgetPanelProps {
  side: "left" | "right";
  spanTop?: boolean;
  spanBottom?: boolean;
}

/** Properties of horizontal [[WidgetPanel]] component.
 * @internal
 */
export interface HorizontalWidgetPanelProps extends CommonWidgetPanelProps {
  span?: boolean;
  side: "top" | "bottom";
}

/** Properties of [[WidgetPanel]] component.
 * @internal
 */
export type WidgetPanelProps = VerticalWidgetPanelProps | HorizontalWidgetPanelProps;

const isHorizontalWidgetPanelProps = (props: WidgetPanelProps): props is HorizontalWidgetPanelProps => {
  return isHorizontalWidgetPanelSide(props.side);
};

/** @internal */
export const isHorizontalWidgetPanelSide = (side: WidgetPanelSide): side is "top" | "bottom" => {
  return side === "top" || side === "bottom";
};

/** Widget panel component.
 * @internal
 */
export function WidgetPanel(props: WidgetPanelProps) {
  const latestProps = React.useRef(props);
  const horizontalProps = isHorizontalWidgetPanelProps(props) ? props : undefined;
  const verticalProps = !isHorizontalWidgetPanelProps(props) ? props : undefined;
  const sizeStyle = props.size === undefined ? undefined
    : verticalProps ? { width: `${props.size}px` }
      : { height: `${props.size}px` };
  const style = {
    ...props.collapsed ? undefined : sizeStyle,
    ...props.style,
  };
  const contentStyle = {
    ...props.collapsed ? sizeStyle : undefined,
  };
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const bounds = ref.current!.getBoundingClientRect();
    const size = isHorizontalWidgetPanelSide(latestProps.current.side) ? bounds.height : bounds.width;
    latestProps.current.onInitialize && latestProps.current.onInitialize(size);
  }, []);
  const className = classnames(
    "nz-widgetPanels-panel",
    `nz-${props.side}`,
    props.collapsed && "nz-collapsed",
    props.captured && "nz-captured",
    horizontalProps && horizontalProps.span && "nz-span",
    verticalProps && verticalProps.spanTop && "nz-span-top",
    verticalProps && verticalProps.spanBottom && "nz-span-bottom",
    props.className,
  );
  return (
    <div
      className={className}
      ref={ref}
      style={style}
    >
      <div>
        <div
          className="nz-content"
          style={contentStyle}
        >
          {props.children}
        </div>
        {props.grip}
      </div>
    </div>
  );
}

/** Properties of common widget panel.
 * @internal future
 */
export interface WidgetPanel {
  readonly collapsed: boolean;
  readonly pinned: boolean;
  readonly toggleCollapse: () => void;
  readonly initialize: (size: number) => void;
  readonly size: number | undefined;
  readonly resize: (by: number) => void;
}

/** Properties of horizontal widget panel.
 * @internal future
 */
export interface HorizontalWidgetPanel extends WidgetPanel {
  readonly span: boolean;
}

/** Properties of common widget panel.
 * @internal future
 */
export interface WidgetPanelApi {
  readonly maxSize: number;
  readonly minSize: number;
  readonly setPinned: (pinned: boolean) => void;
}

/** Properties of horizontal widget panel.
 * @internal future
 */
export interface HorizontalWidgetPanelApi extends WidgetPanelApi {
  readonly setSpan: (span: boolean) => void;
}

interface WidgetPanelReducerState {
  readonly collapsed: boolean;
  readonly maxSize: number;
  readonly minSize: number;
  readonly size: number | undefined;
}

interface WidgetPanelReducerToggleCollapseAction {
  readonly type: "toggleCollapse";
}

interface WidgetPanelReducerResizeAction {
  readonly collapseOffset: number;
  readonly resizeBy: number;
  readonly type: "resize";
}

interface WidgetPanelReducerInitializeAction {
  readonly size: number;
  readonly type: "initialize";
}

type WidgetPanelReducerAction =
  WidgetPanelReducerResizeAction |
  WidgetPanelReducerInitializeAction |
  WidgetPanelReducerToggleCollapseAction;

const widgetPanelReducer = (state: WidgetPanelReducerState, action: WidgetPanelReducerAction): WidgetPanelReducerState => {
  switch (action.type) {
    case "initialize": {
      const size = Math.min(Math.max(action.size, state.minSize), state.maxSize);
      return {
        ...state,
        size,
      };
    }
    case "resize": {
      if (state.size === undefined)
        return state;

      const requestedSize = state.size + action.resizeBy;
      if (state.collapsed) {
        if (action.resizeBy >= action.collapseOffset)
          return {
            ...state,
            collapsed: false,
          };
        return state;
      }

      const collapseThreshold = Math.max(state.minSize - action.collapseOffset, 0);
      if (requestedSize <= collapseThreshold) {
        return {
          ...state,
          collapsed: true,
          size: state.minSize,
        };
      }

      return {
        ...state,
        size: Math.min(Math.max(requestedSize, state.minSize), state.maxSize),
      };
    }
    case "toggleCollapse": {
      return {
        ...state,
        collapsed: !state.collapsed,
      };
    }
  }
};

const initialLeftWidgetPanelReducerState: WidgetPanelReducerState = {
  collapsed: false,
  maxSize: 600,
  minSize: 200,
  size: undefined,
};

/** @internal */
export const useWidgetPanelApi = (): [WidgetPanel, WidgetPanelApi] => {
  const [state, dispatch] = React.useReducer(widgetPanelReducer, initialLeftWidgetPanelReducerState);
  const [pinned, setPinned] = React.useState(true);
  const resize = React.useCallback((resizeBy: number) => {
    dispatch({
      collapseOffset: 100,
      resizeBy,
      type: "resize",
    });
  }, []);
  const initialize = React.useCallback((size: number) => {
    dispatch({
      size,
      type: "initialize",
    });
  }, []);
  const toggleCollapse = React.useCallback(() => {
    dispatch({
      type: "toggleCollapse",
    });
  }, []);
  const panel = React.useMemo(() => ({
    collapsed: state.collapsed,
    pinned,
    initialize,
    resize,
    toggleCollapse,
    size: state.size,
  }), [state, pinned, initialize, resize, toggleCollapse]);
  const api = React.useMemo(() => ({
    maxSize: state.maxSize,
    minSize: state.minSize,
    setPinned,
  }), [state, setPinned]);
  return [panel, api];
};

/** @internal */
export const useHorizontalPanelApi = (): [HorizontalWidgetPanel, HorizontalWidgetPanelApi] => {
  const [commonPanel, commonPanelApi] = useWidgetPanelApi();
  const [span, setSpan] = React.useState(true);
  const panel = React.useMemo(() => ({
    ...commonPanel,
    span,
  }), [commonPanel, span]);
  const api = React.useMemo(() => ({
    ...commonPanelApi,
    setSpan,
  }), [commonPanelApi]);
  return [panel, api];
};

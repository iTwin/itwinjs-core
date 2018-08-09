/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import { Edge } from "../utilities/Rectangle";
import Content from "./rectangular/Content";
import ResizeGrip, { ResizeDirection } from "./rectangular/ResizeGrip";
import ResizeHandle from "./rectangular/ResizeHandle";
import CommonProps, { NoChildrenProps } from "../utilities/Props";
import "./Stacked.scss";

/** Available [[Stacked]] widget anchor directions. */
export enum Anchor {
  Left,
  Right,
}

/** Properties of [[Stacked]] component. */
export interface StackedProps extends CommonProps, NoChildrenProps {
  /** Describes to which side the widget is anchored. */
  anchor?: Anchor;
  /** Content of this widget. */
  content?: React.ReactNode;
  /** True if widget is open, false otherwise. */
  isOpen?: boolean;
  /** Function called when resize action is performed. */
  onResize?: (x: number, y: number, handle: ResizeHandle) => void;
  /** One or more tabs/separators. See: [[Draggable]], [[TabSeparator]], [[Tab]] */
  tabs?: React.ReactNode;
}

/**
 * Stacked widget is used to display multiple tabs and some content.
 * @note Should be placed in [[Zone]] component.
 */
// tslint:disable-next-line:variable-name
export const Stacked: React.StatelessComponent<StackedProps> = (props: StackedProps) => {
  const className = classnames(
    "nz-widget-stacked",
    props.anchor === Anchor.Left && "nz-left-anchor",
    !props.isOpen && "nz-is-closed",
    props.className);

  return (
    <div className={className} style={props.style}>
      <div className="nz-content-area">
        <Content
          className="nz-content"
          anchor={props.anchor}
          content={props.content}
        />
        <ResizeGrip
          className="nz-bottom-grip"
          direction={ResizeDirection.NorthSouth}
          onResize={(_x, y) => { props.onResize && props.onResize(0, y, Edge.Bottom); }}
        />
        <ResizeGrip
          className="nz-right-grip"
          direction={ResizeDirection.EastWest}
          onResize={(x) => { props.onResize && props.onResize(x, 0, Edge.Right); }}
        />
      </div>
      <div className="nz-tabs-column">
        <div className="nz-tabs">
          {props.tabs}
        </div>
        <div className="nz-left-grip-container">
          <ResizeGrip
            className="nz-left-grip"
            direction={ResizeDirection.EastWest}
            onResize={(x) => { props.onResize && props.onResize(x, 0, Edge.Left); }}
          />
        </div>
      </div>
      <ResizeGrip
        className="nz-top-grip"
        direction={ResizeDirection.NorthSouth}
        onResize={(_x, y) => { props.onResize && props.onResize(0, y, Edge.Top); }}
      />
    </div>
  );
};

export default Stacked;

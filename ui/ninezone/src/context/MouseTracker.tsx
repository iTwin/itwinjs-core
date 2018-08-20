/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utilities */

import * as React from "react";

/** Properties of [[MouseTracker]] component. */
export interface MouseTrackerProps {
  /** Function called when mouse coordinates changes. */
  onCoordinatesChange?: (x: number, y: number) => void;
}

/**
 * This component listens and reports the mousemove events.
 * @note Does not render.
 */
export default class MouseTracker extends React.Component<MouseTrackerProps> {
  public componentDidMount() {
    document.addEventListener("mousemove", this._handleMouseMove);
  }

  public componentWillUnmount() {
    document.removeEventListener("mousemove", this._handleMouseMove);
  }

  public render() {
    return null;
  }

  private _handleMouseMove = (e: MouseEvent) => {
    this.changeCoordinates(e.clientX, e.clientY);
  }

  private changeCoordinates(x: number, y: number) {
    this.props.onCoordinatesChange && this.props.onCoordinatesChange(x, y);
  }
}

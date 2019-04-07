/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module TileLoading */

import * as React from "react";
import classnames from "classnames";
import { ScreenViewport, IModelApp } from "@bentley/imodeljs-frontend";
import { LoadingBar } from "@bentley/ui-core";
import { CommonProps } from "@bentley/ui-ninezone";
import "./TileLoadingIndicator.scss";

let onViewOpen: (vp: ScreenViewport) => void;
let onRenderUpdate: () => void;
let cancelUpdate: () => boolean;

/** State for the [[TileLoadingIndicator]] component
 * @internal
 */
interface TileLoadingIndicatorState {
  label: string;
  progress: number;
  enabled: boolean;
  finished: boolean;
}

/** TileLoadingIndicator React component
 * @internal
 */
export class TileLoadingIndicator extends React.PureComponent<CommonProps, TileLoadingIndicatorState> {
  constructor(props?: any, context?: any) {
    super(props, context);
    this.state = { label: "", progress: 0, enabled: false, finished: true };
  }

  private _update(vp: ScreenViewport) {
    const requested = vp.numRequestedTiles;
    const ready = vp.numReadyTiles;
    const total = ready + requested;
    const pctComplete = (total > 0) ? (ready / total) * 100 : 100;
    let enabled = this.state.enabled;
    let finished = this.state.finished;

    if (!enabled && total !== 0 && pctComplete !== 100)
      enabled = true;

    if (enabled && (total === 0 || pctComplete === 100))
      enabled = false;

    if (pctComplete === 100 && !finished) {
      finished = true;
      console.log(`Tiles Finished Loading`); // tslint:disable-line
      console.log(`Tiles Load Report (tiles finished / tiles requested):  ${ready} / ${total}`); // tslint:disable-line
    }

    if (pctComplete !== 100 && finished)
      finished = false;

    this.setState({ label: `${ready} / ${total}`, progress: pctComplete, enabled, finished });
  }

  private _onViewOpen(vp: ScreenViewport) {
    onRenderUpdate = () => this._update(vp);

    vp.onRender.addListener(onRenderUpdate);
    cancelUpdate = () => vp.onRender.removeListener(onRenderUpdate);
  }

  public componentDidMount() {
    // get selected viewport
    const vp = IModelApp.viewManager.selectedView;

    // if view exists bind update routine to onRender loop, otherwise do so once the onViewOpen event runs
    if (vp) {
      this._onViewOpen(vp);
    } else {
      onViewOpen = (_vp: ScreenViewport) => this._onViewOpen(_vp);
      IModelApp.viewManager.onViewOpen.addListener(onViewOpen);
    }
  }

  public componentWillUnmount() {
    if (onViewOpen)
      IModelApp.viewManager.onViewOpen.removeListener(onViewOpen);

    if (cancelUpdate)
      cancelUpdate();
  }

  /** Renders TileLoadingIndicator */
  public render() {
    const classes = classnames("uifw-tile-loading-bar", this.state.enabled && "uifw-tile-loading-bar-visible", this.props.className);
    return (
      <div className={classes} style={this.props.style}>
        <span>{this.state.label}</span>
        <LoadingBar percent={this.state.progress} barHeight={5} />
      </div>
    );
  }
}

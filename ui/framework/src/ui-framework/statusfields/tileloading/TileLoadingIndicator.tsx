/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import * as React from "react";
import classnames from "classnames";

import { Logger } from "@bentley/bentleyjs-core";
import { ScreenViewport, IModelApp } from "@bentley/imodeljs-frontend";
import { LoadingBar } from "@bentley/ui-core";
import { UiFramework } from "../../UiFramework";
import { StatusFieldProps } from "../StatusFieldProps";

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
 * @beta
 */
export class TileLoadingIndicator extends React.PureComponent<StatusFieldProps, TileLoadingIndicatorState> {
  constructor(props: StatusFieldProps) {
    super(props);
    this.state = { label: "", progress: 0, enabled: false, finished: true };
  }

  private _update(vp: ScreenViewport) {
    const requested = vp.numRequestedTiles;
    const ready = vp.numReadyTiles;
    const total = ready + requested;
    const pctComplete = (total > 0) ? (ready / total) * 100 : 100;
    let enabled = this.state.enabled;
    let finished = this.state.finished;

    // istanbul ignore else
    if (!enabled && total !== 0 && pctComplete !== 100)
      enabled = true;

    if (enabled && (total === 0 || pctComplete === 100))
      enabled = false;

    if (pctComplete === 100 && !finished) {
      finished = true;
      Logger.logTrace(UiFramework.loggerCategory(this), `Tiles Finished Loading`);
      Logger.logTrace(UiFramework.loggerCategory(this), `Tiles Load Report (tiles finished / tiles requested):  ${ready} / ${total}`);
    }

    // istanbul ignore else
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
    // istanbul ignore next
    if (!IModelApp.viewManager)
      return;

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
    // istanbul ignore next
    if (!IModelApp.viewManager)
      return;

    // istanbul ignore else
    if (onViewOpen)
      IModelApp.viewManager.onViewOpen.removeListener(onViewOpen);

    if (cancelUpdate)
      cancelUpdate();
  }

  /** Renders TileLoadingIndicator */
  public render() {
    const classes = classnames(
      "uifw-tile-loading-bar",
      this.state.enabled && "uifw-tile-loading-bar-visible",
      this.props.isInFooterMode && "nz-footer-mode",
      this.props.className,
    );
    return (
      <div className={classes} style={this.props.style}>
        <span>{this.state.label}</span>
        <LoadingBar percent={this.state.progress} barHeight={5} />
      </div>
    );
  }
}

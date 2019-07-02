/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import {
  ViewportComponent,
} from "@bentley/ui-components";
import {
  ConfigurableCreateInfo,
  ConfigurableUiManager,
  ContentViewManager,
  ViewportContentControl,
  UiFramework,
  ViewSelector,
  ViewUtilities,
} from "@bentley/ui-framework";
import { ScreenViewport, IModelConnection, ViewState } from "@bentley/imodeljs-frontend";
import { Id64String } from "@bentley/bentleyjs-core";
import { viewWithUnifiedSelection } from "@bentley/presentation-components";

import { AnimationViewOverlay } from "./AnimationViewOverlay";

// create a HOC viewport component that supports unified selection
// tslint:disable-next-line:variable-name
const UnifiedSelectionViewport = viewWithUnifiedSelection(ViewportComponent);

/** iModel Viewport Control
 */
export class IModelViewportControl extends ViewportContentControl {
  private _options: any;

  private _onPlayPauseAnimation = (isPlaying: boolean): void => {
    const isVisible = UiFramework.getIsUiVisible();
    // turn off ui elements when playing
    if (isVisible === isPlaying)
      UiFramework.setIsUiVisible(!isVisible);
  }

  private _getViewOverlay = (viewport: ScreenViewport): React.ReactNode => {
    return (
      <AnimationViewOverlay viewport={viewport} onPlayPause={this._onPlayPauseAnimation} />
    );
  }

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this._options = options;

    if (options.viewId || options.viewState) {
      this.reactElement = this.getReactElement(options.iModelConnection, options.viewId, options.viewState);
    } else {
      this.reactElement = <MockIModelViewport bgColor={options.bgColor} />;
      this.setIsReady();
    }
  }

  /** Returns a promise that resolves when the control is ready for usage.
   */
  public get isReady(): Promise<void> {
    if (this._options.viewId || this._options.viewState)
      return super.isReady;
    else
      return Promise.resolve();
  }

  public onActivated(): void {
    super.onActivated();

    // Demo for showing only the same type of view in ViewSelector - See ViewsFrontstage.tsx, <ViewSelector> listenForShowUpdates
    if (this.viewport)
      ViewSelector.updateShowSettings(
        ViewUtilities.isSpatialView(this.viewport),
        ViewUtilities.isDrawingView(this.viewport),
        ViewUtilities.isSheetView(this.viewport),
        false);
  }

  /** Get the NavigationAidControl associated with this ContentControl */
  public get navigationAidControl(): string {
    if (this._options.viewId || this._options.viewState)
      return super.navigationAidControl;
    else
      return "StandardRotationNavigationAid";
  }

  /** Get the React.Element for a ViewSelector change. */
  public getReactElementForViewSelectorChange(iModelConnection: IModelConnection, _viewDefinitionId: Id64String, viewState: ViewState, _name: string): React.ReactNode {
    return this.getReactElement(iModelConnection, undefined, viewState);
  }

  /** Get the React.Element for */
  private getReactElement(iModelConnection: IModelConnection, viewDefinitionId?: Id64String, viewState?: ViewState): React.ReactNode {
    return (
      <UnifiedSelectionViewport
        viewportRef={(v: ScreenViewport) => { this.viewport = v; }}
        viewDefinitionId={viewDefinitionId}
        viewState={viewState}
        imodel={iModelConnection}
        ruleset={this._options.ruleset}
        getViewOverlay={this._getViewOverlay} />
    );
  }

}

// This is used for fake viewports (those with no ViewId or ViewState)
interface MockIModelViewportProps {
  bgColor: string;
}

/** iModel Viewport React component */
class MockIModelViewport extends React.Component<MockIModelViewportProps> {
  // private _containerDiv: HTMLDivElement|null;
  private _htmlCanvas!: HTMLCanvasElement;

  constructor(props: MockIModelViewportProps) {
    super(props);
  }

  public render(): React.ReactNode {
    const divStyle: React.CSSProperties = {
      width: "100%",
      height: "100%",
      backgroundColor: this.props.bgColor,
    };
    const canvasStyle: React.CSSProperties = {
      width: "100%",
      height: "100%",
    };

    return (
      <div style={divStyle}>
        <canvas className="uifw-unselectable" style={canvasStyle} ref={(element: any) => { this._htmlCanvas = element; }}
          onMouseMove={this._onMouseMove}
          onMouseLeave={this._onMouseLeave}
          onMouseDown={this._onMouseDown}
          onMouseUp={this._onMouseUp}
        />
      </div>
    );
  }

  private drawCanvas(event: React.MouseEvent<HTMLCanvasElement>, isMouseDown: boolean) {
    const canvas = this._htmlCanvas;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const boundingRect: DOMRect = (event.nativeEvent.target as any).getBoundingClientRect();
      const canvasX = (event.clientX - boundingRect.left);
      const canvasY = (event.clientY - boundingRect.top);

      // clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // draw the text
      ctx.font = "10px Arial";
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      const text = "Mouse Info:  X: " + canvasX + " Y: " + canvasY + " Down: " + isMouseDown;
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }
  }

  private _onMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    this.drawCanvas(event, ContentViewManager.isMouseDown);
  }

  private _onMouseLeave = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = this._htmlCanvas;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const boundingRect: DOMRect = (event.nativeEvent.target as any).getBoundingClientRect();
      ctx.clearRect(0, 0, boundingRect.width, boundingRect.height);
    }
  }

  private _onMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    this.drawCanvas(event, true);
    event.preventDefault();
  }

  private _onMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
    this.drawCanvas(event, false);
  }
}

ConfigurableUiManager.registerControl("IModelViewport", IModelViewportControl);

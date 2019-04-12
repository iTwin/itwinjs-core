/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Viewport */

import * as React from "react";
import { Id64String, BeDuration } from "@bentley/bentleyjs-core";
import {
  IModelApp,
  IModelConnection,
  ViewState,
  ScreenViewport,
  Viewport,
} from "@bentley/imodeljs-frontend";
import { Transform } from "@bentley/geometry-core";
import { CommonProps } from "@bentley/ui-core";

import {
  ViewportComponentEvents,
  CubeRotationChangeEventArgs,
  StandardRotationChangeEventArgs,
  DrawingViewportChangeEventArgs,
} from "./ViewportComponentEvents";

/**
 * Properties for [[ViewportComponent]] component.
 * @public
 */
export interface ViewportProps extends CommonProps {
  /** IModel to display */
  imodel: IModelConnection;
  /** Id of a default view definition to load as a starting point */
  viewDefinitionId?: Id64String;
  /** ViewState to use as a starting point */
  viewState?: ViewState;
  /** Function to get a reference to the ScreenViewport */
  viewportRef?: (v: ScreenViewport) => void;
  /** @internal */
  onContextMenu?: (e: React.MouseEvent) => boolean;
  /** @internal */
  getViewOverlay?: (viewState: ViewState) => React.ReactNode;
}

interface ViewportState {
  viewId: string;
}

/**
 * A viewport React component that creates a ScreenViewport.
 * @public
 */
export class ViewportComponent extends React.Component<ViewportProps, ViewportState> {

  private _viewportDiv: React.RefObject<HTMLDivElement>;
  private _vp?: ScreenViewport;
  private _viewClassFullName: string = "";

  public constructor(props: ViewportProps) {
    super(props);
    this._viewportDiv = React.createRef<HTMLDivElement>();
    this.state = {
      viewId: "",
    };
  }

  public async componentDidMount() {
    if (!this._viewportDiv.current)
      throw new Error("Parent <div> failed to load");

    let viewState: ViewState;
    if (this.props.viewState) {
      viewState = this.props.viewState;
    } else if (this.props.viewDefinitionId) {
      viewState = await this.props.imodel.views.load(this.props.viewDefinitionId);
      if (!viewState)
        throw new Error("View state failed to load");
    } else {
      throw new Error("Either viewDefinitionId or viewState must be provided as a ViewportComponent Prop");
    }

    this._vp = ScreenViewport.create(this._viewportDiv.current, viewState);
    IModelApp.viewManager.addViewport(this._vp);

    if (this.props.viewportRef)
      this.props.viewportRef(this._vp);

    ViewportComponentEvents.initialize();
    ViewportComponentEvents.onDrawingViewportChangeEvent.addListener(this._handleDrawingViewportChangeEvent, this);
    ViewportComponentEvents.onCubeRotationChangeEvent.addListener(this._handleCubeRotationChangeEvent, this);
    ViewportComponentEvents.onStandardRotationChangeEvent.addListener(this._handleStandardRotationChangeEvent, this);

    this._vp.onViewChanged.addListener(this._handleViewChanged, this);
    this._viewClassFullName = this._vp.view.classFullName;
    this.setState({ viewId: this._vp.view.id });
  }

  public componentWillUnmount() {
    if (this._vp) {
      IModelApp.viewManager.dropViewport(this._vp, true);
      this._vp.onViewChanged.removeListener(this._handleViewChanged, this);
    }

    ViewportComponentEvents.onDrawingViewportChangeEvent.removeListener(this._handleDrawingViewportChangeEvent, this);
    ViewportComponentEvents.onCubeRotationChangeEvent.removeListener(this._handleCubeRotationChangeEvent, this);
    ViewportComponentEvents.onStandardRotationChangeEvent.removeListener(this._handleStandardRotationChangeEvent, this);
  }

  private _handleDrawingViewportChangeEvent = (args: DrawingViewportChangeEventArgs) => {
    if (this._vp && IModelApp.viewManager.selectedView === this._vp) {
      this._vp.view.setOrigin(args.origin);
      this._vp.view.setRotation(args.rotation);
      this._vp.synchWithView(args.complete === true ? true : false);
    }
  }

  private _handleCubeRotationChangeEvent = (args: CubeRotationChangeEventArgs) => {
    if (this._vp && IModelApp.viewManager.selectedView === this._vp) {
      if (args.animationTime && args.animationTime < 0) {
        this._vp.synchWithView(true);
      }
      const rotMatrix = args.rotMatrix;
      if (this._vp.rotation !== rotMatrix) {
        const center = this._vp.view.getTargetPoint(); // Don't try to locate geometry using depth buffer...
        const inverse = rotMatrix.clone().inverse(); // rotation is from current nav cube state...
        if (undefined === inverse)
          return;
        const targetMatrix = inverse.multiplyMatrixMatrix(this._vp.view.getRotation());
        const worldTransform = Transform.createFixedPointAndMatrix(center, targetMatrix);
        const frustum = this._vp.getWorldFrustum();
        frustum.multiply(worldTransform);
        if (args.animationTime && args.animationTime > 0) {
          this._vp.animateFrustumChange(this._vp.getWorldFrustum(), frustum, BeDuration.fromMilliseconds(args.animationTime));
        } else {
          this._vp.view.setupFromFrustum(frustum);
          this._vp.synchWithView(false);
        }
      }
    }
  }

  private _handleStandardRotationChangeEvent = (args: StandardRotationChangeEventArgs) => {
    if (this._vp && IModelApp.viewManager.selectedView === this._vp) {
      // this._vp.view.setStandardRotation(args.standardRotation);
      this._vp.view.setRotationAboutPoint(ViewState.getStandardViewMatrix(args.standardRotation));
      this._vp.synchWithView(true);
    }
  }

  private _handleViewChanged = (vp: Viewport) => {
    ViewportComponentEvents.setViewMatrix(vp);

    if (this._viewClassFullName !== vp.view.classFullName) {
      setTimeout(() => {
        ViewportComponentEvents.onViewClassFullNameChangedEvent.emit({ viewport: vp, oldName: this._viewClassFullName, newName: vp.view.classFullName });
        this._viewClassFullName = vp.view.classFullName;
      });
    }

    if (this.state.viewId !== vp.view.id) {
      setTimeout(() => {
        ViewportComponentEvents.onViewIdChangedEvent.emit({ viewport: vp, oldId: this.state.viewId, newId: vp.view.id });
        this.setState({ viewId: vp.view.id });
      });
    }
  }

  private _handleContextMenu = (e: React.MouseEvent): boolean => {
    e.preventDefault();
    if (this.props.onContextMenu)
      this.props.onContextMenu(e);
    return false;
  }

  public render() {
    const viewOverlay = this._vp && this.props.getViewOverlay ? this.props.getViewOverlay(this._vp.view) : null;

    const parentDivStyle: React.CSSProperties = {
      height: "100%", width: "100%", position: "relative",
    };

    const viewportDivStyle: React.CSSProperties = {
      height: "100%", width: "100%",
      ...this.props.style,
    };

    return (
      <div style={parentDivStyle}>
        <div
          ref={this._viewportDiv}
          className={this.props.className}
          style={viewportDivStyle}
          onContextMenu={this._handleContextMenu}
        />
        {viewOverlay}
      </div>
    );
  }
}

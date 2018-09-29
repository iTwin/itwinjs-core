/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
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

import {
  ViewRotationCube,
  CubeRotationChangeEventArgs,
  StandardRotationChangeEventArgs,
} from "./ViewRotationCube";

import { Transform } from "@bentley/geometry-core";

/**
 * Properties for [[ViewportComponent]] component.
 */
export interface ViewportProps {
  /** IModel to display */
  imodel: IModelConnection;

  /** Id of a default view definition to load as a starting point */
  viewDefinitionId: Id64String;

  /** @hidden */
  onContextMenu?: (e: React.MouseEvent) => boolean;
}

/**
 * A viewport React component that creates a ScreenViewport.
 */
export class ViewportComponent extends React.Component<ViewportProps> {

  private _viewportDiv: React.RefObject<HTMLDivElement>;
  private _vp?: ScreenViewport;

  public constructor(props: ViewportProps, context?: any) {
    super(props, context);
    this._viewportDiv = React.createRef<HTMLDivElement>();
  }

  public async componentDidMount() {
    if (!this._viewportDiv.current)
      throw new Error("Canvas failed to load");

    const viewState = await this.props.imodel.views.load(this.props.viewDefinitionId);
    if (!viewState)
      throw new Error("View state failed to load");

    this._vp = ScreenViewport.create(this._viewportDiv.current, viewState);
    IModelApp.viewManager.addViewport(this._vp);

    ViewRotationCube.initialize();
    ViewRotationCube.cubeRotationChangeEvent.addListener(this._handleCubeRotationChangeEvent, this);
    ViewRotationCube.standardRotationChangeEvent.addListener(this._handleStandardRotationChangeEvent, this);
    this._vp.onViewChanged.addListener(this._handleViewChanged, this);
  }

  public componentWillUnmount() {
    if (this._vp) {
      IModelApp.viewManager.dropViewport(this._vp);
      this._vp.onViewChanged.removeListener(this._handleViewChanged, this);
    }

    ViewRotationCube.cubeRotationChangeEvent.removeListener(this._handleCubeRotationChangeEvent, this);
    ViewRotationCube.standardRotationChangeEvent.removeListener(this._handleStandardRotationChangeEvent, this);
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
    ViewRotationCube.setViewMatrix(vp);
  }

  private _handleContextMenu = (e: React.MouseEvent): boolean => {
    e.preventDefault();
    if (this.props.onContextMenu)
      this.props.onContextMenu(e);
    return false;
  }

  public render() {
    return (
      <div
        ref={this._viewportDiv}
        style={{ height: "100%", width: "100%" }}
        onContextMenu={this._handleContextMenu}
      />
    );
  }
}

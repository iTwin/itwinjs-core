/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Viewport */

import * as React from "react";
import { Id64String } from "@bentley/bentleyjs-core";
import {
  IModelApp,
  IModelConnection,
  ViewState,
  ScreenViewport,
  Viewport,
  ToolSettings,
  ViewManager,
  TentativePoint,
} from "@bentley/imodeljs-frontend";
import { Transform, Point3d } from "@bentley/geometry-core";
import { CommonProps } from "@bentley/ui-core";

import {
  ViewportComponentEvents,
  CubeRotationChangeEventArgs,
  StandardRotationChangeEventArgs,
  DrawingViewportChangeEventArgs,
} from "./ViewportComponentEvents";
import { NpcCenter } from "@bentley/imodeljs-common";

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
  /** @internal used only for testing */
  viewManagerOverride?: ViewManager;
  /** @internal used only for testing */
  screenViewportOverride?: typeof ScreenViewport;
  /** @internal used only for testing */
  tentativePointOverride?: TentativePoint;
}

/** @internal */
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
  private _lastTargetPoint?: Point3d;

  public constructor(props: ViewportProps) {
    super(props);
    this._viewportDiv = React.createRef<HTMLDivElement>();
    this.state = {
      viewId: "",
    };
  }

  public async componentDidMount() {
    // istanbul ignore next
    if (!this._viewportDiv.current)
      throw new Error("Parent <div> failed to load");

    let viewState: ViewState;
    if (this.props.viewState) {
      viewState = this.props.viewState;
    } else if (this.props.viewDefinitionId) {
      viewState = await this.props.imodel.views.load(this.props.viewDefinitionId);
      // istanbul ignore next
      if (!viewState)
        throw new Error("View state failed to load");
    } /* istanbul ignore next */ else {
      throw new Error("Either viewDefinitionId or viewState must be provided as a ViewportComponent Prop");
    }

    const viewManager = this.props.viewManagerOverride ? this.props.viewManagerOverride : /* istanbul ignore next */ IModelApp.viewManager;
    const screenViewport = this.props.screenViewportOverride ? this.props.screenViewportOverride : /* istanbul ignore next */ ScreenViewport;
    this._vp = screenViewport.create(this._viewportDiv.current, viewState);
    viewManager.addViewport(this._vp);

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
      const viewManager = this.props.viewManagerOverride ? this.props.viewManagerOverride : /* istanbul ignore next */ IModelApp.viewManager;
      viewManager.dropViewport(this._vp, true);
      this._vp.onViewChanged.removeListener(this._handleViewChanged, this);
    }

    ViewportComponentEvents.onDrawingViewportChangeEvent.removeListener(this._handleDrawingViewportChangeEvent, this);
    ViewportComponentEvents.onCubeRotationChangeEvent.removeListener(this._handleCubeRotationChangeEvent, this);
    ViewportComponentEvents.onStandardRotationChangeEvent.removeListener(this._handleStandardRotationChangeEvent, this);
  }

  private _handleDrawingViewportChangeEvent = (args: DrawingViewportChangeEventArgs) => {
    const viewManager = this.props.viewManagerOverride ? this.props.viewManagerOverride : /* istanbul ignore next */ IModelApp.viewManager;
    if (this._vp && viewManager.selectedView === this._vp) {
      this._vp.view.setOrigin(args.origin);
      this._vp.view.setRotation(args.rotation);
      this._vp.synchWithView(args.complete === true ? true : false);
    }
  }

  private _getRotatePoint(vp: ScreenViewport): Point3d {
    const tentativePoint = this.props.tentativePointOverride ? this.props.tentativePointOverride : /* istanbul ignore next */ IModelApp.tentativePoint;
    if (tentativePoint.isActive)
      return tentativePoint.getPoint();
    if (undefined !== vp.viewCmdTargetCenter) {
      const testPt = vp.worldToView(vp.viewCmdTargetCenter);
      const viewRect = vp.viewRect;
      if (viewRect.containsPoint(testPt))
        return vp.viewCmdTargetCenter;
      vp.viewCmdTargetCenter = undefined;
    }

    if (undefined !== this._lastTargetPoint) {
      const testPt = vp.worldToView(this._lastTargetPoint);
      const viewRect = vp.viewRect.clone();
      viewRect.scaleAboutCenter(0.25, 0.25);
      // istanbul ignore next hard to reach because of mocks
      if (viewRect.containsPoint(testPt))
        return this._lastTargetPoint;
      this._lastTargetPoint = undefined;
    }

    const visiblePoint = vp.pickNearestVisibleGeometry(vp.npcToWorld(NpcCenter), vp.pixelsFromInches(ToolSettings.viewToolPickRadiusInches));
    this._lastTargetPoint = (undefined !== visiblePoint ? visiblePoint : vp.view.getTargetPoint());
    return this._lastTargetPoint;
  }

  private _handleCubeRotationChangeEvent = (args: CubeRotationChangeEventArgs) => {
    const viewManager = this.props.viewManagerOverride ? this.props.viewManagerOverride : /* istanbul ignore next */ IModelApp.viewManager;
    if (this._vp && viewManager.selectedView === this._vp) {
      const rotMatrix = args.rotMatrix;
      if (this._vp.rotation !== rotMatrix) {
        const inverse = rotMatrix.transpose(); // rotation is from current nav cube state...
        const center = this._getRotatePoint(this._vp);
        const targetMatrix = inverse.multiplyMatrixMatrix(this._vp.view.getRotation());
        const worldTransform = Transform.createFixedPointAndMatrix(center, targetMatrix);
        const frustum = this._vp.getWorldFrustum();
        frustum.multiply(worldTransform);
        this._vp.view.setupFromFrustum(frustum);
        this._vp.synchWithView(args.complete ? true : false);
      }
    }
  }

  private _handleStandardRotationChangeEvent = (args: StandardRotationChangeEventArgs) => {
    const viewManager = this.props.viewManagerOverride ? this.props.viewManagerOverride : /* istanbul ignore next */ IModelApp.viewManager;
    if (this._vp && viewManager.selectedView === this._vp) {
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
          data-testid="viewport-component"
          className={this.props.className}
          style={viewportDivStyle}
          onContextMenu={this._handleContextMenu}
        />
        {viewOverlay}
      </div>
    );
  }
}

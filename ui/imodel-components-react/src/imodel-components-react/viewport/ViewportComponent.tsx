/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Viewport
 */

import * as React from "react";
import { Id64String, Logger } from "@itwin/core-bentley";
import { Point3d, Transform } from "@itwin/core-geometry";
import { NpcCenter } from "@itwin/core-common";
import {
  IModelApp, IModelConnection, ScreenViewport,
  TentativePoint, ToolSettings, ViewManager,
  Viewport, ViewState,
} from "@itwin/core-frontend";

import { CommonProps } from "@itwin/core-react";
import {
  CubeRotationChangeEventArgs, DrawingViewportChangeEventArgs, StandardRotationChangeEventArgs, ViewportComponentEvents,
} from "./ViewportComponentEvents";

/** Type for a ViewState prop
 * @public
 */
export type ViewStateProp = ViewState | (() => ViewState);

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
  viewState?: ViewStateProp;
  /** Function to get a reference to the ScreenViewport */
  viewportRef?: (v: ScreenViewport) => void;
  /** controlId for this content component @internal */
  controlId?: string;
  /** @internal */
  onContextMenu?: (e: React.MouseEvent) => boolean;
  /** @internal */
  getViewOverlay?: (viewport: ScreenViewport) => React.ReactNode;
  /** @internal used only for testing */
  viewManagerOverride?: ViewManager;
  /** @internal used only for testing */
  screenViewportOverride?: typeof ScreenViewport;
  /** @internal used only for testing */
  tentativePointOverride?: TentativePoint;
}

/**
 * A viewport React component that creates a ScreenViewport.
 * @public
 */
export function ViewportComponent(props: ViewportProps) {
  const { viewState, imodel, viewDefinitionId, getViewOverlay, viewManagerOverride,
    tentativePointOverride, onContextMenu, style, className, screenViewportOverride, controlId, viewportRef } = props;
  const viewManagerRef = React.useRef(viewManagerOverride ?? IModelApp.viewManager);
  const tentativePointOverrideRef = React.useRef(tentativePointOverride);
  const screenViewportCreated = React.useRef(false);
  const viewportDiv = React.useRef<HTMLDivElement>(null);
  const screenViewportRef = React.useRef<ScreenViewport | null>(null);
  const [imodelConnection, setImodelConnection] = React.useState(imodel);
  const isMounted = React.useRef(false);
  const viewClassFullName = React.useRef("");
  const viewId = React.useRef("0");

  const handleViewChanged = (vp: Viewport) => {
    ViewportComponentEvents.setViewMatrix(vp);
    if (viewClassFullName.current !== vp.view.classFullName) {
      setTimeout(() => {
        ViewportComponentEvents.onViewClassFullNameChangedEvent.emit({ viewport: vp, oldName: viewClassFullName.current, newName: vp.view.classFullName });
        viewClassFullName.current = vp.view.classFullName;
      });
    }

    if (viewId.current !== vp.view.id) {
      setTimeout(() => {
        ViewportComponentEvents.onViewIdChangedEvent.emit({ viewport: vp, oldId: viewId.current, newId: vp.view.id });
        viewId.current = vp.view.id;
      });
    }
  };

  const handleStandardRotationChangeEvent = (args: StandardRotationChangeEventArgs) => {
    const viewManager = viewManagerRef.current;
    const currentScreenViewport = screenViewportRef.current;
    if (currentScreenViewport && viewManager.selectedView === currentScreenViewport) {
      currentScreenViewport.view.setRotationAboutPoint(ViewState.getStandardViewMatrix(args.standardRotation));
      currentScreenViewport.synchWithView();
    }
  };

  const handleDrawingViewportChangeEvent = (args: DrawingViewportChangeEventArgs) => {
    const viewManager = viewManagerRef.current;
    const currentScreenViewport = screenViewportRef.current;
    if (currentScreenViewport && viewManager.selectedView === currentScreenViewport) {
      currentScreenViewport.view.setOrigin(args.origin);
      currentScreenViewport.view.setRotation(args.rotation);
      currentScreenViewport.synchWithView({ noSaveInUndo: args.complete !== true });
    }
  };

  const targetPoint = React.useRef<Point3d | null>(null);

  const getRotatePoint = (vp: ScreenViewport): Point3d => {
    const lastTargetPoint = targetPoint.current;
    const tentativePoint = tentativePointOverrideRef.current ?? IModelApp.tentativePoint;
    if (tentativePoint.isActive)
      return tentativePoint.getPoint();

    if (undefined !== vp.viewCmdTargetCenter) {
      const testPt = vp.worldToView(vp.viewCmdTargetCenter);
      const viewRect = vp.viewRect;
      if (viewRect.containsPoint(testPt))
        return vp.viewCmdTargetCenter;
      vp.viewCmdTargetCenter = undefined;
    }

    if (null !== lastTargetPoint) {
      const testPt = vp.worldToView(lastTargetPoint);
      const viewRect = vp.viewRect.clone();
      viewRect.scaleAboutCenter(0.25, 0.25);
      // istanbul ignore next hard to reach because of mocks
      if (viewRect.containsPoint(testPt))
        return lastTargetPoint;
      targetPoint.current = null;
    }

    const visiblePoint = vp.pickNearestVisibleGeometry(vp.npcToWorld(NpcCenter), vp.pixelsFromInches(ToolSettings.viewToolPickRadiusInches));
    targetPoint.current = (undefined !== visiblePoint ? visiblePoint : vp.view.getTargetPoint());
    return targetPoint.current ?? vp.view.getCenter();
  };

  const handleCubeRotationChangeEvent = (args: CubeRotationChangeEventArgs) => {
    const viewManager = viewManagerRef.current;
    const currentScreenViewport = screenViewportRef.current;
    if (currentScreenViewport && viewManager.selectedView === currentScreenViewport) {
      const rotMatrix = args.rotMatrix;
      if (currentScreenViewport.rotation !== rotMatrix) {
        const inverse = rotMatrix.transpose(); // rotation is from current nav cube state...
        const center = getRotatePoint(currentScreenViewport);
        const targetMatrix = inverse.multiplyMatrixMatrix(currentScreenViewport.view.getRotation());
        const worldTransform = Transform.createFixedPointAndMatrix(center, targetMatrix);
        const frustum = currentScreenViewport.getWorldFrustum();
        frustum.multiply(worldTransform);
        currentScreenViewport.view.setupFromFrustum(frustum);
        currentScreenViewport.synchWithView({ noSaveInUndo: !args.complete });
      }
    }
  };

  const handleDisconnectFromViewManager = () => {
    const screenViewport = screenViewportRef.current;
    if (screenViewport) {
      const viewManager = IModelApp.viewManager;
      viewManager.dropViewport(screenViewport, true);
      screenViewport.onViewChanged.removeListener(handleViewChanged);
      screenViewportRef.current = null;
      screenViewportCreated.current = false;

      ViewportComponentEvents.onDrawingViewportChangeEvent.removeListener(handleDrawingViewportChangeEvent);
      ViewportComponentEvents.onCubeRotationChangeEvent.removeListener(handleCubeRotationChangeEvent);
      ViewportComponentEvents.onStandardRotationChangeEvent.removeListener(handleStandardRotationChangeEvent);
    }
  };

  const getScreenViewport = (parentDiv: HTMLDivElement, inViewState: ViewState) => {
    const screenViewportFactory = screenViewportOverride ? screenViewportOverride : ScreenViewport;
    const parentWindow = parentDiv.ownerDocument.defaultView as Window;
    parentWindow.addEventListener("beforeunload", handleDisconnectFromViewManager, true); // listener clear after being called
    ViewportComponentEvents.initialize();
    ViewportComponentEvents.onDrawingViewportChangeEvent.addListener(handleDrawingViewportChangeEvent);
    ViewportComponentEvents.onCubeRotationChangeEvent.addListener(handleCubeRotationChangeEvent);
    ViewportComponentEvents.onStandardRotationChangeEvent.addListener(handleStandardRotationChangeEvent);
    const screenViewport = screenViewportFactory.create(parentDiv, inViewState);
    screenViewportCreated.current = true;
    viewClassFullName.current = screenViewport.view.classFullName;
    viewId.current = screenViewport.view.id;
    screenViewport.onViewChanged.addListener(handleViewChanged);
    return screenViewport;
  };

  React.useEffect(() => {
    isMounted.current = true;
    Logger.logInfo("ViewportComponent", `mounting ViewportComponent for controlId=${controlId}`);

    return () => {
      isMounted.current = false;
      Logger.logInfo("ViewportComponent", `un-mounting ViewportComponent for controlId=${controlId}`);
      handleDisconnectFromViewManager();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [initialViewState, setInitialViewState] = React.useState<ViewState | undefined>(() => {
    if (viewState) {
      if (typeof viewState === "function")
        return viewState().clone();
      else
        return viewState.clone();
    }
    return undefined;
  });

  React.useEffect(() => {
    setInitialViewState(undefined);
  }, [viewDefinitionId, viewState]);

  React.useEffect(() => {
    async function fetchInitialViewstate() {
      let currentViewState: ViewState | undefined;
      if (viewState) {
        if (typeof viewState === "function")
          currentViewState = viewState();
        else
          currentViewState = viewState;
      } else if (viewDefinitionId && imodelConnection) {
        currentViewState = await imodelConnection.views.load(viewDefinitionId);
        if (!currentViewState) {
          Logger.logError("ViewportComponent", `View state failed to load`);
        }
      }
      if (isMounted.current) {
        // just in case supplied viewstate in not in specified imodel
        if (currentViewState && (currentViewState.iModel.iModelId !== imodelConnection.iModelId)) {
          setImodelConnection(currentViewState.iModel);
        }
        setInitialViewState(currentViewState?.clone());
      }
    }
    if (undefined === initialViewState)
      fetchInitialViewstate(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }, [imodelConnection, initialViewState, viewDefinitionId, viewState]);

  const vpRef = React.useRef<ScreenViewport>();
  const viewOverlay = vpRef.current && getViewOverlay ? getViewOverlay(vpRef.current) : null;

  // This useEffect connects to ViewManger as soon as initialViewState is available once component is mounted.
  React.useEffect(() => {
    const parentDiv = viewportDiv.current;
    const viewManager = viewManagerRef.current;
    if (parentDiv && initialViewState) {
      if (!screenViewportCreated.current) {
        const screenViewport = getScreenViewport(parentDiv, initialViewState);
        screenViewportRef.current = screenViewport;

        if (viewportRef)
          viewportRef(screenViewport);

        Logger.logInfo("ViewportComponent", `processing viewManager.addViewport for controlId=${controlId} rect=${JSON.stringify(parentDiv.getBoundingClientRect().toJSON())}`);
        viewManager.addViewport(screenViewport);
      } else {
        screenViewportRef.current?.changeView(initialViewState);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlId, initialViewState, viewportRef]);

  const handleContextMenu = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (onContextMenu)
      onContextMenu(e);
  }, [onContextMenu]);

  const parentDivStyle: React.CSSProperties = {
    height: "100%", width: "100%", position: "relative",
  };

  const viewportDivStyle: React.CSSProperties = {
    ...style,
    height: "100%", width: "100%",
  };

  return (
    <div style={parentDivStyle} data-item-id={controlId}
    >
      <>
        <div
          ref={viewportDiv}
          data-testid="viewport-component"
          className={className}
          style={viewportDivStyle}
          onContextMenu={handleContextMenu}
        />
        {viewOverlay}
      </>
    </div>
  );
}

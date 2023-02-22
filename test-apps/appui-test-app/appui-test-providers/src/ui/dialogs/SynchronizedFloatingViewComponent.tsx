/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { ScreenViewport, ViewManip, ViewState } from "@itwin/core-frontend";
import { ContentControl, ContentViewManager, FloatingViewportContent, FloatingViewportContentControl, FrontstageManager, UiFramework, useActiveIModelConnection } from "@itwin/appui-react";

import "./SynchronizedFloatingViewComponent.scss";
import { getViewDefinitions } from "../components/ViewDefinitionSelector";
import { ViewIdChangedEventArgs, ViewportComponentEvents } from "@itwin/imodel-components-react";
import { Presentation, TRANSIENT_ELEMENT_CLASSNAME } from "@itwin/presentation-frontend";
import { KeySet } from "@itwin/presentation-common";
interface SynchronizedViewDefInterfaceLocal {
  id: string; class: string; label: string;
}
export function SynchronizedFloatingView({ contentId }: { contentId: string }) {
  const getIds=(args: Readonly<KeySet>) =>{
    let allIds: Set<string> = new Set<string>();
    args.instanceKeys.forEach((ids: Set<string>, key: string) => {
    // Avoid transient elements
      if (key !== TRANSIENT_ELEMENT_CLASSNAME) allIds = new Set([...allIds, ...ids]);
    });
    return allIds;
  };
  const activeIModelConnection = useActiveIModelConnection();
  const divRef = React.useRef<HTMLDivElement>(null);

  const [initialViewState, setInitialViewState] = React.useState<ViewState | undefined>(undefined);
  const [twoDViewDefinitions, settwoDViewDefinitions] = React.useState<SynchronizedViewDefInterfaceLocal[]>([]);
  const [threeDViewDefinitions, setthreeDViewDefinitions] = React.useState<SynchronizedViewDefInterfaceLocal[]>([]);

  const handleViewIdChange = React.useCallback ((args: ViewIdChangedEventArgs) => {
    if (args.newId === args.oldId)
      return;

    const ids = getIds(Presentation.selection.getSelection(UiFramework.getIModelConnection()!, 0));
    if ([...ids].length === 0) {
      ViewManip.fitView(args.viewport as ScreenViewport, false);
    }
    const activeFrontstageDef = FrontstageManager.activeFrontstageDef;

    const viewContentControl = activeFrontstageDef?.contentControls?.find((contentControl) => contentControl.viewport === args.viewport);

    if (!viewContentControl)
      return;

    const mainViewportOnFrontstage = activeFrontstageDef?.contentControls[0].viewport;
    // turn off listener while we update the views
    ViewportComponentEvents.onViewIdChangedEvent.removeListener(handleViewIdChange);

    const isChangeForCurrentFloatingViewport = viewContentControl instanceof FloatingViewportContentControl;
    if (isChangeForCurrentFloatingViewport) {
      const noChangeRequired = ((args.viewport.view.is2d() && mainViewportOnFrontstage?.view.is3d()) ||
      (args.viewport.view.is3d() && mainViewportOnFrontstage?.view.is2d()));
      if (noChangeRequired) {
        // add the listener back
        ViewportComponentEvents.onViewIdChangedEvent.addListener(handleViewIdChange);
        return;
      }
      if (!noChangeRequired) {
        if (args.viewport.view.is2d() && threeDViewDefinitions.length > 0) {
          activeIModelConnection?.views.load(threeDViewDefinitions[0].id).then((newViewStateForMainVP: ViewState) => {
            mainViewportOnFrontstage?.changeView(newViewStateForMainVP);
            // add the listener back
            ViewportComponentEvents.onViewIdChangedEvent.addListener(handleViewIdChange);
          });
        } else if (args.viewport.view.is3d() && twoDViewDefinitions.length > 0) {
          // Main viewport is still 3d while we have loaded 3d in floating viewport, make it opposite (2d)
          activeIModelConnection?.views.load(twoDViewDefinitions[0].id).then((newViewStateForMainVP: ViewState) => {
            mainViewportOnFrontstage?.changeView(newViewStateForMainVP);
            // add the listener back
            ViewportComponentEvents.onViewIdChangedEvent.addListener(handleViewIdChange);
          });
        }
      }
    }  else {
      // change was for main viewport of frontstage and we need to set mirror in floating viewport here
      const floatingPIPViewport = FrontstageManager.activeFrontstageDef?.contentControls.find((thisControl: ContentControl) => {
        return (thisControl.classId === contentId);
      });
      const noChangeRequired = ((args.viewport.view.is2d() && floatingPIPViewport?.viewport?.view.is3d()) ||
        (args.viewport.view.is3d() && floatingPIPViewport?.viewport?.view.is2d()));
      if (!noChangeRequired) {
        if (args.viewport.view.is2d() && threeDViewDefinitions.length > 0) {

          activeIModelConnection?.views.load(threeDViewDefinitions[0].id).then((newViewStateForFloatingVP: ViewState) => {
            //  floatingPIPViewport?.viewport?.changeView(newViewStateForFloatingVP);
            setInitialViewState(newViewStateForFloatingVP);
            // add the listener back
            ViewportComponentEvents.onViewIdChangedEvent.addListener(handleViewIdChange);
          });
        } else if (args.viewport.view.is3d() && twoDViewDefinitions.length > 0) {
          activeIModelConnection?.views.load(twoDViewDefinitions[0].id).then((newViewStateForFloatingVP: ViewState) => {
            // floatingPIPViewport?.viewport?.changeView(newViewStateForFloatingVP);
            setInitialViewState(newViewStateForFloatingVP);
            // add the listener back
            ViewportComponentEvents.onViewIdChangedEvent.addListener(handleViewIdChange);
          });
        }
      }
    }

  },[activeIModelConnection?.views, contentId, threeDViewDefinitions, twoDViewDefinitions]);
  // Set initial view when floating viewport is launched for first time. It needs to be mirror of main/default viewport of frontstage (2d->3d or 3d->2d)
  React.useEffect(() => {
    if (!activeIModelConnection) return;
    const acceptedSpatialViewClasses = ["BisCore:SpatialViewDefinition", "BisCore:OrthographicViewDefinition"];

    const acceptedDrawingViewClasses = ["BisCore:DrawingViewDefinition"];
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    getViewDefinitions(activeIModelConnection).then((viewDefinitions: SynchronizedViewDefInterfaceLocal[]) => {

      const localThreeTwoDViewDefs = viewDefinitions.filter((def: any) => {
        return acceptedSpatialViewClasses.indexOf(def.class) > -1;
      });
      const localTwoTwoDViewDefs = viewDefinitions.filter((def: any) => {
        return acceptedDrawingViewClasses.indexOf(def.class) > -1;
      });
      settwoDViewDefinitions(localTwoTwoDViewDefs);
      setthreeDViewDefinitions(localThreeTwoDViewDefs);
      // Set initial view state
      const mainViewportOnFrontstage = ContentViewManager.getActiveContentControl();
      const isMainViewport3d = mainViewportOnFrontstage?.viewport?.view.is3d();
      let initialViewIdToLoad;

      if (isMainViewport3d && localTwoTwoDViewDefs && localTwoTwoDViewDefs.length > 0) {
        initialViewIdToLoad = localTwoTwoDViewDefs[0].id;
      } else if (!isMainViewport3d && localThreeTwoDViewDefs && localThreeTwoDViewDefs.length > 0) {
        initialViewIdToLoad = localThreeTwoDViewDefs[0].id;
      }

      if (initialViewIdToLoad) {
        // This block is twisted beyond recognition. We need a better way to fit view from core team here.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        activeIModelConnection.views.load(initialViewIdToLoad).then((viewState: ViewState) => {
          setInitialViewState(viewState);
        });
      }
    });

  }, [activeIModelConnection]);

  React.useEffect(() => {
    // event listeners in hooks do not have access to latest state unless they are updated each time state changes
    // This particular hook would ensure the event handlers have access to latest value of all states they want ot use
    ViewportComponentEvents.onViewIdChangedEvent.addListener(handleViewIdChange);
    return () => {
      ViewportComponentEvents.onViewIdChangedEvent.removeListener(handleViewIdChange);
    };

  }, [activeIModelConnection, handleViewIdChange]);

  return (
    <div className="test-popup-test-view" ref={divRef}>
      <div id="floatingviewportcontainerdiv">
        {initialViewState &&
          <FloatingViewportContent contentId={contentId} initialViewState={initialViewState} />}
      </div>
    </div>
  );
}

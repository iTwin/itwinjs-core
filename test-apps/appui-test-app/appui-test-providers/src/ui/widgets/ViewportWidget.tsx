/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { FloatingViewportContent, UiFramework, useActiveIModelConnection, useSpecificWidgetDef, WidgetState } from "@itwin/appui-react";
import { Id64, Id64String } from "@itwin/core-bentley";
import { useRefState } from "@itwin/core-react";
import ViewDefinitionSelector from "../components/ViewDefinitionSelector";
// eslint-disable-next-line @typescript-eslint/naming-convention
export function ViewportWidgetComponent() {
  const activeIModelConnection = useActiveIModelConnection();
  const [viewState, setViewState] = React.useState(UiFramework.getDefaultViewState());
  const [divRef] = useRefState<HTMLDivElement>();
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [contentId, setContentId ] = React.useState("appui-test-provider:viewport-widget-content");

  const widgetDef = useSpecificWidgetDef("appui-test-providers:ViewportWidget");
  React.useEffect(() => {
    // using setTimeout to give time for frontstage to load before calling setWidgetState
    setTimeout(() => widgetDef?.setWidgetState(WidgetState.Floating));
  }, [widgetDef]);

  React.useEffect(() => {
    async function setupView() {
      if (undefined === viewState && activeIModelConnection) {
        const defaultViewId = await activeIModelConnection?.views?.queryDefaultViewId();
        if (defaultViewId && Id64.isValidId64(defaultViewId)) {
          const newViewState = await activeIModelConnection?.views.load(defaultViewId);
          // eslint-disable-next-line react-hooks/exhaustive-deps
          newViewState && setViewState(newViewState.clone());
        }
      }
    }
    setupView();// eslint-disable-line @typescript-eslint/no-floating-promises
  }, [activeIModelConnection, viewState]);

  React.useEffect(() => {
    const vs = viewState;
    if (!vs || typeof vs === "function") {
      setIsLoaded(true);
      return;
    }

    void (async () => {
      await vs.load();
      setIsLoaded(true);
    })();

  }, [viewState]);

  const onViewDefinitionChanged = React.useCallback(async (viewId?: Id64String) => {
    if (activeIModelConnection && viewId) {
      const newViewState = await activeIModelConnection.views.load(viewId);
      setViewState(newViewState);
      // the content control only gets updated in the ContentViewManager when the contentId changes, so change it when the viewstate changes
      const newContentId = `appui-test-provider:viewport-widget-content${viewId}`;
      setContentId(newContentId);
    }
  }, [activeIModelConnection]);

  if (!activeIModelConnection || !isLoaded || !viewState)
    return (<div> Empty View </div>);

  return (
    <div ref={divRef} style={{display:"grid", gridTemplateRows:"auto 1fr", height:"100%", position:"relative", minWidth:"400px", minHeight:"300px"}} >
      <div>
        <ViewDefinitionSelector imodel={viewState.iModel} selectedViewDefinition={viewState.id} onViewDefinitionSelected={onViewDefinitionChanged} />
      </div>
      <div>
        <FloatingViewportContent contentId={contentId} initialViewState={viewState} />
      </div>
    </div>);
}

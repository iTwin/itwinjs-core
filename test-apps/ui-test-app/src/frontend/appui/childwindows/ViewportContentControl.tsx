/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./ViewportContentControl.css";
import * as React from "react";
import { IModelApp, ScreenViewport, ViewState } from "@itwin/core-frontend";
import { viewWithUnifiedSelection } from "@itwin/presentation-components";
import { ViewportComponent } from "@itwin/imodel-components-react";
import { ContentViewManager, ContentWrapper, FloatingViewportContentControl, UiShowHideManager } from "@itwin/appui-react";

// eslint-disable-next-line @typescript-eslint/naming-convention
const SampleViewport = viewWithUnifiedSelection(ViewportComponent);

export interface ViewportContentComponentProps {
  /** callback used to construct context menu when user right-clicks on canvas/viewport */
  onContextMenu?: (e: React.MouseEvent) => boolean;
  /** viewport/content control uniqueId */
  contentId: string;
  /** The initial view state used to create the viewport */
  initialViewState: ViewState;
}

export default function ViewportContentComponent(props: ViewportContentComponentProps) { // eslint-disable-line @typescript-eslint/naming-convention
  const { contentId, initialViewState } = props;
  const [viewport, setViewport] = React.useState<ScreenViewport | undefined>();
  const contentControl = React.useRef<FloatingViewportContentControl | undefined>();

  const onViewportRef = React.useCallback((v: ScreenViewport) => setViewport(v), []);

  React.useEffect(() => {
    if (!contentControl.current) {
      contentControl.current = new FloatingViewportContentControl(contentId, contentId, null);
      ContentViewManager.addFloatingContentControl(contentControl.current);
    }
    return () => {
      if (contentControl.current) {
        ContentViewManager.dropFloatingContentControl(contentControl.current);
        contentControl.current = undefined;
      }
    };
  }, [contentId]);

  const viewPortControl = React.useMemo(() =>
    initialViewState ? (
      <SampleViewport
        viewportRef={onViewportRef}
        imodel={initialViewState.iModel}
        viewState={initialViewState}
        onContextMenu={props.onContextMenu}
      />
    ) : undefined, [onViewportRef, props.onContextMenu, initialViewState]);

  React.useEffect(() => {
    if (viewport && contentControl.current) {
      contentControl.current.viewport = viewport;
      if (null === contentControl.current.reactNode) {
        contentControl.current.reactNode = viewPortControl;
        if (initialViewState) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          contentControl.current.processViewSelectorChange(initialViewState.iModel, initialViewState.id, initialViewState, initialViewState.name);
        }
      }
    }
  }, [initialViewState, viewPortControl, viewport]);

  React.useEffect(() => {
    const onViewClose = (vp: ScreenViewport) => {
      if (contentControl.current?.viewport === vp) {
        ContentViewManager.dropFloatingContentControl(contentControl.current);
        contentControl.current = undefined;
      }
    };
    return IModelApp.viewManager.onViewClose.addListener(onViewClose);
  }, []);

  return (
    <div onMouseMove={UiShowHideManager.handleContentMouseMove} className="uifw-dialog-imodel-content" style={{ height: "100%", position: "relative" }}>
      <ContentWrapper content={viewPortControl} style={{ height: "100%", position: "relative" }} />
    </div>
  );
}

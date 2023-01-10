/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ContentView
 */

import "./FloatingViewportContent.css";
import * as React from "react";
import { IModelApp, ScreenViewport } from "@itwin/core-frontend";
import { viewWithUnifiedSelection } from "@itwin/presentation-components";
import { ViewportComponent, ViewStateProp } from "@itwin/imodel-components-react";
import { FloatingViewportContentControl } from "./ViewportContentControl";
import { ContentViewManager } from "./ContentViewManager";
import { UiShowHideManager } from "../utils/UiShowHideManager";
import { ContentWrapper } from "./ContentLayout";
import { useRefs } from "@itwin/core-react";

// eslint-disable-next-line @typescript-eslint/naming-convention
const FloatingViewport = viewWithUnifiedSelection(ViewportComponent);

/**
 * @beta
 */
export interface FloatingViewportContentProps {
  /** callback used to construct context menu when user right-clicks on canvas/viewport */
  onContextMenu?: (e: React.MouseEvent) => boolean;
  /** viewport/content control uniqueId */
  contentId: string;
  /** The initial view state used to create the viewport, or a function that returns it (will refresh when the function changes) */
  initialViewState: ViewStateProp;
  /** Function to get a reference to the ScreenViewport */
  viewportRef?: React.Ref<ScreenViewport>;
}

/**
 * FloatingViewportContent component that creates its own [FloatingViewportContentControl].
 * This allows it to be recognized as an "active" content control so that tools operate on this
 * content.
 * @beta
 */
// istanbul ignore next
export function FloatingViewportContent(props: FloatingViewportContentProps) { // eslint-disable-line @typescript-eslint/naming-convention
  const { contentId, initialViewState, viewportRef } = props;
  const [viewport, setViewport] = React.useState<ScreenViewport | undefined>();
  const contentControl = React.useRef<FloatingViewportContentControl | undefined>();

  const viewState = React.useMemo(() => typeof initialViewState === "function" ? initialViewState() : initialViewState, [initialViewState]);
  const ref = React.useCallback((v: ScreenViewport) => {
    setViewport(v);
  }, []);
  const onViewportRef = useRefs(ref, ...(viewportRef ? [viewportRef] : []));

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

  const viewPortControl = React.useMemo(() => {

    const node = <FloatingViewport
      viewportRef={onViewportRef}
      imodel={viewState.iModel}
      viewState={viewState}
      onContextMenu={props.onContextMenu}
      controlId={contentId}
    />;
    let control = node;

    if (!(node as React.ReactElement<any>).key) {
      const additionalProps: any = { key:contentId };
      control = React.cloneElement(node, additionalProps);
    }
    return control;

  }, [onViewportRef, props.onContextMenu, viewState, contentId]);

  React.useEffect(() => {
    if (viewport && contentControl.current) {
      contentControl.current.viewport = viewport;
      if (null === contentControl.current.reactNode) {
        contentControl.current.reactNode = viewPortControl;
      }
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      contentControl.current.viewport.changeView(viewState);
    }
  }, [viewState, viewPortControl, viewport]);

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

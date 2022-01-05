/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./ViewportContentControl.css";
import * as React from "react";
import { Id64String } from "@itwin/core-bentley";
import { IModelConnection, ScreenViewport } from "@itwin/core-frontend";
import { viewWithUnifiedSelection } from "@itwin/presentation-components";
import { ViewportComponent } from "@itwin/imodel-components-react";
import ViewDefinitionSelector, { getViewDefinitions } from "./ViewDefinitionSelector";
import { ContentViewManager, FloatingViewportContentControl } from "@itwin/appui-react";

// eslint-disable-next-line @typescript-eslint/naming-convention
const SampleViewport = viewWithUnifiedSelection(ViewportComponent);

export interface ViewportContentComponentProps {
  imodel: IModelConnection;
  onContextMenu?: (e: React.MouseEvent) => boolean;
}

export default function ViewportContentComponent(props: ViewportContentComponentProps) { // eslint-disable-line @typescript-eslint/naming-convention
  const [viewport, setViewport] = React.useState<ScreenViewport | undefined>();
  const [selectedViewDefinitionId, setSelectedViewDefinitionId] = React.useState<Id64String | undefined>();
  const [prevIModel, setPrevIModel] = React.useState<IModelConnection | undefined>(props.imodel);
  if (prevIModel !== props.imodel) {
    setSelectedViewDefinitionId(undefined);
    setPrevIModel(props.imodel);
  }
  React.useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    getViewDefinitions(props.imodel).then((definitions) => {
      if (definitions.length)
        setSelectedViewDefinitionId(definitions[0].id);
    });
  }, [props.imodel]);

  const onViewDefinitionChanged = React.useCallback((id?: Id64String) => {
    setSelectedViewDefinitionId(id);
  }, []);

  const contentControl = React.useRef<FloatingViewportContentControl | undefined>();

  const viewPortControl = React.useMemo(() =>
    selectedViewDefinitionId ? (
      <SampleViewport
        viewportRef={(v: ScreenViewport) => setViewport(v)}
        imodel={props.imodel}
        viewDefinitionId={selectedViewDefinitionId}
        onContextMenu={props.onContextMenu}
      />
    ) : undefined, [props.imodel, selectedViewDefinitionId, props.onContextMenu]);

  React.useEffect(() => {
    contentControl.current = new FloatingViewportContentControl("TestFloatingControl", "TestFloatingControl", viewPortControl);
    if (viewport)
      contentControl.current.viewport = viewport;
    ContentViewManager.addFloatingContentControl(contentControl.current);
    return () => {
      ContentViewManager.dropFloatingContentControl(contentControl.current);
      contentControl.current = undefined;
    };
  }, [viewPortControl, viewport]);

  return (
    <div className="ViewportContentComponent" style={{ height: "100%", position: "relative" }}>
      {viewPortControl}
      <ViewDefinitionSelector imodel={props.imodel} selectedViewDefinition={selectedViewDefinitionId} onViewDefinitionSelected={onViewDefinitionChanged} />
    </div>
  );
}

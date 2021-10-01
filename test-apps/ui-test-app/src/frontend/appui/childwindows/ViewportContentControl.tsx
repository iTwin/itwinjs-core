/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./ViewportContentControl.css";
import * as React from "react";
import { Id64String } from "@itwin/core-bentley";
import { IModelConnection } from "@itwin/core-frontend";
import { viewWithUnifiedSelection } from "@itwin/presentation-components";
import { ViewportComponent } from "@itwin/imodel-components-react";
import ViewDefinitionSelector, { getViewDefinitions } from "./ViewDefinitionSelector";

// eslint-disable-next-line @typescript-eslint/naming-convention
const SampleViewport = viewWithUnifiedSelection(ViewportComponent);

export interface ViewportContentComponentProps {
  imodel: IModelConnection;
  onContextMenu?: (e: React.MouseEvent) => boolean;
}

export default function ViewportContentComponent(props: ViewportContentComponentProps) { // eslint-disable-line @typescript-eslint/naming-convention
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

  return (
    <div className="ViewportContentComponent" style={{ height: "100%", position: "relative" }}>
      {selectedViewDefinitionId ? (
        <SampleViewport
          imodel={props.imodel}
          viewDefinitionId={selectedViewDefinitionId}
          onContextMenu={props.onContextMenu}
        />
      ) : undefined}
      <ViewDefinitionSelector imodel={props.imodel} selectedViewDefinition={selectedViewDefinitionId} onViewDefinitionSelected={onViewDefinitionChanged} />
    </div>
  );
}

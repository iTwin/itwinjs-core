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
import { MyAppFrontend } from "../../api/MyAppFrontend";
import SelectionScopePicker from "./SelectionScopePicker";
import ViewDefinitionSelector from "./ViewDefinitionSelector";

// eslint-disable-next-line @typescript-eslint/naming-convention
const SampleViewport = viewWithUnifiedSelection(ViewportComponent);

export interface ViewportContentComponentProps {
  imodel: IModelConnection;
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
    MyAppFrontend.getViewDefinitions(props.imodel).then((definitions) => {
      if (definitions.length)
        setSelectedViewDefinitionId(definitions[0].id);
    });
  }, [props.imodel]);

  const onViewDefinitionChanged = React.useCallback((id?: Id64String) => {
    setSelectedViewDefinitionId(id);
  }, []);

  return (
    <div className="ViewportContentComponent" style={{ height: "100%" }}>
      {selectedViewDefinitionId ? (
        <SampleViewport
          imodel={props.imodel}
          viewDefinitionId={selectedViewDefinitionId}
        />
      ) : undefined}
      <ViewDefinitionSelector imodel={props.imodel} selectedViewDefinition={selectedViewDefinitionId} onViewDefinitionSelected={onViewDefinitionChanged} />
      <SelectionScopePicker imodel={props.imodel} />
    </div>
  );
}

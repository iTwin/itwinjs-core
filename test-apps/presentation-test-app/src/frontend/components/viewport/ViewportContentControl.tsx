/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { useState, useCallback, useEffect } from "react"; // tslint:disable-line: no-duplicate-imports
import { Id64String } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ViewportComponent } from "@bentley/ui-components";
import { viewWithUnifiedSelection } from "@bentley/presentation-components";
import { MyAppFrontend } from "../../api/MyAppFrontend";
import ViewDefinitionSelector from "./ViewDefinitionSelector";
import SelectionScopePicker from "./SelectionScopePicker";
import "./ViewportContentControl.css";

// tslint:disable-next-line:variable-name naming-convention
const SampleViewport = viewWithUnifiedSelection(ViewportComponent);

export interface ViewportContentComponentProps {
  imodel: IModelConnection;
}

export default function ViewportContentComponent(props: ViewportContentComponentProps) {
  const [selectedViewDefinitionId, setSelectedViewDefinitionId] = useState<Id64String | undefined>();
  const [prevIModel, setPrevIModel] = useState<IModelConnection | undefined>(props.imodel);
  if (prevIModel !== props.imodel) {
    setSelectedViewDefinitionId(undefined);
    setPrevIModel(props.imodel);
  }
  useEffect(() => {
    // tslint:disable-next-line: no-floating-promises
    MyAppFrontend.getViewDefinitions(props.imodel).then((definitions) => {
      if (definitions.length)
        setSelectedViewDefinitionId(definitions[0].id);
    });
  }, [props.imodel]);

  const onViewDefinitionChanged = useCallback((id?: Id64String) => {
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

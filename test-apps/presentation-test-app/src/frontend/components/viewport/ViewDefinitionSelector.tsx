/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { useState, useCallback, useEffect } from "react"; // tslint:disable-line: no-duplicate-imports
import { Id64String } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { MyAppFrontend } from "../../api/MyAppFrontend";

export interface ViewDefinitionSelectorProps {
  imodel: IModelConnection;
  selectedViewDefinition?: Id64String;
  onViewDefinitionSelected?: (id?: Id64String) => void;
}
export interface RulesetSelectorState {
  availableViewDefinitions?: string[];
}
export default function ViewDefinitionSelector(props: ViewDefinitionSelectorProps) {
  const [availableViewDefinitions, setAvailableViewDefinitions] = useState<Array<{ id: Id64String, class: string, label: string }> | undefined>();
  useEffect(() => {
    setAvailableViewDefinitions([]);
    // tslint:disable-next-line: no-floating-promises
    MyAppFrontend.getViewDefinitions(props.imodel).then(setAvailableViewDefinitions);
  }, [props.imodel]);
  const onViewDefinitionSelected = useCallback((evt: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = evt.target.value || undefined;
    if (props.onViewDefinitionSelected)
      props.onViewDefinitionSelected(selectedId);
  }, []);
  return (
    <div className="ViewDefinitionSelector">
      <select onChange={onViewDefinitionSelected} value={props.selectedViewDefinition}>
        {(availableViewDefinitions ?? []).map((definition) => (
          <option value={definition.id} key={definition.id}>{definition.label}</option>
        ))}
      </select>
    </div>
  );
}

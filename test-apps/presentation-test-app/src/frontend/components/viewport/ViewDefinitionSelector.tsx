/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
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
  const [availableViewDefinitions, setAvailableViewDefinitions] = React.useState<Array<{ id: Id64String, class: string, label: string }> | undefined>();
  React.useEffect(() => {
    setAvailableViewDefinitions([]);
    // tslint:disable-next-line: no-floating-promises
    MyAppFrontend.getViewDefinitions(props.imodel).then(setAvailableViewDefinitions);
  }, [props.imodel]);
  const onViewDefinitionSelected = props.onViewDefinitionSelected;
  const memoizedOnViewDefinitionSelected = React.useCallback((evt: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = evt.target.value || undefined;
    if (onViewDefinitionSelected)
      onViewDefinitionSelected(selectedId);
  }, [onViewDefinitionSelected]);
  return (
    <div className="ViewDefinitionSelector">
      <select onChange={memoizedOnViewDefinitionSelected} value={props.selectedViewDefinition}>
        {(availableViewDefinitions ?? []).map((definition) => (
          <option value={definition.id} key={definition.id}>{definition.label}</option>
        ))}
      </select>
    </div>
  );
}

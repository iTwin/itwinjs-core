/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { Id64String } from "@itwin/core-bentley";
import { IModelConnection } from "@itwin/core-frontend";
import { ViewQueryParams } from "@itwin/core-common";
import { Select, SelectOption } from "@itwin/itwinui-react";

export async function getViewDefinitions(imodel: IModelConnection): Promise<{ id: string, class: string, label: string }[]> {
  const viewQueryParams: ViewQueryParams = { wantPrivate: false };
  const viewSpecs = await imodel.views.queryProps(viewQueryParams);
  return viewSpecs
    .filter((spec) => !spec.isPrivate)
    .map((spec) => ({
      id: spec.id!,
      class: spec.classFullName,
      label: spec.userLabel ?? spec.code.value!,
    }));
}

export interface ViewDefinitionSelectorProps {
  imodel: IModelConnection;
  selectedViewDefinition?: Id64String;
  onViewDefinitionSelected?: (id?: Id64String) => void;
}
export interface RulesetSelectorState {
  availableViewDefinitions?: string[];
}
export default function ViewDefinitionSelector(props: ViewDefinitionSelectorProps) { // eslint-disable-line @typescript-eslint/naming-convention
  const [selectOptions, setSelectOptions] = React.useState<SelectOption<string>[]>([]);
  React.useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    getViewDefinitions(props.imodel).then((result) => {
      const options =  result.map((definition) => (
        { value: definition.id, label: definition.label }
      ));
      setSelectOptions(options);
    }
    );
  }, [props.imodel]);
  return (
    <div className="ViewDefinitionSelector">
      <Select onChange={props.onViewDefinitionSelected} value={props.selectedViewDefinition}
        popoverProps={{ popperOptions: { strategy: "absolute" } }}
        options={selectOptions} size="small" />
    </div>
  );
}

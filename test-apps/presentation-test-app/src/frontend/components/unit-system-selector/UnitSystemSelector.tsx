/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp } from "@itwin/core-frontend";
import { UnitSystemKey } from "@itwin/core-quantity";
import { Select, SelectOption } from "@itwin/itwinui-react";

export interface UnitSystemSelectorProps {
  selectedUnitSystem: UnitSystemKey | undefined;
  onUnitSystemSelected: (unitSystem: UnitSystemKey | undefined) => void;
}

export function UnitSystemSelector(props: UnitSystemSelectorProps) {
  const { selectedUnitSystem, onUnitSystemSelected: onUnitSystemSelectedProp } = props;

  return (
    <div className="UnitSystemSelector">
      <Select
        options={availableUnitSystems}
        value={selectedUnitSystem}
        placeholder={IModelApp.localization.getLocalizedString("Sample:controls.notifications.select-unit-system")}
        onChange={onUnitSystemSelectedProp}
        size="small"
      />
    </div>
  );
}

const availableUnitSystems: SelectOption<UnitSystemKey | undefined>[] = [{
  value: undefined,
  label: "",
}, {
  value: "metric",
  label: "Metric",
}, {
  value: "imperial",
  label: "British Imperial",
}, {
  value: "usCustomary",
  label: "US Customary",
}, {
  value: "usSurvey",
  label: "US Survey",
}];

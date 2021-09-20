/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { UnitSystemKey } from "@bentley/imodeljs-quantity";
import { Select } from "@bentley/ui-core";

export interface UnitSystemSelectorProps {
  selectedUnitSystem: UnitSystemKey | undefined;
  onUnitSystemSelected: (unitSystem: UnitSystemKey | undefined) => void;
}

export function UnitSystemSelector(props: UnitSystemSelectorProps) {
  const { selectedUnitSystem, onUnitSystemSelected: onUnitSystemSelectedProp } = props;
  const onUnitSystemSelected = React.useCallback((evt: React.ChangeEvent<HTMLSelectElement>) => {
    onUnitSystemSelectedProp(evt.target.value ? (evt.target.value as UnitSystemKey) : undefined);
  }, [onUnitSystemSelectedProp]);

  return (
    <div className="UnitSystemSelector">
      {/* eslint-disable-next-line deprecation/deprecation */}
      <Select
        options={availableUnitSystems}
        defaultValue={selectedUnitSystem}
        placeholder={IModelApp.i18n.translate("Sample:controls.notifications.select-unit-system")}
        onChange={onUnitSystemSelected}
      />
    </div>
  );
}

const availableUnitSystems = [{
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

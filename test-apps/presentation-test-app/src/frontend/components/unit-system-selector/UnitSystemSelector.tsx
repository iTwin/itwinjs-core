/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./UnitSystemSelector.css";
import * as React from "react";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { PresentationUnitSystem } from "@bentley/presentation-common";

export interface UnitSystemSelectorProps {
  selectedUnitSystem: PresentationUnitSystem | undefined;
  onUnitSystemSelected: (unitSystem: PresentationUnitSystem | undefined) => void;
}

export default function UnitSystemSelector(props: UnitSystemSelectorProps): JSX.Element | undefined { // eslint-disable-line @typescript-eslint/naming-convention
  const { selectedUnitSystem, onUnitSystemSelected } = props;
  const memoizedOnUnitSystemSelected = React.useCallback((evt: React.ChangeEvent<HTMLSelectElement>) => {
    if (!onUnitSystemSelected)
      return;
    switch (evt.target.value) {
      case PresentationUnitSystem.BritishImperial:
        onUnitSystemSelected(PresentationUnitSystem.BritishImperial);
        break;
      case PresentationUnitSystem.Metric:
        onUnitSystemSelected(PresentationUnitSystem.Metric);
        break;
      case PresentationUnitSystem.UsCustomary:
        onUnitSystemSelected(PresentationUnitSystem.UsCustomary);
        break;
      case PresentationUnitSystem.UsSurvey:
        onUnitSystemSelected(PresentationUnitSystem.UsSurvey);
        break;
      default:
        onUnitSystemSelected(undefined);
    }
  }, [onUnitSystemSelected]);

  return (
    <div className="UnitSystemSelector">
      {IModelApp.i18n.translate("Sample:controls.notifications.select-unit-system")}:
      {/* eslint-disable-next-line jsx-a11y/no-onchange */}
      <select onChange={memoizedOnUnitSystemSelected} value={selectedUnitSystem}>
        {availableUnitSystems.map(({ label, value }: { label: string, value: string }) => (
          <option value={value} key={value}>{label}</option>
        ))}
      </select>
    </div>
  );
}

const availableUnitSystems = [{
  value: "",
  label: "",
}, {
  value: PresentationUnitSystem.Metric,
  label: "Metric",
}, {
  value: PresentationUnitSystem.BritishImperial,
  label: "British Imperial",
}, {
  value: PresentationUnitSystem.UsCustomary,
  label: "US Customary",
}, {
  value: PresentationUnitSystem.UsSurvey,
  label: "US Survey",
}];

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { useCallback } from "react"; // tslint:disable-line: no-duplicate-imports
import { PresentationUnitSystem } from "@bentley/presentation-common";

import "./UnitSystemSelector.css";
import { IModelApp } from "@bentley/imodeljs-frontend";

export interface UnitSystemSelectorProps {
  selectedUnitSystem: PresentationUnitSystem | undefined;
  onUnitSystemSelected: (unitSystem: PresentationUnitSystem | undefined) => void;
}

export default function UnitSystemSelector(props: UnitSystemSelectorProps) {
  const onUnitSystemSelected = useCallback((evt: React.ChangeEvent<HTMLSelectElement>) => {
    if (!props.onUnitSystemSelected)
      return;
    switch (evt.target.value) {
      case PresentationUnitSystem.BritishImperial:
        props.onUnitSystemSelected(PresentationUnitSystem.BritishImperial);
        break;
      case PresentationUnitSystem.Metric:
        props.onUnitSystemSelected(PresentationUnitSystem.Metric);
        break;
      case PresentationUnitSystem.UsCustomary:
        props.onUnitSystemSelected(PresentationUnitSystem.UsCustomary);
        break;
      case PresentationUnitSystem.UsSurvey:
        props.onUnitSystemSelected(PresentationUnitSystem.UsSurvey);
        break;
      default:
        props.onUnitSystemSelected(undefined);
    }
  }, [props.onUnitSystemSelected]);

  return (
    <div className="UnitSystemSelector">
      {IModelApp.i18n.translate("Sample:controls.notifications.select-unit-system")}:
      <select onChange={onUnitSystemSelected} value={props.selectedUnitSystem}>
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

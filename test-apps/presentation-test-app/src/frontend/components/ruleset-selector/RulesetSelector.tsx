/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { IModelApp } from "@bentley/imodeljs-frontend";

import "./RulesetSelector.css";

export interface RulesetSelectorProps {
  availableRulesets: string[];
  onRulesetSelected?: (rulesetId: string) => void;
}
export default class RulesetSelector extends React.Component<RulesetSelectorProps> {
  constructor(props: RulesetSelectorProps) {
    super(props);
    if (props.onRulesetSelected && props.availableRulesets.length > 0)
      props.onRulesetSelected(props.availableRulesets[0]);
  }
  // tslint:disable-next-line:naming-convention
  private onSelectedRulesetIdChanged = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (this.props.onRulesetSelected)
      this.props.onRulesetSelected(e.target.value);
  }
  public render() {
    if (0 === this.props.availableRulesets.length)
      return (<div className="RulesetSelector">{IModelApp.i18n.translate("Sample:controls.notifications.no-available-rulesets")}</div>);
    return (
      <div className="RulesetSelector">
        {IModelApp.i18n.translate("Sample:controls.notifications.select-ruleset")}:
        <select onChange={this.onSelectedRulesetIdChanged}>
          {this.props.availableRulesets.map((rulesetId: string) => (
            <option value={rulesetId} key={rulesetId}>{rulesetId}</option>
          ))}
        </select>
      </div>
    );
  }
}

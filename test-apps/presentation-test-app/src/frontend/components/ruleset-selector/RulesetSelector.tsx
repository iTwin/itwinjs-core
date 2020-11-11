/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./RulesetSelector.css";
import * as React from "react";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { MyAppFrontend } from "../../api/MyAppFrontend";

export interface RulesetSelectorProps {
  onRulesetSelected?: (rulesetId?: string) => void;
}
export interface RulesetSelectorState {
  availableRulesets?: string[];
  activeRulesetId?: string;
}
export default class RulesetSelector extends React.Component<RulesetSelectorProps, RulesetSelectorState> {
  constructor(props: RulesetSelectorProps) {
    super(props);
    this.state = {};
  }
  public componentDidMount() {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.initAvailableRulesets();
  }
  private async initAvailableRulesets() {
    const rulesetIds = await MyAppFrontend.getAvailableRulesets();
    const activeRulesetId = rulesetIds.length > 0 ? rulesetIds[0] : undefined;
    this.setState({ availableRulesets: rulesetIds, activeRulesetId });
  }
  public componentDidUpdate(_prevProps: RulesetSelectorProps, prevState: RulesetSelectorState) {
    if (this.props.onRulesetSelected && this.state.activeRulesetId !== prevState.activeRulesetId)
      this.props.onRulesetSelected(this.state.activeRulesetId);
  }
  // eslint-disable-next-line @typescript-eslint/naming-convention
  private onSelectedRulesetIdChanged = (e: React.ChangeEvent<HTMLSelectElement>) => {
    this.setState({ activeRulesetId: e.target.value });
  };
  public render() {
    if (!this.state.availableRulesets)
      return (<div className="RulesetSelector">{IModelApp.i18n.translate("Sample:controls.notifications.loading")}</div>);
    if (0 === this.state.availableRulesets.length)
      return (<div className="RulesetSelector">{IModelApp.i18n.translate("Sample:controls.notifications.no-available-rulesets")}</div>);
    return (
      <div className="RulesetSelector">
        {IModelApp.i18n.translate("Sample:controls.notifications.select-ruleset")}:
        {/* eslint-disable-next-line jsx-a11y/no-onchange */}
        <select onChange={this.onSelectedRulesetIdChanged}>
          {this.state.availableRulesets.map((rulesetId: string) => (
            <option value={rulesetId} key={rulesetId}>{rulesetId}</option>
          ))}
        </select>
      </div>
    );
  }
}

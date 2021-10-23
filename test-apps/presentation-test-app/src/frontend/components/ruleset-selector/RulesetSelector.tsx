/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp } from "@itwin/core-frontend";
import { Select } from "@itwin/core-react";
import { MyAppFrontend } from "../../api/MyAppFrontend";

export interface RulesetSelectorProps {
  onRulesetSelected: (rulesetId?: string) => void;
  activeRulesetId?: string;
}
export interface RulesetSelectorState {
  availableRulesets?: string[];
}
export class RulesetSelector extends React.Component<RulesetSelectorProps, RulesetSelectorState> {
  constructor(props: RulesetSelectorProps) {
    super(props);
    this.state = {};
  }
  public override componentDidMount() {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.initAvailableRulesets();
  }
  private async initAvailableRulesets() {
    const rulesetIds = await MyAppFrontend.getAvailableRulesets();
    this.setState({ availableRulesets: rulesetIds });
  }
  // eslint-disable-next-line @typescript-eslint/naming-convention
  private onSelectedRulesetIdChanged = (e: React.ChangeEvent<HTMLSelectElement>) => {
    this.props.onRulesetSelected(e.target.value);
  };
  public override render() {
    if (!this.state.availableRulesets)
      return (<div className="RulesetSelector">{IModelApp.localization.getLocalizedString("Sample:controls.notifications.loading")}</div>);
    if (0 === this.state.availableRulesets.length)
      return (<div className="RulesetSelector">{IModelApp.localization.getLocalizedString("Sample:controls.notifications.no-available-rulesets")}</div>);
    return (
      <div className="RulesetSelector">
        {/* eslint-disable-next-line deprecation/deprecation */}
        <Select
          options={this.state.availableRulesets}
          defaultValue={this.props.activeRulesetId}
          placeholder={IModelApp.localization.getLocalizedString("Sample:controls.notifications.select-ruleset")}
          onChange={this.onSelectedRulesetIdChanged}
        />
      </div>
    );
  }
}

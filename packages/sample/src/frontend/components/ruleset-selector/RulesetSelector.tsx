import * as React from "react";

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
      return (<div className="RulesetSelector">No available rulesets</div>);
    return (
      <div className="RulesetSelector">
        Select a ruleset:
        <select onChange={this.onSelectedRulesetIdChanged}>
          {this.props.availableRulesets.map((rulesetId: string) => (
            <option value={rulesetId} key={rulesetId}>{rulesetId}</option>
          ))}
        </select>
      </div>
    );
  }
}

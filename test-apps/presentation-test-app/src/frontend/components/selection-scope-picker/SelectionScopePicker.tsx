/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { SelectionScope } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import "./SelectionScopePicker.css";

export interface SelectionScopePickerProps {
  imodel: IModelConnection;
}
export interface SelectionScopePickerState {
  availableSelectionScopes?: SelectionScope[];
}
export default class SelectionScopePicker extends React.Component<SelectionScopePickerProps, SelectionScopePickerState> {
  constructor(props: SelectionScopePickerProps) {
    super(props);
    this.state = {};
  }
  public componentDidMount() {
    this.initAvailableSelectionScopes(); // tslint:disable-line:no-floating-promises
  }
  private async initAvailableSelectionScopes() {
    const scopes = await Presentation.selection.scopes.getSelectionScopes(this.props.imodel);
    this.setState({ availableSelectionScopes: scopes });
  }
  public componentDidUpdate(prevProps: SelectionScopePickerProps, _prevState: SelectionScopePickerState) {
    if (this.props.imodel !== prevProps.imodel) {
      this.setState({ availableSelectionScopes: undefined });
      this.initAvailableSelectionScopes(); // tslint:disable-line:no-floating-promises
    }
  }
  // tslint:disable-next-line:naming-convention
  private onSelectedScopeChanged = (e: React.ChangeEvent<HTMLSelectElement>) => {
    Presentation.selection.scopes.activeScope = e.target.value;
  }
  public render() {
    if (!this.state.availableSelectionScopes || 0 === this.state.availableSelectionScopes.length)
      return null;
    return (
      <div className="SelectionScopePicker">
        <select onChange={this.onSelectedScopeChanged}>
          {this.state.availableSelectionScopes.map((scope: SelectionScope) => (<option
            selected={Presentation.selection.scopes.activeScope === scope.id}
            value={scope.id}
            key={scope.id}
          >
            {scope.label}
          </option>))}
        </select>
      </div>
    );
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as React from "react";
import { connect } from "react-redux";
import classnames from "classnames";
import { FooterIndicator } from "@bentley/ui-ninezone";
import { UiFramework, PresentationSelectionScope } from "../UiFramework";
import { StatusFieldProps } from "./StatusFieldProps";

import "./SelectionScope.scss";

/** Defines properties supported by the SelectionScopeField Component.
 * @public
 */
interface SelectionScopeFieldProps extends StatusFieldProps {

  activeSelectionScope: string;
  availableSelectionScopes: PresentationSelectionScope[];
}

/**
 * Status Field React component. This component is designed to be specified in a status bar definition.
 * It is used to display the number of selected items based on the Presentation Rules Selection Manager.
 * The IModelApp should call SyncUiEventDispatcher.initializeConnectionEvents with the active iModelConnection each time a new iModel is
 * opened so the selection scope data is properly updated in the Redux state.
 * @public
 */
class SelectionScopeFieldComponent extends React.Component<SelectionScopeFieldProps> {
  private _label = UiFramework.i18n.translate("UiFramework:selectionScopeField.label");
  private _toolTip = UiFramework.i18n.translate("UiFramework:selectionScopeField.toolTip");

  constructor(props: SelectionScopeFieldProps) {
    super(props);
  }

  private _updateSelectValue = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value) {
      UiFramework.setActiveSelectionScope(e.target.value);
    }
  }

  public render(): React.ReactNode {
    return (
      <FooterIndicator
        className={classnames("uifw-statusFields-selectionScope", this.props.className)}
        style={this.props.style}
        isInFooterMode={this.props.isInFooterMode}
      >
        <span className="uifw-statusFields-selectionScope-label">{this._label}:</span>
        <select
          className="uifw-statusFields-selectionScope-selector"
          value={this.props.activeSelectionScope}
          onChange={this._updateSelectValue}
          data-testid="components-selectionScope-selector"
          title={this._toolTip}>

          {this.props.availableSelectionScopes && this.props.availableSelectionScopes.map((scope: PresentationSelectionScope, index: number) => {
            return (
              <option key={index} value={scope.id}>
                {scope.label}
              </option>
            );
          })
          }

        </select>

      </FooterIndicator >
    );
  }
}

/** Function used by Redux to map state data in Redux store to props that are used to render this component. */
function mapStateToProps(state: any) {
  const frameworkState = state[UiFramework.frameworkStateKey];  // since app sets up key, don't hard-code name
  /* istanbul ignore next */
  if (!frameworkState)
    return undefined;

  return { activeSelectionScope: frameworkState.sessionState.activeSelectionScope, availableSelectionScopes: frameworkState.sessionState.availableSelectionScopes };
}

// we declare the variable and export that rather than using export default.
/**
 * SelectionScopeField React component. This component is designed to be specified in a status bar definition. It will
 * display the active selection scope that is used by the PresentationManager to determine what elements are added to the selection nap mode.
 * This React component is Redux connected.
 * @public
 */ // tslint:disable-next-line:variable-name
export const SelectionScopeField = connect(mapStateToProps)(SelectionScopeFieldComponent);

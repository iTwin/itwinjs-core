/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import "./SelectionScope.scss";
import classnames from "classnames";
import * as React from "react";
import { connect } from "react-redux";
import { FooterIndicator } from "@itwin/appui-layout-react";
import { Select } from "@itwin/itwinui-react";
import { PresentationSelectionScope } from "../redux/SessionState";
import { UiFramework } from "../UiFramework";
import { StatusFieldProps } from "./StatusFieldProps";

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
 * The IModelApp should call either UiFramework.setIModelConnection or SyncUiEventDispatcher.initializeConnectionEvents
 * with the active iModelConnection each time a new iModel is opened so the selection scope data is properly updated
 * in the Redux state.
 * @public
 */
function SelectionScopeFieldComponent(props: SelectionScopeFieldProps) {
  const label = UiFramework.translate("selectionScopeField.label");
  const toolTip = UiFramework.translate("selectionScopeField.toolTip");

  const options = React.useMemo(() => props.availableSelectionScopes.map((scope) => {
    return { value: scope.id, label: scope.label };
  }), [props.availableSelectionScopes]);

  const updateSelectValue = (newValue: string) => {
    // istanbul ignore else
    if (newValue) {
      UiFramework.setActiveSelectionScope(newValue);
    }
  };
  return (
    <FooterIndicator // eslint-disable-line deprecation/deprecation
      className={classnames("uifw-statusFields-selectionScope", props.className)}
      style={props.style}
      // eslint-disable-next-line deprecation/deprecation
      isInFooterMode={props.isInFooterMode ?? true}
    >
      {// eslint-disable-next-line deprecation/deprecation
        (props.isInFooterMode ?? true) &&
        <label className="uifw-statusFields-selectionScope-label">
          {label}:
        </label>
      }
      <Select
        className="uifw-statusFields-selectionScope-selector"
        value={props.activeSelectionScope}
        options={options}
        onChange={updateSelectValue}
        data-testid="components-selectionScope-selector"
        title={toolTip}
        size="small" />
    </FooterIndicator >
  );
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
 */ // eslint-disable-next-line @typescript-eslint/naming-convention
export const SelectionScopeField = connect(mapStateToProps)(SelectionScopeFieldComponent);

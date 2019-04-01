/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as React from "react";
import { connect } from "react-redux";
import { SelectionInfo } from "@bentley/ui-ninezone";
import { UiFramework } from "../UiFramework";
import { Icon } from "../shared/IconComponent";

/** Defines properties supported by the SelectionInfo Field Component.
 */
interface SelectionInfoFieldProps {
  isInFooterMode: boolean;
  selectionCount: number;
}

/**
 * Status Field React component. This component is designed to be specified in a status bar definition.
 * It is used to display the number of selected items based on the Presentation Rules Selection Manager.
 */
class SelectionInfoFieldComponent extends React.Component<SelectionInfoFieldProps> {

  constructor(props?: any, context?: any) {
    super(props, context);
  }

  public render(): React.ReactNode {
    const icon = <Icon iconSpec={"icon-cursor"} />;

    const label = this.props.selectionCount.toString();
    return (
      <SelectionInfo
        label={label}
        isInFooterMode={this.props.isInFooterMode}
        icon={icon}
      />
    );
  }
}

/** Function used by Redux to map state data in Redux store to props that are used to render this component. */
function mapStateToProps(state: any) {
  const frameworkState = state[UiFramework.frameworkStateKey];  // since app sets up key, don't hard-code name
  /* istanbul ignore next */
  if (!frameworkState)
    return undefined;

  return { selectionCount: frameworkState.appState.numItemsSelected };
}

// we declare the variable and export that rather than using export default.
/**
 * SelectionInfo Status Field React component. This component is designed to be specified in a status bar definition.
 * It is used to display the number of selected items based on the Presentation Rules Selection Manager.
 * This React component is Redux connected.
 * @public
 */ // tslint:disable-next-line:variable-name
export const SelectionInfoField = connect(mapStateToProps)(SelectionInfoFieldComponent);

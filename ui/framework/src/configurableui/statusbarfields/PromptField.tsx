/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as React from "react";
import { connect } from "react-redux";

import StatusBarText from "@bentley/ui-ninezone/lib/footer/StatusBarText";

/** Defines properties supported by the Prompt Field Component. */
export interface PromptFieldProps {
  isInFooterMode: boolean;
  toolPrompt: string;
}

/** Prompt Field React component. This component is designed to be specified in a status bar definition.
 * It is used to display prompt from tools. To send a prompt to this component use IModelApp.notifications.outputPromptByKey or
 * IModelApp.notifications.outputPrompt.
 */
export class PromptFieldComponent extends React.Component<PromptFieldProps> {

  constructor(props?: any, context?: any) {
    super(props, context);
  }

  public render(): React.ReactNode {
    return (
      <StatusBarText
        label={this.props.toolPrompt}
        isInFooterMode={this.props.isInFooterMode}
      />
    );
  }
}

/** Function used by Redux to map state data in Redux store to props that are used to render this component. */
function mapStateToProps(state: any) {
  return { toolPrompt: state.frameworkState!.configurableUiState.toolPrompt };
}

// we declare the variable and export that rather than using export default.
/** OverallContent React component that is Redux connected. */ // tslint:disable-next-line:variable-name
export const PromptField = connect(mapStateToProps)(PromptFieldComponent);

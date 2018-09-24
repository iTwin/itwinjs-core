/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { connect } from "react-redux";

import StatusBarText from "@bentley/ui-ninezone/lib/footer/StatusBarText";

export interface PromptFieldProps {
  isInFooterMode: boolean;
  toolPrompt: string;
}

/** Prompt Field React component.
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

function mapStateToProps(state: any) {
  return { toolPrompt: state.frameworkState!.configurableUIState.toolPrompt };
}

// we declare the variable and export that rather than using export default.
/** OverallContent React component that is Redux connected. */ // tslint:disable-next-line:variable-name
export const PromptField = connect(mapStateToProps)(PromptFieldComponent);

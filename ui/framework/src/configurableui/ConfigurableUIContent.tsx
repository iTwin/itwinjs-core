/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ConfigurableUi */

import * as React from "react";
import { CSSProperties } from "react";
import { connect } from "react-redux";
import { ModalDialogRenderer } from "./ModalDialogManager";
import { FrontstageComposer } from "./FrontstageComposer";

/** Props for [[ConfigurableUIContent]] */
export interface ConfigurableUIProps {
  placeholder: string;
  appBackstage?: React.ReactNode;
}

function mapStateToProps(state: any) {
  return {
    placeholder: state.frameworkState.configurableUIState.placeHolder,
  };
}

const mapDispatch = {
};

/** The ConfigurableUIContent component is the high order component the pages specified using ConfigurableUi */
class ConfigurableUIContentClass extends React.Component<ConfigurableUIProps> {

  public constructor(props: ConfigurableUIProps) {
    super(props);
  }

  public render(): JSX.Element | undefined {
    const wrapperStyle: CSSProperties = {
      position: "relative" as "relative",
      left: "0px",
      width: "100%",
      top: "0px",
      height: "100%",
      zIndex: 0,
    };
    return (
      <div className="App" style={{ height: "100%" }} >
        <div id="wrapper" style={wrapperStyle}>
          {this.props.appBackstage}
          <FrontstageComposer style={{ position: "relative", height: "100%" }} />
          <ModalDialogRenderer />
        </div>
      </div>
    );
  }
}

/** The ConfigurableUIContent component is the high order component the pages specified using ConfigurableUi */
export const ConfigurableUIContent = connect(mapStateToProps, mapDispatch)(ConfigurableUIContentClass); // tslint:disable-line:variable-name

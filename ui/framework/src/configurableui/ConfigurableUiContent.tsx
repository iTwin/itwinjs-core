/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ConfigurableUi */

import * as React from "react";
import { CSSProperties } from "react";
import { connect } from "react-redux";
import { ModalDialogRenderer } from "./ModalDialogManager";
import { FrontstageComposer } from "./FrontstageComposer";
import { ElementTooltip } from "./ElementTooltip";
import PointerMessage from "../messages/Pointer";

/** Props for [[ConfigurableUiContent]] */
export interface ConfigurableUiContentProps {
  placeholder: string;
  appBackstage?: React.ReactNode;
}

function mapStateToProps(state: any) {
  return {
    placeholder: state.frameworkState.configurableUiState.placeHolder,
  };
}

const mapDispatch = {
};

/** The ConfigurableUiContent component is the high order component the pages specified using ConfigurableUi */
class ConfigurableUiContentClass extends React.Component<ConfigurableUiContentProps> {

  public constructor(props: ConfigurableUiContentProps) {
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
      overflow: "hidden",
    };
    return (
      <div id="configurableui-wrapper" style={wrapperStyle}>
        {this.props.appBackstage}
        <FrontstageComposer style={{ position: "relative", height: "100%" }} />
        <ModalDialogRenderer />
        <ElementTooltip />
        <PointerMessage />
      </div>
    );
  }
}

/** The ConfigurableUiContent component is the high order component the pages specified using ConfigurableUi */
export const ConfigurableUiContent = connect(mapStateToProps, mapDispatch)(ConfigurableUiContentClass); // tslint:disable-line:variable-name

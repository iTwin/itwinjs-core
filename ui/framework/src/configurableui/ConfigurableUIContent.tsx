/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ConfigurableUI */

import * as React from "react";
import { CSSProperties } from "react";
import { connect } from "react-redux";
import { ModalDialogRenderer } from "./ModalDialogManager";
import { FrontstageComposer } from "./FrontstageComposer";
import { ElementTooltip } from "./ElementTooltip";
import PointerMessage from "../messages/Pointer";

/** Props for [[ConfigurableUIContent]] */
export interface ConfigurableUIContentProps {
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

/** The ConfigurableUIContent component is the high order component the pages specified using ConfigurableUI */
class ConfigurableUIContentClass extends React.Component<ConfigurableUIContentProps> {

  public constructor(props: ConfigurableUIContentProps) {
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

/** The ConfigurableUIContent component is the high order component the pages specified using ConfigurableUI */
export const ConfigurableUIContent = connect(mapStateToProps, mapDispatch)(ConfigurableUIContentClass); // tslint:disable-line:variable-name

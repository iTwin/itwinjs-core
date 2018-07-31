/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module OverallContent */

import * as React from "react";
import { connect } from "react-redux";
import { OverallContentPage, OverallContentActions } from "./state";
import { OpenIModel } from "../openimodel/OpenIModel";
import { ConfigurableUIContent } from "../configurableui/ConfigurableUIContent";
import { IModelViewsSelectedFunc } from "../openimodel/IModelPanel";

/** Props for the OverallContentComponent React component */
export interface OverallContentProps {
  appHeaderIcon: React.ReactNode;
  appHeaderMessage: string;
  appHeaderClassName?: string;
  appMessageClassName?: string;
  appBackstage?: React.ReactNode;
  currentPage: OverallContentPage | number;
  onIModelViewsSelected: IModelViewsSelectedFunc;
  setOverallPage: (page: OverallContentPage | number) => any;
}

function mapStateToProps(state: any) {
  return {
    currentPage: state.frameworkState.overallContentState.currentPage,
  };
}

const mapDispatch = {
  setOverallPage: OverallContentActions.setOverallPage,
};

/**
 * The OverallContent component selects one of the pre-defined named components (see [OverallContentPage] enum)
 * or one of the children components depending on the currentPage property.
 */
class OverallContentComponent extends React.Component<OverallContentProps> {

  public constructor(props: OverallContentProps) {
    super(props);
  }

  public render(): JSX.Element | undefined {
    const openIModelProps = {
      appHeaderIcon: this.props.appHeaderIcon,
      appHeaderMessage: this.props.appHeaderMessage,
      appHeaderClassName: this.props.appHeaderClassName,
      appMessageClassName: this.props.appMessageClassName,
      onIModelViewsSelected: this.props.onIModelViewsSelected,
    };
    const configurableUiContentProps = {
      appBackstage: this.props.appBackstage,
    };
    if (OverallContentPage.SelectIModelPage === this.props.currentPage) {
      return <OpenIModel {...openIModelProps} />;
    } else if (OverallContentPage.ConfigurableUIPage === this.props.currentPage) {
      return <ConfigurableUIContent {...configurableUiContentProps} />;
    } else if (React.Children.count(this.props.children) > this.props.currentPage) {
      return React.Children.toArray(this.props.children)[this.props.currentPage] as React.ReactElement<any>;
    }
    return undefined;
  }
}

// we declare the variable and export that rather than using export default.
/** OverallContent React component that is Redux connected. */ // tslint:disable-next-line:variable-name
export const OverallContent = connect(mapStateToProps, mapDispatch)(OverallContentComponent);

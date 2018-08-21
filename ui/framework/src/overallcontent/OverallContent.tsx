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

import { DragDropLayerRenderer } from "../configurableui/DragDropLayerManager";
import HTML5Backend from "react-dnd-html5-backend";
import { DragDropContext } from "react-dnd";

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
    let element: JSX.Element | undefined;
    if (OverallContentPage.SelectIModelPage === this.props.currentPage) {
      element = <OpenIModel {...openIModelProps} />;
    } else if (OverallContentPage.ConfigurableUIPage === this.props.currentPage) {
      element =  <ConfigurableUIContent {...configurableUiContentProps} />;
    } else if (React.Children.count(this.props.children) > this.props.currentPage) {
      element =  React.Children.toArray(this.props.children)[this.props.currentPage] as React.ReactElement<any>;
    }
    return (
      <>
        {element}
        <DragDropLayerRenderer />
      </>
    );
  }
}

// we declare the variable and export that rather than using export default.
/** OverallContent React component that is Redux connected. */ // tslint:disable-next-line:variable-name
export const OverallContent = DragDropContext(HTML5Backend)(connect(mapStateToProps, mapDispatch)(OverallContentComponent));

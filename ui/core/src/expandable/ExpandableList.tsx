/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Expandable */

import * as React from "react";
import "./ExpandableList.scss";

export interface ExpandableListProps {
  className?: string;
  singleExpandOnly?: boolean;
  defaultActiveBlock?: number;
}

interface ExpandableListState {
  activeBlock: number;
}

export class ExpandableList extends React.Component<ExpandableListProps, ExpandableListState> {

  constructor(props: ExpandableListProps, context?: any) {
    super(props, context);

    this.state = { activeBlock: this.props.defaultActiveBlock! };
  }

  public static defaultProps: Partial<ExpandableListProps> = {
    singleExpandOnly: false,
    defaultActiveBlock: 0,
  };

  // set active block
  private _handleBlockClick = (index: number, onClick: () => any) => {
    this.setState( { activeBlock: index });

    if (onClick) {
      onClick(); // fire the ExpandableBlock onClick
    }
  }

  private renderBlocks() {
    return React.Children.map(this.props.children, (child: any, i) => {
      return React.cloneElement(child, {
        key: i,
        isExpanded: (this.props.singleExpandOnly) ? i === this.state.activeBlock : child.props.isExpanded,
        onClick: this._handleBlockClick.bind(this, i, child.props.onClick) });
      });
    }

  public render(): JSX.Element {
    return (
      <div className="BwcExpandableBlocksList">
        {this.renderBlocks()}
      </div>
    );
  }
}

export default ExpandableList;

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module IModelComponents */

import * as React from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { RegisteredRuleset } from "@bentley/presentation-common";
import { IPresentationTreeDataProvider, treeWithUnifiedSelection, PresentationTreeDataProvider } from "@bentley/presentation-components";
import { Tree } from "@bentley/ui-components";
import { Presentation } from "@bentley/presentation-frontend";
import "./SpatialContainmentTree.scss";

// tslint:disable-next-line:variable-name naming-convention
const UnifiedSelectionTree = treeWithUnifiedSelection(Tree);

/**
 * Properties for the [[SpatialContainmentTree]] component
 * @alpha
 */
export interface SpatialContainmentTreeProps {
  iModel: IModelConnection;
}

/**
 * State for the [[SpatialContainmentTree]] component
 * @alpha
 */
export interface SpatialContainmentTreeState {
  initialized: false;
  dataProvider?: IPresentationTreeDataProvider;
}

/**
 * Tree which displays and manages models or categories contained in an iModel.
 * @alpha
 */
// istanbul ignore next
export class SpatialContainmentTree extends React.Component<SpatialContainmentTreeProps, SpatialContainmentTreeState> {
  private _ruleset?: RegisteredRuleset;

  constructor(props: SpatialContainmentTreeProps) {
    super(props);

    this.state = { initialized: false };
  }

  /** @internal */
  public async componentDidMount() {
    await this._initialize();
  }

  /** @internal */
  public componentWillUnmount() {
    if (this._ruleset)
      Presentation.presentation.rulesets().remove(this._ruleset); // tslint:disable-line:no-floating-promises
  }

  private _initialize = async () => {
    return Presentation.presentation.rulesets().add(require("./SpatialBreakdown.json")) // tslint:disable-line:no-floating-promises
      .then((ruleset: RegisteredRuleset) => {
        this._ruleset = ruleset;
        const dataProvider = new PresentationTreeDataProvider(this.props.iModel, this._ruleset!.id);
        this.setState({ dataProvider });
      });
  }

  /** @internal */
  public render() {
    const { dataProvider } = this.state;

    if (!dataProvider)
      return (
        <div />
      );
    else {
      return (
        <div className="uifw-spatial-tree">
          <UnifiedSelectionTree dataProvider={dataProvider} />
        </div>
      );
    }
  }
}

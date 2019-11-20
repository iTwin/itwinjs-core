/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module IModelComponents */

import * as React from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { RegisteredRuleset, Ruleset } from "@bentley/presentation-common";
import { IPresentationTreeDataProvider, treeWithUnifiedSelection, PresentationTreeDataProvider } from "@bentley/presentation-components";
import { Tree } from "@bentley/ui-components";
import { Presentation } from "@bentley/presentation-frontend";
import "./SpatialContainmentTree.scss";
import { SpatialContainmentTreeState } from "./SpatialContainmentTree";

// tslint:disable-next-line:variable-name naming-convention
const UnifiedSelectionTree = treeWithUnifiedSelection(Tree);
const RULESET: Ruleset = require("./SpatialBreakdown.json"); // tslint:disable-line: no-var-requires

/**
 * Properties for the [[SpatialContainmentTree]] component
 * @internal
 * @deprecated
 */
export interface OldSpatialContainmentTreeProps {
  iModel: IModelConnection;
  /** Start loading hierarchy as soon as the component is created */
  enablePreloading?: boolean;
  /** Used for testing */
  dataProvider?: IPresentationTreeDataProvider;
}

/**
 * Tree which displays and manages models or categories contained in an iModel.
 * @internal
 * @deprecated
 */
// istanbul ignore next
export class OldSpatialContainmentTree extends React.Component<OldSpatialContainmentTreeProps, SpatialContainmentTreeState> {
  private _rulesetRegistration?: RegisteredRuleset;

  /**
   * Presentation rules used by this component
   * @internal
   */
  public static readonly RULESET: Ruleset = RULESET;

  constructor(props: OldSpatialContainmentTreeProps) {
    super(props);

    this.state = { initialized: false };
  }

  /** @internal */
  public async componentDidMount() {
    await this._initialize();
  }

  /** @internal */
  public componentWillUnmount() {
    if (this._rulesetRegistration)
      Presentation.presentation.rulesets().remove(this._rulesetRegistration); // tslint:disable-line:no-floating-promises
  }

  private _initialize = async () => {
    this._rulesetRegistration = await Presentation.presentation.rulesets().add(RULESET);
    let dataProvider: IPresentationTreeDataProvider;
    if (this.props.dataProvider)
      dataProvider = this.props.dataProvider;
    else
      dataProvider = new PresentationTreeDataProvider(this.props.iModel, RULESET.id);
    if (this.props.enablePreloading && dataProvider.loadHierarchy)
      await dataProvider.loadHierarchy();
    this.setState({ dataProvider });
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

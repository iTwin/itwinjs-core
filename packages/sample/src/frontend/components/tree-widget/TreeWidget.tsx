import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { Tree } from "@bentley/ecpresentation-controls";

import "./TreeWidget.css";

export interface Props {
  imodel: IModelConnection;
  rulesetId: string;
}
export default class TreeWidget extends React.Component<Props> {
  public render() {
    return (
      <div className="TreeWidget">
        <h3>{IModelApp.i18n.translate("Sample:controls.tree")}</h3>
        <Tree imodel={this.props.imodel} rulesetId={this.props.rulesetId} />
      </div>
    );
  }
}

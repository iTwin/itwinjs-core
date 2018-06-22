import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { ECPresentationTreeDataProvider, withUnifiedSelection  } from "@bentley/ecpresentation-controls/lib/tree";
import { Tree } from "@bentley/ui-components";
import "./TreeWidget.css";

// tslint:disable-next-line:variable-name naming-convention
const SampleTree = withUnifiedSelection(Tree);

export interface Props {
  imodel: IModelConnection;
  rulesetId: string;
}
export default class TreeWidget extends React.Component<Props> {
  public render() {
    return (
      <div className="TreeWidget">
        <h3>{IModelApp.i18n.translate("Sample:controls.tree")}</h3>
        <SampleTree dataProvider={new ECPresentationTreeDataProvider(this.props.imodel, this.props.rulesetId)} />
      </div>
    );
  }
}

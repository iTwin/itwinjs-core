import * as React from "react";
import { Id64Props } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ViewportComponent } from "@bentley/ui-components";
import { withUnifiedSelection } from "@bentley/presentation-controls/lib/viewport";

// tslint:disable-next-line:variable-name naming-convention
const SampleViewport = withUnifiedSelection(ViewportComponent);

export interface Props {
  imodel: IModelConnection;
  rulesetId: string;
  viewDefinitionId: Id64Props;
}
export default class ViewportContentComponent extends React.Component<Props> {
  public render() {
    return (
      <SampleViewport
        imodel={this.props.imodel}
        rulesetId={this.props.rulesetId}
        viewDefinitionId={this.props.viewDefinitionId}
      />
    );
  }
}

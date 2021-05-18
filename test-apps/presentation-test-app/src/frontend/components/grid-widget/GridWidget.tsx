/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./GridWidget.css";
import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { DiagnosticsProps, PresentationTableDataProvider, tableWithUnifiedSelection } from "@bentley/presentation-components";
import { Table } from "@bentley/ui-components";
import { useDisposable } from "@bentley/ui-core";
import { DiagnosticsSelector } from "../diagnostics-selector/DiagnosticsSelector";

// eslint-disable-next-line @typescript-eslint/naming-convention
const SampleTable = tableWithUnifiedSelection(Table);

export interface GridWidgetProps {
  imodel: IModelConnection;
  rulesetId?: string;
}
export function GridWidget(props: GridWidgetProps) {
  const [diagnosticsOptions, setDiagnosticsOptions] = React.useState<DiagnosticsProps>({ ruleDiagnostics: undefined, devDiagnostics: undefined });
  return (
    <div className="gridwidget">
      <h3>{IModelApp.i18n.translate("Sample:controls.grid")}</h3>
      <DiagnosticsSelector onDiagnosticsOptionsChanged={setDiagnosticsOptions} />
      <div className="gridwidget-content">
        {props.rulesetId
          ? <Grid imodel={props.imodel} rulesetId={props.rulesetId} diagnostics={diagnosticsOptions} />
          : null
        }
      </div>
    </div>
  );
}

interface GridProps {
  imodel: IModelConnection;
  rulesetId: string;
  diagnostics: DiagnosticsProps;
}
function Grid(props: GridProps) {
  const { imodel, rulesetId, diagnostics } = props;
  const dataProvider = useDisposable(React.useCallback(
    () => new PresentationTableDataProvider({ imodel, ruleset: rulesetId, ...diagnostics }),
    [imodel, rulesetId, diagnostics],
  ));
  return (<SampleTable dataProvider={dataProvider} />);
}

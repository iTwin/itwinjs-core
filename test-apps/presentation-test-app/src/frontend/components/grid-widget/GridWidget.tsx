/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./GridWidget.css";
import * as React from "react";
import { IModelApp, IModelConnection } from "@itwin/core-frontend";
import { DiagnosticsProps, PresentationTableDataProvider, tableWithUnifiedSelection } from "@itwin/presentation-components";
import { Table } from "@itwin/components-react";
import { useDisposable } from "@itwin/core-react";
import { DiagnosticsSelector } from "../diagnostics-selector/DiagnosticsSelector";

// eslint-disable-next-line deprecation/deprecation
const SampleTable = tableWithUnifiedSelection(Table);

export interface GridWidgetProps {
  imodel: IModelConnection;
  rulesetId?: string;
}
export function GridWidget(props: GridWidgetProps) {
  const [diagnosticsOptions, setDiagnosticsOptions] = React.useState<DiagnosticsProps>({ ruleDiagnostics: undefined, devDiagnostics: undefined });
  return (
    <div className="gridwidget">
      <h3>{IModelApp.localization.getLocalizedString("Sample:controls.grid")}</h3>
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

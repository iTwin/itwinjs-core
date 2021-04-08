/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./DiagnosticsSelector.css";
import React from "react";
import { DiagnosticsLoggerSeverity } from "@bentley/presentation-common";
import { DiagnosticsProps } from "@bentley/presentation-components";
import { consoleDiagnosticsHandler } from "@bentley/presentation-frontend";
import { ContextMenuDirection, GlobalContextMenu, LabeledSelect, LabeledToggle, PointProps } from "@bentley/ui-core";

export interface DiagnosticsSelectorProps {
  onDiagnosticsOptionsChanged: (diagnosticsOptions: DiagnosticsProps) => void;
}

export function DiagnosticsSelector(props: DiagnosticsSelectorProps) {
  const { onDiagnosticsOptionsChanged } = props;

  const [shouldMeasurePerformance, toggleMeasurePerformance] = React.useState(false);
  const [editorSeverity, setEditorSeverity] = React.useState("error");
  const [devSeverity, setDevSeverity] = React.useState("error");
  const result = React.useMemo((): DiagnosticsProps => ({
    ruleDiagnostics: {
      severity: editorSeverity as DiagnosticsLoggerSeverity,
      handler: consoleDiagnosticsHandler,
    },
    devDiagnostics: {
      perf: shouldMeasurePerformance,
      severity: devSeverity as DiagnosticsLoggerSeverity,
      handler: consoleDiagnosticsHandler,
    },
  }), [shouldMeasurePerformance, editorSeverity, devSeverity]);

  const [position, setPosition] = React.useState<PointProps>();
  const onClose = React.useCallback(() => {
    setPosition(undefined);
    onDiagnosticsOptionsChanged(result);
  }, [onDiagnosticsOptionsChanged, result]);

  return (
    <React.Fragment>
      <button onClick={(e) => setPosition({ x: e.clientX, y: e.clientY })}>Diagnostics</button>
      <GlobalContextMenu
        className="DiagnosticsSelector"
        opened={undefined !== position}
        onOutsideClick={onClose}
        onEsc={onClose}
        identifier="Diagnostics"
        x={position?.x ?? 0}
        y={position?.y ?? 0}
        direction={ContextMenuDirection.BottomLeft}
        autoflip={false}
      >
        <LabeledSelect label="Editor severity" options={["error", "warning", "info"]} value={editorSeverity} onChange={(e) => setEditorSeverity(e.currentTarget.value)}></LabeledSelect>
        <LabeledSelect label="Dev severity" options={["error", "warning", "info", "debug", "trace"]} value={devSeverity} onChange={(e) => setDevSeverity(e.currentTarget.value)}></LabeledSelect>
        <LabeledToggle label="Measure performance" isOn={shouldMeasurePerformance} onChange={toggleMeasurePerformance} />
      </GlobalContextMenu>
    </React.Fragment>
  );
}

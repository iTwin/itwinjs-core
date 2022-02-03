/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormat
 */

import "./FormatPanel.scss";
import * as React from "react";
import type { FormatProps, UnitProps, UnitsProvider } from "@itwin/core-quantity";
import { Format, FormatterSpec } from "@itwin/core-quantity";
import type { CommonProps } from "@itwin/core-react";
import { FormatPrecision } from "./FormatPrecision";
import { FormatSample } from "./FormatSample";
import { FormatTypeOption } from "./FormatType";
import { FormatUnitLabel } from "./FormatUnitLabel";
import { FormatUnits } from "./FormatUnits";
import { MiscFormatOptions } from "./MiscFormatOptions";

/** Properties of [[FormatPanel]] component.
 * @alpha
 */
export interface FormatPanelProps extends CommonProps {
  initialFormat: FormatProps;
  unitsProvider: UnitsProvider;
  persistenceUnit: Promise<UnitProps> | UnitProps;
  showSample?: boolean;
  initialMagnitude?: number;
  // if true a only primary format properties are initially displayed and a "More/Less" link is added.
  enableMinimumProperties?: boolean;
  onFormatChange?: (format: FormatProps) => void;
  provideFormatSpec?: (formatProps: FormatProps, persistenceUnit: UnitProps, unitsProvider: UnitsProvider) => Promise<FormatterSpec>;
  providePrimaryChildren?: (formatProps: FormatProps, fireFormatChange: (newProps: FormatProps) => void) => React.ReactNode;
  provideSecondaryChildren?: (formatProps: FormatProps, fireFormatChange: (newProps: FormatProps) => void) => React.ReactNode;
}

async function generateFormatSpec(formatProps: FormatProps, persistenceUnit: UnitProps, unitsProvider: UnitsProvider) {
  const actualFormat = await Format.createFromJSON("custom", unitsProvider, formatProps);
  return FormatterSpec.create(actualFormat.name, actualFormat, unitsProvider, persistenceUnit);
}

/** Component to show/edit Quantity Format.
 * @alpha
 */
export function FormatPanel(props: FormatPanelProps) {
  const [formatSpec, setFormatSpec] = React.useState<FormatterSpec>();
  const { initialFormat, showSample, initialMagnitude, unitsProvider, persistenceUnit, onFormatChange, provideFormatSpec, enableMinimumProperties } = props;
  const [formatProps, setFormatProps] = React.useState(initialFormat);
  const [showOptions, setShowOptions] = React.useState(false);

  React.useEffect(() => {
    setFormatProps(initialFormat);
    setFormatSpec(undefined); // this will trigger the new spec to be created in the useEffect hook
  }, [initialFormat]);

  const handleUserFormatChanges = React.useCallback((newProps: FormatProps) => {
    setFormatProps(newProps);
    setFormatSpec(undefined); // this will trigger the new spec to be created in the useEffect hook
    onFormatChange && onFormatChange(newProps);
  }, [onFormatChange]);

  const isMounted = React.useRef(false);

  // runs returned function only when component is unmounted.
  React.useEffect(() => {
    isMounted.current = true;
    return (() => {
      isMounted.current = false;
    });
  }, []);

  React.useEffect(() => {
    async function fetchFormatSpec() {
      const pu = await persistenceUnit;
      let newFormatSpec: FormatterSpec;
      if (provideFormatSpec) {
        newFormatSpec = await provideFormatSpec(formatProps, pu, unitsProvider);
      } else {
        newFormatSpec = await generateFormatSpec(formatProps, pu, unitsProvider);
      }
      isMounted.current && setFormatSpec(newFormatSpec);
    }
    if (!formatSpec)
      fetchFormatSpec(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }, [formatProps, formatSpec, persistenceUnit, provideFormatSpec, unitsProvider]);

  const handleFormatChange = React.useCallback((newFormatProps: FormatProps) => {
    handleUserFormatChanges(newFormatProps);
  }, [handleUserFormatChanges]);

  const handleShowOptions = React.useCallback((show: boolean) => {
    setShowOptions(show);
  }, []);

  return (
    <div className="components-quantityFormat-panel">
      {showSample &&
        <FormatSample formatSpec={formatSpec} initialMagnitude={initialMagnitude} />
      }
      <FormatUnits unitsProvider={unitsProvider} persistenceUnit={formatSpec?.persistenceUnit} initialFormat={formatProps} onUnitsChange={handleFormatChange} />
      <FormatUnitLabel formatProps={formatProps} onUnitLabelChange={handleFormatChange} />
      <FormatTypeOption formatProps={formatProps} onChange={handleFormatChange} />
      <FormatPrecision formatProps={formatProps} onChange={handleFormatChange} />
      {props.providePrimaryChildren && props.providePrimaryChildren(formatProps, handleFormatChange)}
      <MiscFormatOptions formatProps={formatProps} onChange={handleFormatChange} enableMinimumProperties={enableMinimumProperties} showOptions={showOptions} onShowHideOptions={handleShowOptions}>
        {props.provideSecondaryChildren && props.provideSecondaryChildren(formatProps, handleFormatChange)}
      </MiscFormatOptions>
    </div>
  );
}

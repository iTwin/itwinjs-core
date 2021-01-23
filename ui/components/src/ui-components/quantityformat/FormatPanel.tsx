/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormat
 */

import "./FormatPanel.scss";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { Format, FormatProps, FormatterSpec, UnitProps, UnitsProvider } from "@bentley/imodeljs-quantity";
import { FormatTypeOption } from "./FormatType";
import { FormatPrecision } from "./FormatPrecision";
import { FormatSample } from "./FormatSample";
import { FormatUnits } from "./FormatUnits";
import { FormatUnitLabel } from "./FormatUnitLabel";
import { MiscFormatOptions } from "./MiscFormatOptions";

/** Properties of [[UomSeparatorSelector]] component.
 * @alpha
 */
export interface FormatPanelProps extends CommonProps {
  initialFormat: FormatProps;
  unitsProvider: UnitsProvider;
  persistenceUnit: Promise<UnitProps> | UnitProps;
  showSample?: boolean;
  initialMagnitude?: number;
  onFormatChange?: (format: FormatProps) => void;
  formatSpecFactory?: (persistenceUnit: UnitProps, formatProps: FormatProps, unitsProvider: UnitsProvider) => Promise<FormatterSpec>;
}

async function generateFormatSpec(persistenceUnit: UnitProps, formatProps: FormatProps, unitsProvider: UnitsProvider) {
  const actualFormat = new Format("custom");
  await actualFormat.fromJSON(unitsProvider, formatProps);
  return FormatterSpec.create(actualFormat.name, actualFormat, unitsProvider, persistenceUnit);
}

/** Component to show/edit Quantity Format.
 * @alpha
 */
export function FormatPanel(props: FormatPanelProps) {
  const [formatSpec, setFormatSpec] = React.useState<FormatterSpec>();
  const { initialFormat, showSample, initialMagnitude, unitsProvider, persistenceUnit, onFormatChange, formatSpecFactory } = props;
  const [formatProps, setFormatProps] = React.useState(initialFormat);
  const initialFormatRef = React.useRef<FormatProps>(initialFormat);
  const [showOptions, setShowOptions] = React.useState(false);

  React.useEffect(() => {
    if (initialFormatRef.current !== initialFormat) {
      initialFormatRef.current = initialFormat;
      setFormatProps(initialFormat);
    }
  }, [initialFormat]);

  const handleSetFormatProps = React.useCallback((newProps: FormatProps) => {
    setFormatProps(newProps);
    setFormatSpec(undefined); // this will trigger the new spec to be created in the useEffect hook
    onFormatChange && onFormatChange(newProps);
    // console.log(`FormatProps = ${JSON.stringify(newProps)}`); // eslint-disable-line no-console
  }, [onFormatChange]);

  React.useEffect(() => {
    async function fetchFormatSpec() {
      const pu = await persistenceUnit;
      let newFormatSpec: FormatterSpec;
      if (formatSpecFactory) {
        newFormatSpec = await formatSpecFactory(pu, formatProps, unitsProvider);
      } else {
        newFormatSpec = await generateFormatSpec(pu, formatProps, unitsProvider);
      }
      setFormatSpec(newFormatSpec);
    }
    if (!formatSpec)
      fetchFormatSpec(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }, [formatProps, formatSpec, formatSpecFactory, persistenceUnit, unitsProvider]);

  const handleFormatChange = React.useCallback((newFormatProps: FormatProps) => {
    handleSetFormatProps(newFormatProps);
  }, [handleSetFormatProps]);

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
      <MiscFormatOptions formatProps={formatProps} onChange={handleFormatChange} showOptions={showOptions} onShowHideOptions={handleShowOptions} />
    </div>
  );
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormat
 */

import * as React from "react";
import { getQuantityTypeKey, IModelApp, QuantityTypeArg } from "@bentley/imodeljs-frontend";
import { FormatProps, UnitProps, UnitsProvider } from "@bentley/imodeljs-quantity";
import { Checkbox, CommonProps } from "@bentley/ui-core";
import { FormatPanel } from "./FormatPanel";

/** Properties of [[QuantityFormatPanel]] component.
 * @alpha
 */
export interface QuantityFormatPanelProps extends CommonProps {
  quantityType: QuantityTypeArg;
  onFormatChange?: (format: FormatProps) => void;
  /** props below are to be passed on to FormatPanel */
  showSample?: boolean;
  initialMagnitude?: number;
  enableMinimumProperties?: boolean;
}

/** Component to show/edit Quantity Format.
 * @alpha
 */
export function QuantityFormatPanel(props: QuantityFormatPanelProps) {
  const { quantityType, onFormatChange, ...otherProps } = props;
  const [formatProps, setFormatProps] = React.useState<FormatProps>();
  const [persistenceUnit, setPersistenceUnit] = React.useState(()=>{
    const quantityTypeKey = getQuantityTypeKey(quantityType);
    const quantityTypeEntry = IModelApp.quantityFormatter.quantityTypesRegistry.get(quantityTypeKey);
    return quantityTypeEntry?.persistenceUnit;
  });

  React.useEffect(() => {
    const newFormatProps = IModelApp.quantityFormatter.getFormatPropsByQuantityType(quantityType);
    setFormatProps(newFormatProps);
  }, [quantityType]);

  React.useEffect(() => {
    const quantityTypeKey = getQuantityTypeKey(quantityType);
    const quantityTypeEntry = IModelApp.quantityFormatter.quantityTypesRegistry.get(quantityTypeKey);
    setPersistenceUnit(quantityTypeEntry?.persistenceUnit);
  }, [quantityType]);

  const handleOnFormatChanged = React.useCallback(async (newProps: FormatProps) => {
    setFormatProps(newProps);
    onFormatChange && onFormatChange (newProps);
  }, [onFormatChange]);

  const providePrimaryChildren = React.useCallback(
    (inProps: FormatProps, fireFormatChange: (newProps: FormatProps) => void) => {
      const quantityTypeKey = getQuantityTypeKey(quantityType);
      const quantityTypeEntry = IModelApp.quantityFormatter.quantityTypesRegistry.get(quantityTypeKey);
      if (quantityTypeEntry && quantityTypeEntry.type === "Bearing") {
        const addDirectionLabelGap = !!inProps?.custom?.addDirectionLabelGap;
        return (
          <>
            <span className={"uicore-label"}>Add Direction Gap</span>
            <Checkbox isLabeled={true} checked={addDirectionLabelGap}
              onChange={(e)=>{
                const newProps = {...inProps, custom: {addDirectionLabelGap: e.target.checked}};
                fireFormatChange (newProps);
              }} />
          </>
        );
      }

      return null;
    }, [quantityType]);

  const provideSecondaryChildren = React.useCallback(
    (_inProps: FormatProps, _fireFormatChange: (newProps: FormatProps) => void) => {
      const quantityTypeKey = getQuantityTypeKey(quantityType);
      const quantityTypeEntry = IModelApp.quantityFormatter.quantityTypesRegistry.get(quantityTypeKey);
      if (quantityTypeEntry) {
        // TODO
      }

      return null;
    }, [quantityType]);

  const provideFormatSpec = React.useCallback(
    async (inProps: FormatProps, _persistenceUnit: UnitProps, _unitsProvider: UnitsProvider) => {
      return IModelApp.quantityFormatter.generateFormatterSpecByType(quantityType, inProps);
    }, [quantityType]);

  return (
    <div className="components-quantityFormat-quantityPanel">
      {persistenceUnit && formatProps &&
      <FormatPanel onFormatChange={handleOnFormatChanged} {...otherProps}
        initialFormat={formatProps}
        unitsProvider={IModelApp.quantityFormatter as UnitsProvider}
        persistenceUnit={persistenceUnit}
        providePrimaryChildren={providePrimaryChildren}
        provideSecondaryChildren={provideSecondaryChildren}
        provideFormatSpec={provideFormatSpec}
      /> }
    </div>
  );
}

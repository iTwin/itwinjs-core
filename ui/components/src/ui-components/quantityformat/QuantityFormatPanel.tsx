/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormat
 */

import * as React from "react";
import { CustomFormatPropEditorSpec, getQuantityTypeKey, IModelApp,
  isCheckboxFormatPropEditorSpec, isCustomQuantityTypeEntry, isTextInputFormatPropEditorSpec, isTextSelectFormatPropEditorSpec,
  QuantityTypeArg } from "@bentley/imodeljs-frontend";
import { FormatProps, UnitProps, UnitsProvider } from "@bentley/imodeljs-quantity";
import { Checkbox, CommonProps, Input, Select } from "@bentley/ui-core";
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

function createTextInputFormatPropEditor(key: string, label: string, inProps: FormatProps,
  getString: (props: FormatProps) => string, setString: (props: FormatProps, value: string) => FormatProps, fireFormatChange: (newProps: FormatProps) => void) {
  const value = getString (inProps);
  return (
    <>
      <span key={`${key}-label`} className={"uicore-label"}>{label}</span>
      <Input key={`${key}-editor`}
        value={value}
        onChange={(e) => {
          const newProps = setString(inProps, e.currentTarget.value);
          fireFormatChange (newProps);
        }}
      />
    </>
  );
}

function createSelectFormatPropEditor(key: string, label: string, options: {label: string, value: string}[], inProps: FormatProps,
  getString: (props: FormatProps) => string, setString: (props: FormatProps, value: string) => FormatProps, fireFormatChange: (newProps: FormatProps) => void) {
  const value = getString (inProps);
  return (
    <>
      <span key={`${key}-label`} className={"uicore-label"}>{label}</span>
      <Select key={`${key}-editor`}
        value={value}
        options={options}
        onChange={(e) => {
          const newProps = setString(inProps, e.currentTarget.value);
          fireFormatChange (newProps);
        }}
      />
    </>
  );
}

function createCheckboxFormatPropEditor(key: string, label: string, inProps: FormatProps,
  getBool: (props: FormatProps) => boolean, setBool: (props: FormatProps, isChecked: boolean) => FormatProps, fireFormatChange: (newProps: FormatProps) => void) {
  const isChecked = getBool (inProps);
  return (
    <>
      <span key={`${key}-label`} className={"uicore-label"}>{label}</span>
      <Checkbox  key={`${key}-editor`}
        checked={isChecked}
        onChange={(e)=>{
          const newProps = setBool(inProps, e.target.checked);
          fireFormatChange (newProps);
        }} />
    </>
  );
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

  const createCustomPropEditors = React.useCallback( (specs: CustomFormatPropEditorSpec[], inProps: FormatProps, fireFormatChange: (newProps: FormatProps) => void) => {
    return specs.map((spec, index) => {
      if (isCheckboxFormatPropEditorSpec (spec))
        return createCheckboxFormatPropEditor(`${spec.editorType}-${index}`, spec.label, inProps, spec.getBool, spec.setBool, fireFormatChange);
      if (isTextSelectFormatPropEditorSpec(spec))
        return createSelectFormatPropEditor(`${spec.editorType}-${index}`, spec.label, spec.selectOptions, inProps, spec.getString, spec.setString, fireFormatChange);
      if (isTextInputFormatPropEditorSpec(spec))
        return createTextInputFormatPropEditor(`${spec.editorType}-${index}`, spec.label, inProps, spec.getString, spec.setString, fireFormatChange);
      return <div key={index}/>;
    });
  }, []);

  const providePrimaryChildren = React.useCallback(
    (inProps: FormatProps, fireFormatChange: (newProps: FormatProps) => void) => {
      const quantityTypeKey = getQuantityTypeKey(quantityType);
      const quantityTypeEntry = IModelApp.quantityFormatter.quantityTypesRegistry.get(quantityTypeKey);
      if (quantityTypeEntry && isCustomQuantityTypeEntry(quantityTypeEntry)) {
        if (quantityTypeEntry.primaryPropEditorSpecs)
          return createCustomPropEditors (quantityTypeEntry.primaryPropEditorSpecs, inProps, fireFormatChange);
      }
      return null;
    }, [createCustomPropEditors, quantityType]);

  const provideSecondaryChildren = React.useCallback(
    (inProps: FormatProps, fireFormatChange: (newProps: FormatProps) => void) => {
      const quantityTypeKey = getQuantityTypeKey(quantityType);
      const quantityTypeEntry = IModelApp.quantityFormatter.quantityTypesRegistry.get(quantityTypeKey);
      if (quantityTypeEntry && isCustomQuantityTypeEntry(quantityTypeEntry)) {
        if (quantityTypeEntry.secondaryPropEditorSpecs)
          return createCustomPropEditors (quantityTypeEntry.secondaryPropEditorSpecs, inProps, fireFormatChange);
      }
      return null;
    }, [createCustomPropEditors, quantityType]);

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

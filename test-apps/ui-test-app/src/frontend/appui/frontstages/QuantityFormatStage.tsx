/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./QuantityFormatStage.scss";
import * as React from "react";
import { ModalFrontstageInfo, UiFramework } from "@bentley/ui-framework";
import { IModelApp, QuantityType } from "@bentley/imodeljs-frontend";
import { Button, ButtonType, Listbox, ListboxItem } from "@bentley/ui-core";
import { Format, FormatProps, FormatterSpec, UnitsProvider } from "@bentley/imodeljs-quantity";
import { FormatPanel } from "@bentley/ui-components";

/** Modal frontstage displaying the active QuantityFormatStage.
 * @alpha
 */
export class QuantityFormatModalFrontstage implements ModalFrontstageInfo {
  public title: string = UiFramework.i18n.translate("SampleApp:QuantityFormatModalFrontstage.QuantityFormatStage");
  public get content(): React.ReactNode { return (<QuantityFormatStage />); }
}

function enumKeys<O extends object, K extends keyof O = keyof O>(obj: O): K[] {
  return Object.keys(obj).filter((k) => Number.isNaN(+k)) as K[];
}

function QuantityFormatStage() {
  const [activeFormatterSpec, setActiveFormatterSpec] = React.useState<FormatterSpec>();
  const handleKeypressOnSourceList = React.useCallback((_event: React.KeyboardEvent<HTMLUListElement>) => {
  }, []);

  const onListboxValueChange = React.useCallback((enumValue: string) => {
    const quantityType = Number.parseInt(enumValue, 10) as QuantityType;
    const volumeFormatterSpec = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(quantityType);
    setActiveFormatterSpec(volumeFormatterSpec);
  }, []);

  const handleOnFormatChanged = React.useCallback((format: FormatProps) => {
    async function fetchFormatSpec(formatProps: FormatProps) {
      if (activeFormatterSpec) {
        const pu = activeFormatterSpec.persistenceUnit;
        const actualFormat = new Format("custom");
        const unitsProvider = IModelApp.quantityFormatter as UnitsProvider;
        await actualFormat.fromJSON(unitsProvider, formatProps);
        const newSpec = await FormatterSpec.create(actualFormat.name, actualFormat, unitsProvider, pu);
        setActiveFormatterSpec(newSpec);
      }
    }
    fetchFormatSpec(format); // eslint-disable-line @typescript-eslint/no-floating-promises
  }, [activeFormatterSpec]);

  const handleOnFormatSave = React.useCallback(() => {
  }, []);

  return (
    <div className="quantity-types-container">
      <div className="left-panel">
        <Listbox id="quantity-types-list" className="quantity-types" onKeyPress={handleKeypressOnSourceList} onListboxValueChange={onListboxValueChange} >
          {
            enumKeys(QuantityType).map((enumValue) =>
              <ListboxItem key={enumValue} className="quantity-type-list-entry" value={QuantityType[enumValue].toString()}>
                <span className="map-source-list-entry-name" title={enumValue}>{enumValue}</span>
              </ListboxItem>)
          }
        </Listbox>
      </div>
      <div className="right-panel">
        {activeFormatterSpec &&
          <div className="quantity-types-formats">
            <FormatPanel onFormatChange={handleOnFormatChanged} initialMagnitude={1234.56}
              initialFormat={activeFormatterSpec.format.toJSON()} showSample={true}
              unitsProvider={IModelApp.quantityFormatter as UnitsProvider} persistenceUnit={activeFormatterSpec.persistenceUnit} />
            <div className="components-button-panel">
              <Button buttonType={ButtonType.Blue} onClick={handleOnFormatSave}>Save</Button>
            </div>
          </div>
        }
      </div>
    </div >
  );
}

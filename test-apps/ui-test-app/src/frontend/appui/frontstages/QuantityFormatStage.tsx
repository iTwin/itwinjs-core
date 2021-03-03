/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./QuantityFormatStage.scss";
import * as React from "react";
import { DeepCompare } from "@bentley/geometry-core";
import {
  getQuantityTypeKey, IModelApp, QuantityFormatsChangedArgs, QuantityType, QuantityTypeArg, QuantityTypeKey,
} from "@bentley/imodeljs-frontend";
import { FormatProps, FormatterSpec } from "@bentley/imodeljs-quantity";
import { DialogButtonType } from "@bentley/ui-abstract";
import { FormatSample, QuantityFormatPanel } from "@bentley/ui-components";
import {
  Button, ButtonType, Dialog, Listbox, ListboxItem, SettingsTabEntry,
  useSaveBeforeActivatingNewSettingsTab, useSaveBeforeClosingSettingsContainer,
} from "@bentley/ui-core";
import { ModalDialogManager, UiFramework } from "@bentley/ui-framework";

function formatAreEqual(obj1: FormatProps, obj2: FormatProps) {
  const compare = new DeepCompare();
  return compare.compare(obj1, obj2);
}

/**
 * Return a SettingsTabEntry that can be used to define the available settings that can be set for an application.
 * @param itemPriority - Used to define the order of the entry in the Settings Stage
 * @alpha
 */
export function getQuantityFormatsSettingsManagerEntry(itemPriority: number): SettingsTabEntry {
  return {
    itemPriority, tabId: "ui-test-app:Quantity", label: "Quantity",
    page: <QuantityFormatSettingsPanel initialQuantityType={QuantityType.Length} />,
    isDisabled: false,
    icon: "icon-measure",
    tooltip: "Quantity Formats",
    pageWillHandleCloseRequest: true,
  };
}

export function QuantityFormatSettingsPanel({ initialQuantityType }: { initialQuantityType: QuantityTypeArg }) {
  const [activeQuantityType, setActiveQuantityType] = React.useState(getQuantityTypeKey(initialQuantityType));
  const [activeFormatterSpec, setActiveFormatterSpec] =
    React.useState<FormatterSpec | undefined>(IModelApp.quantityFormatter.findFormatterSpecByQuantityType(getQuantityTypeKey(initialQuantityType)));
  const [saveEnabled, setSaveEnabled] = React.useState(false);
  const [clearEnabled, setClearEnabled] = React.useState(IModelApp.quantityFormatter.hasActiveOverride(initialQuantityType, true));
  const newQuantityTypeRef = React.useRef<QuantityTypeKey>();

  /* Not yet needed as no way to change system from modal stage
  React.useEffect(() => {
    const handleUnitSystemChanged = ((): void => {
      setActiveFormatterSpec(IModelApp.quantityFormatter.findFormatterSpecByQuantityType(activeQuantityType));
      setSaveEnabled(false);
      setClearEnabled(IModelApp.quantityFormatter.hasActiveOverride(activeQuantityType, true));
    });

    IModelApp.quantityFormatter.onActiveFormattingUnitSystemChanged.addListener(handleUnitSystemChanged);
    return () => {
      IModelApp.quantityFormatter.onActiveFormattingUnitSystemChanged.removeListener(handleUnitSystemChanged);
    };
  }, [activeQuantityType]);
  */

  React.useEffect(() => {
    const handleFormatChanged = ((args: QuantityFormatsChangedArgs): void => {
      if (!newQuantityTypeRef.current) {
        const quantityKey = IModelApp.quantityFormatter.getQuantityTypeKey(activeQuantityType);
        if (args.quantityType === quantityKey) {
          setActiveFormatterSpec(IModelApp.quantityFormatter.findFormatterSpecByQuantityType(activeQuantityType));
          setSaveEnabled(false);
          setClearEnabled(IModelApp.quantityFormatter.hasActiveOverride(activeQuantityType, true));
        }
      }
      newQuantityTypeRef.current = undefined;
    });
    IModelApp.quantityFormatter.onQuantityFormatsChanged.addListener(handleFormatChanged);
    return () => {
      IModelApp.quantityFormatter.onQuantityFormatsChanged.removeListener(handleFormatChanged);
    };
  }, [activeQuantityType]);

  const saveChanges = React.useCallback((afterSaveFunction: (args: any) => void, args?: any) => {
    if (activeFormatterSpec) {
      const formatProps = activeFormatterSpec.format.toJSON();
      const formatPropsInUse = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(activeQuantityType)?.format.toJSON();
      if (formatPropsInUse && !formatAreEqual(formatProps, formatPropsInUse)) {
        ModalDialogManager.openDialog(<SaveFormatModalDialog formatProps={formatProps} quantityType={activeQuantityType} onDialogCloseArgs={args} onDialogClose={afterSaveFunction} />, "saveQuantityFormat");
        return;
      }
    }
    afterSaveFunction(args);
  }, [activeFormatterSpec, activeQuantityType]);

  useSaveBeforeActivatingNewSettingsTab(UiFramework.settingsManager, saveChanges);
  useSaveBeforeClosingSettingsContainer(UiFramework.settingsManager, saveChanges);

  const processListboxValueChange = React.useCallback((newQuantityType: QuantityTypeKey) => {
    const volumeFormatterSpec = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(newQuantityType);
    setActiveFormatterSpec(volumeFormatterSpec);
    setActiveQuantityType(newQuantityType);
    setSaveEnabled(false);
    setClearEnabled(IModelApp.quantityFormatter.hasActiveOverride(newQuantityType, true));
  }, []);

  const onListboxValueChange = React.useCallback((newQuantityType: string) => {
    if (activeFormatterSpec) {
      const formatProps = activeFormatterSpec.format.toJSON();
      const formatPropsInUse = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(activeQuantityType)?.format.toJSON();
      if (formatPropsInUse && !formatAreEqual(formatProps, formatPropsInUse)) {
        newQuantityTypeRef.current = newQuantityType;
        ModalDialogManager.openDialog(<SaveFormatModalDialog formatProps={formatProps} quantityType={activeQuantityType} onDialogCloseArgs={newQuantityType} onDialogClose={processListboxValueChange} />, "saveQuantityFormat");
        return;
      }
    }
    processListboxValueChange(newQuantityType);
  }, [activeFormatterSpec, activeQuantityType, processListboxValueChange]);

  const handleOnFormatChanged = React.useCallback(async (formatProps: FormatProps) => {
    if (activeFormatterSpec) {
      const newSpec = await IModelApp.quantityFormatter.generateFormatterSpecByType(activeQuantityType, formatProps);
      const formatPropsInUse = IModelApp.quantityFormatter.getFormatPropsByQuantityType(activeQuantityType);
      if (formatPropsInUse)
        setSaveEnabled(!formatAreEqual(formatProps, formatPropsInUse));
      setActiveFormatterSpec(newSpec);
    }
  }, [activeFormatterSpec, activeQuantityType]);

  const handleOnFormatSave = React.useCallback(async () => {
    if (activeFormatterSpec) {
      const format = activeFormatterSpec.format.toJSON();
      await IModelApp.quantityFormatter.setOverrideFormat(activeQuantityType, format);
      setClearEnabled(true);
    }
  }, [activeFormatterSpec, activeQuantityType]);

  const handleOnFormatReset = React.useCallback(async () => {
    await IModelApp.quantityFormatter.clearOverrideFormats(activeQuantityType);
    setClearEnabled(false);
  }, [activeQuantityType]);

  return (
    <div className="quantity-types-stage">
      <div className="quantity-types-container">
        <div className="left-panel">
          <Listbox id="quantity-types-list" className="quantity-types"
            onListboxValueChange={onListboxValueChange} selectedValue={activeQuantityType} >
            {
              [...IModelApp.quantityFormatter.quantityTypesRegistry.keys()].map((key) => {
                const entry = IModelApp.quantityFormatter.quantityTypesRegistry.get(key)!;
                const description = entry.description;
                const label = entry.label;
                return (
                  <ListboxItem key={entry.key} className="quantity-type-list-entry" value={entry.key}>
                    <span className="map-source-list-entry-name" title={description}>{label}</span>
                  </ListboxItem>
                );
              })
            }
          </Listbox>
        </div>
        <div className="right-panel">
          {activeFormatterSpec &&
            <>
              <div className="quantity-types-right-top">
                <div className="quantity-types-right-top-sample">
                  <FormatSample formatSpec={activeFormatterSpec} initialMagnitude={1234.56} hideLabels />
                </div>
              </div>
              <div className="quantity-types-formats">
                <QuantityFormatPanel onFormatChange={handleOnFormatChanged} quantityType={activeQuantityType} />
              </div>
              <div className="components-button-panel">
                <Button buttonType={ButtonType.Blue} onClick={handleOnFormatSave} disabled={!saveEnabled}>Set</Button>
                <Button buttonType={ButtonType.Hollow} onClick={handleOnFormatReset} disabled={!clearEnabled}>Clear</Button>
              </div>
            </>
          }
        </div>
      </div>
    </div>
  );
}

function SaveFormatModalDialog({ formatProps, quantityType, onDialogCloseArgs, onDialogClose }: { formatProps: FormatProps, quantityType: QuantityTypeKey, onDialogCloseArgs?: any, onDialogClose: (args?: any) => void }) {
  const [isOpen, setIsOpen] = React.useState(true);

  const handleClose = React.useCallback(() => {
    setIsOpen(false);
    ModalDialogManager.closeDialog();
    if (onDialogClose)
      onDialogClose(onDialogCloseArgs);
  }, [onDialogClose, onDialogCloseArgs]);

  const handleOK = React.useCallback(() => {
    void IModelApp.quantityFormatter.setOverrideFormat(quantityType, formatProps); // eslint-disable-line @typescript-eslint/no-floating-promises
    handleClose();
  }, [formatProps, handleClose, quantityType]);

  const handleCancel = React.useCallback(() => {
    handleClose();
  }, [handleClose]);

  return (
    <Dialog
      title={"Save Format Changes"}
      opened={isOpen}
      resizable={false}
      movable={false}
      modal={true}
      buttonCluster={[
        { type: DialogButtonType.Yes, onClick: handleOK },
        { type: DialogButtonType.No, onClick: handleCancel },
      ]}
      onEscape={handleCancel}
      onClose={handleCancel}
      onOutsideClick={handleCancel}
      minHeight={150}
      maxHeight={400}
      maxWidth={400}
      minWidth={200}
    >
      <div className="modal-dialog2">
        Do you want to save changes to format before changing to another type?
      </div>
    </Dialog >
  );
}

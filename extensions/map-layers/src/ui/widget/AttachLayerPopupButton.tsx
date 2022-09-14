/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp, MapLayerSource, MapLayerSourceStatus, NotifyMessageDetails, OutputMessagePriority } from "@itwin/core-frontend";
import { RelativePosition } from "@itwin/appui-abstract";
import * as UiCore from "@itwin/core-react";
import { ModalDialogManager } from "@itwin/appui-react";
import { useSourceMapContext } from "./MapLayerManager";
import { MapUrlDialog } from "./MapUrlDialog";
import { ConfirmMessageDialog } from "./ConfirmMessageDialog";
import { Button, Input } from "@itwin/itwinui-react";
import { MapLayerPreferences } from "../../MapLayerPreferences";
import { MapLayersUI } from "../../mapLayers";

// cSpell:ignore droppable Sublayer

enum LayerAction {
  Attached,
  Edited
}

interface AttachLayerPanelProps {
  isOverlay: boolean;
  onLayerAttached: () => void;
  onHandleOutsideClick?: (shouldHandle: boolean) => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function AttachLayerPanel({ isOverlay, onLayerAttached, onHandleOutsideClick }: AttachLayerPanelProps) {
  const [layerNameToAdd, setLayerNameToAdd] = React.useState<string | undefined>();
  const [sourceFilterString, setSourceFilterString] = React.useState<string | undefined>();

  const { placeholderLabel, addCustomLayerLabel, addCustomLayerToolTip, loadingMapSources, removeLayerDefButtonTitle, editLayerDefButtonTitle, removeLayerDefDialogTitle } = React.useMemo(() => {
    return {
      placeholderLabel: MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.SearchPlaceholder"),
      addCustomLayerLabel: MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.Custom"),
      addCustomLayerToolTip: MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.AttachCustomLayer"),
      loadingMapSources: MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.LoadingMapSources"),
      removeLayerDefButtonTitle: MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.RemoveLayerDefButtonTitle"),
      editLayerDefButtonTitle: MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.EditLayerDefButtonTitle"),
      removeLayerDefDialogTitle: MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.RemoveLayerDefDialogTitle"),
    };
  }, []);

  const [loading, setLoading] = React.useState(false);
  const [layerNameUnderCursor, setLayerNameUnderCursor] = React.useState<string | undefined>();

  const resumeOutsideClick = React.useCallback(() => {
    if (onHandleOutsideClick) {
      onHandleOutsideClick(true);
    }
  }, [onHandleOutsideClick]);

  // 'isMounted' is used to prevent any async operation once the hook has been
  // unloaded.  Otherwise we get a 'Can't perform a React state update on an unmounted component.' warning in the console.
  const isMounted = React.useRef(false);
  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;

      // We close any open dialogs that we might have opened
      // This was added because the modal dialog remained remained displayed after the session expired.
      ModalDialogManager.closeDialog();
    };
  }, []);

  const handleFilterTextChanged = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSourceFilterString(event.target.value);
  }, []);

  const { loadingSources, sources, activeViewport, backgroundLayers, overlayLayers, mapLayerOptions } = useSourceMapContext();
  const mapTypesOptions = mapLayerOptions?.mapTypeOptions;
  const iTwinId = activeViewport?.iModel?.iTwinId;
  const iModelId = activeViewport?.iModel?.iModelId;

  const styleContainsLayer = React.useCallback((name: string) => {
    if (backgroundLayers) {
      if (-1 !== backgroundLayers.findIndex((layer) => layer.name === name))
        return true;
    }
    if (overlayLayers) {
      if (-1 !== overlayLayers.findIndex((layer) => layer.name === name))
        return true;
    }
    return false;
  }, [backgroundLayers, overlayLayers]);

  const handleModalUrlDialogOk = React.useCallback((action: LayerAction) => {
    if (LayerAction.Attached === action) {
    // close popup and refresh UI
      onLayerAttached();
    }

    resumeOutsideClick();
  }, [onLayerAttached, resumeOutsideClick]);

  const handleModalUrlDialogCancel = React.useCallback(() => {
    // close popup and refresh UI
    setLoading(false);
    ModalDialogManager.closeDialog();
    resumeOutsideClick();
  }, [resumeOutsideClick]);

  React.useEffect(() => {
    async function attemptToAddLayer(layerName: string) {
      if (layerName && activeViewport) {
        // if the layer is not in the style add it now.
        if (undefined === backgroundLayers?.find((layer) => layerName === layer.name) && undefined === overlayLayers?.find((layer) => layerName === layer.name)) {
          const mapLayerSettings = sources?.find((source) => source.name === layerName);
          if (mapLayerSettings === undefined) {
            return;
          }

          try {
            if (isMounted.current) {
              setLoading(true);
            }

            const { status, subLayers } = await mapLayerSettings.validateSource();
            if (status === MapLayerSourceStatus.Valid || status === MapLayerSourceStatus.RequireAuth) {

              if (status === MapLayerSourceStatus.Valid) {
                const settings = mapLayerSettings.toLayerSettings(subLayers);

                if (settings) {
                  activeViewport.displayStyle.attachMapLayer({settings, isOverlay});

                  activeViewport.invalidateRenderPlan();

                  const msg = IModelApp.localization.getLocalizedString("mapLayers:Messages.MapLayerAttached", { sourceName: settings.name, sourceUrl: settings.url });
                  IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
                }

                if (isMounted.current) {
                  setLoading(false);
                }
                if (onLayerAttached) {
                  onLayerAttached();
                }

              } else if (status === MapLayerSourceStatus.RequireAuth && isMounted.current) {
                ModalDialogManager.openDialog(
                  <MapUrlDialog
                    activeViewport={activeViewport}
                    isOverlay={isOverlay}
                    layerRequiringCredentials={mapLayerSettings.toJSON()}
                    onOkResult={()=>handleModalUrlDialogOk(LayerAction.Attached)}
                    onCancelResult={handleModalUrlDialogCancel}
                    mapTypesOptions={mapTypesOptions} />
                );
                if (onHandleOutsideClick) {
                  onHandleOutsideClick(false);
                }
              }

            } else {
              const msg = IModelApp.localization.getLocalizedString("mapLayers:Messages.MapLayerValidationFailed", { sourceUrl: mapLayerSettings.url });
              IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
              if (isMounted.current) {
                setLoading(false);
              }
            }
          } catch (err) {
            if (isMounted.current) {
              setLoading(false);
            }
            const msg = IModelApp.localization.getLocalizedString("mapLayers:Messages.MapLayerAttachError", { error: err, sourceUrl: mapLayerSettings.url });
            IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
          }
        }

      }
      return;
    }

    if (layerNameToAdd) {
      attemptToAddLayer(layerNameToAdd); // eslint-disable-line @typescript-eslint/no-floating-promises

      if (isMounted.current) {
        setLayerNameToAdd(undefined);
      }
    }
  }, [setLayerNameToAdd, layerNameToAdd, activeViewport, sources, backgroundLayers, isOverlay, overlayLayers, onLayerAttached, handleModalUrlDialogOk, mapTypesOptions, handleModalUrlDialogCancel, onHandleOutsideClick]);

  const options = React.useMemo(() => sources?.filter((source) => !styleContainsLayer(source.name)), [sources, styleContainsLayer]);
  const filteredOptions = React.useMemo(() => {
    if (undefined === sourceFilterString || 0 === sourceFilterString.length) {
      return options;
    } else {
      return options?.filter((option) => option.name.toLowerCase().includes(sourceFilterString?.toLowerCase()));
    }
  }, [options, sourceFilterString]);

  const handleAddNewMapSource = React.useCallback(() => {
    ModalDialogManager.openDialog(<MapUrlDialog
      activeViewport={activeViewport}
      isOverlay={isOverlay}
      onOkResult={()=>handleModalUrlDialogOk(LayerAction.Attached)}
      onCancelResult={handleModalUrlDialogCancel}
      mapTypesOptions={mapTypesOptions} />);
    if (onHandleOutsideClick) {
      onHandleOutsideClick(false);
    }
    return;
  }, [activeViewport, handleModalUrlDialogCancel, handleModalUrlDialogOk, isOverlay, mapTypesOptions, onHandleOutsideClick]);

  const handleAttach = React.useCallback((mapName: string) => {
    setLayerNameToAdd(mapName);
  }, []);

  const handleKeypressOnSourceList = React.useCallback((event: React.KeyboardEvent<HTMLUListElement>) => {
    const key = event.key;
    if (key === "Enter") {
      event.preventDefault();
      const mapName = event.currentTarget?.dataset?.value;
      if (mapName && mapName.length) {
        handleAttach(mapName);
      }
    }
  }, [handleAttach]);

  const onListboxValueChange = React.useCallback((mapName: string) => {
    setLayerNameToAdd(mapName);
  }, []);

  const handleNoConfirmation = React.useCallback((_layerName: string) => {
    ModalDialogManager.closeDialog();
    resumeOutsideClick();
  }, [resumeOutsideClick]);

  const handleYesConfirmation = React.useCallback(async (source: MapLayerSource) => {
    const layerName = source.name;
    if (!!iTwinId && !!iModelId) {
      try {
        await MapLayerPreferences.deleteByName(source, iTwinId, iModelId);
        const msg = MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.RemoveLayerDefSuccess", { layerName });
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
      } catch (err: any) {
        const msg = MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.RemoveLayerDefError", { layerName });
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
      }
    }

    ModalDialogManager.closeDialog();
    resumeOutsideClick();
  }, [iTwinId, iModelId, resumeOutsideClick]);

  /*
   Handle Remove layer button clicked
   */
  const onItemRemoveButtonClicked = React.useCallback((source, event) => {
    event.stopPropagation();  // We don't want the owning ListBox to react on mouse click.

    const layerName = source.name;

    const msg = MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.RemoveLayerDefDialogMessage", { layerName });
    ModalDialogManager.openDialog(
      <ConfirmMessageDialog
        className="map-sources-delete-confirmation"
        title={removeLayerDefDialogTitle}
        message={msg}
        maxWidth={400}
        onClose={() => handleNoConfirmation(layerName)}
        onEscape={() => handleNoConfirmation(layerName)}
        onYesResult={async () => handleYesConfirmation(source)}
        onNoResult={() => handleNoConfirmation(layerName)}
      />
    );
    if (onHandleOutsideClick) {
      onHandleOutsideClick(false);
    }
  }, [handleNoConfirmation, handleYesConfirmation, onHandleOutsideClick, removeLayerDefDialogTitle]);

  /*
 Handle Edit layer button clicked
 */
  const onItemEditButtonClicked = React.useCallback((event) => {
    event.stopPropagation();  // We don't want the owning ListBox to react on mouse click.

    const targetLayerName = event?.currentTarget?.parentNode?.dataset?.value;
    const matchingSource = sources.find((layerSource) => layerSource.name === targetLayerName);

    // we expect a single layer source matching this name
    if (matchingSource === undefined) {
      return;
    }
    ModalDialogManager.openDialog(<MapUrlDialog
      activeViewport={activeViewport}
      isOverlay={isOverlay}
      mapLayerSourceToEdit={matchingSource}
      onOkResult={()=>handleModalUrlDialogOk(LayerAction.Edited)}
      onCancelResult={handleModalUrlDialogCancel}
      mapTypesOptions={mapTypesOptions} />);

    if (onHandleOutsideClick) {
      onHandleOutsideClick(false);
    }
  }, [activeViewport, handleModalUrlDialogCancel, handleModalUrlDialogOk, isOverlay, mapTypesOptions, onHandleOutsideClick, sources]);

  return (
    <div className="map-manager-header">
      {(loading || loadingSources) && <UiCore.LoadingSpinner message={loadingMapSources} />}
      <div className="map-manager-source-listbox-header">
        <Input type="text" className="map-manager-source-list-filter"
          placeholder={placeholderLabel}
          value={sourceFilterString}
          onChange={handleFilterTextChanged}
          size="small" />
        <Button className="map-manager-add-source-button" title={addCustomLayerToolTip} onClick={handleAddNewMapSource}>
          {addCustomLayerLabel}</Button>
      </div>
      <div className="map-manager-sources">
        <UiCore.Listbox
          id="map-sources"
          selectedValue={layerNameToAdd}
          className="map-manager-source-list"
          onKeyPress={handleKeypressOnSourceList}
          onListboxValueChange={onListboxValueChange} >
          {
            filteredOptions?.map((source) =>
              <UiCore.ListboxItem
                key={source.name}
                className="map-source-list-entry"
                value={source.name}
                onMouseEnter={() => setLayerNameUnderCursor(source.name)}
                onMouseLeave={() => setLayerNameUnderCursor(undefined)}>
                <span className="map-source-list-entry-name" title={source.name}>{source.name}</span>

                { // Display the delete icon only when the mouse over a specific item
                  // otherwise list feels cluttered.
                  (!!iTwinId && !!iModelId && layerNameUnderCursor && layerNameUnderCursor === source.name) &&
                  <>
                    <Button
                      size="small"
                      styleType="borderless"
                      className="map-source-list-entry-button"
                      title={editLayerDefButtonTitle}
                      onClick={onItemEditButtonClicked}>
                      <UiCore.Icon iconSpec="icon-edit" />
                    </Button>
                    <Button
                      size="small"
                      styleType="borderless"
                      className="map-source-list-entry-button"
                      title={removeLayerDefButtonTitle}
                      onClick={(event: React.MouseEvent) => { onItemRemoveButtonClicked(source, event); }}>
                      <UiCore.Icon iconSpec="icon-delete" />
                    </Button>
                  </>}

              </UiCore.ListboxItem>
            )
          }
        </UiCore.Listbox>
      </div>
    </div>

  );
}

/** @internal */
export enum AttachLayerButtonType {
  Primary,
  Blue,
  Icon
}
export interface AttachLayerPopupButtonProps {
  isOverlay: boolean;
  buttonType?: AttachLayerButtonType;
  disabled?: boolean;
}

/** @internal */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function AttachLayerPopupButton(props: AttachLayerPopupButtonProps) {
  const { showAttachLayerLabel, hideAttachLayerLabel, addCustomLayerButtonLabel } = React.useMemo(() => {
    return {
      showAttachLayerLabel: MapLayersUI.localization.getLocalizedString("mapLayers:AttachLayerPopup.Attach"),
      hideAttachLayerLabel: MapLayersUI.localization.getLocalizedString("mapLayers:AttachLayerPopup.Close"),
      addCustomLayerButtonLabel: MapLayersUI.localization.getLocalizedString("mapLayers:CustomAttach.AddCustomLayerButtonLabel"),
    };
  }, []);

  const [handleOutsideClick, setHandleOutsideClick] = React.useState(true);
  const [popupOpen, setPopupOpen] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // 'isMounted' is used to prevent any async operation once the hook has been
  // unloaded.  Otherwise we get a 'Can't perform a React state update on an unmounted component.' warning in the console.
  const isMounted = React.useRef(false);
  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const togglePopup = React.useCallback(() => {
    setPopupOpen(!popupOpen);
  }, [popupOpen]);

  const handleClosePopup = React.useCallback(() => {
    setPopupOpen(false);
  }, []);

  const onHandleOutsideClick = React.useCallback((event: MouseEvent) => {
    if (!handleOutsideClick) {
      return;
    }

    // If clicking on button that open panel -  don't trigger outside click processing
    if (buttonRef?.current && buttonRef?.current.contains(event.target as Node)) {
      return;
    }

    // If clicking the panel, this is not an outside clicked
    if (panelRef.current && panelRef?.current.contains(event.target as Node)) {
      return;
    }

    // If we reach this point, we got an outside clicked, no close the popup
    setPopupOpen(false);

  }, [handleOutsideClick]);

  const { refreshFromStyle } = useSourceMapContext();

  const handleLayerAttached = React.useCallback(() => {
    if (!isMounted.current) {
      return;
    }
    setPopupOpen(false);
    refreshFromStyle();
  }, [refreshFromStyle]);

  function renderButton(): React.ReactNode {
    let button: React.ReactNode;

    if (props.buttonType === undefined || props.buttonType === AttachLayerButtonType.Icon) {
      button = (
        <Button disabled={props.disabled} size="small" styleType="borderless" ref={buttonRef} className="map-manager-attach-layer-button" title={popupOpen ? hideAttachLayerLabel : showAttachLayerLabel}
          onClick={togglePopup}>
          <UiCore.WebFontIcon iconName="icon-add" />
        </Button>
      );
    } else {
      const determineStyleType = () => {
        switch (props.buttonType) {
          case AttachLayerButtonType.Blue:
            return "high-visibility";
          case AttachLayerButtonType.Primary:
          default:
            return "cta";
        }
      };
      const styleType = determineStyleType();
      button = (
        <Button disabled={props.disabled} ref={buttonRef} styleType={styleType} title={popupOpen ? hideAttachLayerLabel : showAttachLayerLabel}
          onClick={togglePopup}>{addCustomLayerButtonLabel}</Button>
      );
    }

    return button;
  }

  return (
    <>
      {renderButton()}
      <UiCore.Popup
        isOpen={popupOpen}
        position={RelativePosition.BottomRight}
        onClose={handleClosePopup}
        onOutsideClick={onHandleOutsideClick}
        target={buttonRef.current}
        closeOnEnter={false}
        closeOnContextMenu={false}
      >
        <div ref={panelRef} className="map-sources-popup-panel" >
          <AttachLayerPanel
            isOverlay={props.isOverlay}
            onLayerAttached={handleLayerAttached}
            onHandleOutsideClick={setHandleOutsideClick}/>
        </div>
      </UiCore.Popup >
    </>
  );
}

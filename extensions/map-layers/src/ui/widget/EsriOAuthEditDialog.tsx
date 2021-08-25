/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { Dialog, InputStatus } from "@bentley/ui-core";
import { ModalDialogManager } from "@bentley/ui-framework";
import { MapLayersUiItemsProvider } from "../MapLayersUiItemsProvider";
import { Input, LabeledInput } from "@itwin/itwinui-react";
import { DialogButtonType} from "@bentley/ui-abstract";
export interface EsriOAuthEditDialogProps {
  clientId: string;
  baseUrl?: string;
  onOkResult?: (params: EsriOAuthEditParams) => void;
  onCancelResult?: () => void;
}

export interface EsriOAuthEditParams {
  clientId: string;
  baseUrl?: string;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function EsriOAuthEditDialog(props: EsriOAuthEditDialogProps) {
  const [clientId, setClientId] = React.useState(() => props.clientId);
  const [baseUrl, setBaseUrl] = React.useState(() => props.baseUrl);

  // i18n strings
  const [editOAuthParamsTitle] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:EsriSettings.EditOAuthParamsTitle"));
  const [endpointOriginLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:EsriSettings.EndpointOriginLabel"));
  const [clientIdLabel] = React.useState(MapLayersUiItemsProvider.i18n.translate("mapLayers:EsriSettings.clientIdLabel"));

  const isValidUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj !== undefined;
    } catch (_error) {
      return false;
    }
  };

  const readyToSave = React.useCallback(() => {
    return (baseUrl === undefined || (baseUrl && clientId));
  }, [baseUrl, clientId]);

  const handleCancel = React.useCallback(() => {
    if (props.onCancelResult) {
      props.onCancelResult();
      return;
    }
    ModalDialogManager.closeDialog();
  }, [props]);

  const handleOk = React.useCallback(() => {
    if (props.onOkResult) {
      props.onOkResult({clientId, baseUrl});
      return;
    }
    ModalDialogManager.closeDialog();
  }, [baseUrl, clientId, props]);

  const buttonCluster = React.useMemo(() => [
    { type: DialogButtonType.OK, onClick: handleOk, disabled: !readyToSave() },
    { type: DialogButtonType.Cancel, onClick: handleCancel },
  ], [readyToSave, handleCancel, handleOk]);

  const handleClientIdChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value ?? "";
    setClientId(value);
  }, []);

  const handleBaseUrlChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value ?? "";
    setBaseUrl(value);
  }, []);

  return (
    <Dialog
      title={editOAuthParamsTitle}
      opened={true}
      resizable={true}
      movable={true}
      modal={true}
      buttonCluster={buttonCluster}
      onClose={handleCancel}
      onEscape={handleCancel}
      minHeight={120}
      maxWidth={200}
      trapFocus={false}
    >
      {baseUrl !== undefined &&
      <>
        <span>{endpointOriginLabel}</span>
        <LabeledInput value={baseUrl} displayStyle="inline" status={isValidUrl(baseUrl) ?  undefined: "warning"} onChange={handleBaseUrlChange} />
      </>
      }

      <span>{clientIdLabel}</span>
      <Input value={clientId}  onChange={handleClientIdChange} />
    </Dialog>
  );
}

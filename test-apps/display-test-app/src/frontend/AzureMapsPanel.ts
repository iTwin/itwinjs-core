/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BackgroundMapProviderName, type BackgroundMapProviderProps, BackgroundMapType } from "@itwin/core-common";
import { type Viewport, type ViewState } from "@itwin/core-frontend";
import { AzureMaps } from "@itwin/map-layers-formats";
import { type CheckBox, createCheckBox, createComboBox } from "@itwin/frontend-devtools";

interface AzureMapsBackgroundMapSettingsProps {
  parent: HTMLElement;
  viewport: Viewport;
  imageryProvidersDiv: HTMLElement;
  imageryProviders: HTMLSelectElement;
  typesDiv: HTMLElement;
  types: HTMLSelectElement;
  sync: () => void;
}

export class AzureMapsBackgroundMapSettings {
  private readonly _vp: Viewport;
  private readonly _imageryProvidersDiv: HTMLElement;
  private readonly _imageryProviders: HTMLSelectElement;
  private readonly _typesDiv: HTMLElement;
  private readonly _types: HTMLSelectElement;
  private readonly _azureTypeDiv: HTMLElement;
  private readonly _azureTypes: HTMLSelectElement;
  private readonly _azureMapsToggle: CheckBox;
  private readonly _sync: () => void;

  public constructor(props: AzureMapsBackgroundMapSettingsProps) {
    this._vp = props.viewport;
    this._imageryProvidersDiv = props.imageryProvidersDiv;
    this._imageryProviders = props.imageryProviders;
    this._typesDiv = props.typesDiv;
    this._types = props.types;
    this._sync = props.sync;

    this._azureTypeDiv = document.createElement("div");
    props.parent.appendChild(this._azureTypeDiv);
    this._azureTypes = createComboBox({
      parent: this._azureTypeDiv,
      name: "Azure Maps: ",
      id: "viewAttr_azureMapType",
      entries: [
        { name: "Street", value: BackgroundMapType.Street },
        { name: "Aerial", value: BackgroundMapType.Aerial },
        { name: "Hybrid", value: BackgroundMapType.Hybrid },
      ],
      handler: (select) => this.applyAzureBackgroundMap(Number.parseInt(select.value, 10)),
    }).select;

    this._azureMapsToggle = createCheckBox({
      parent: props.parent,
      name: "Use Azure Maps",
      id: "viewAttr_useAzureMaps",
      handler: (checkbox) => this.toggleAzureMaps(checkbox.checked),
    });
  }

  public changeBackgroundMapProvider(props: BackgroundMapProviderProps): void {
    this.clearAzureBackgroundLayersIfActive();
    this._vp.displayStyle.changeBackgroundMapProvider(props);
    this._sync();
  }

  public update(view: ViewState): void {
    const azureType = AzureMaps.getBackgroundMapType(view.displayStyle);
    const useAzureMaps = undefined !== azureType;
    this._azureMapsToggle.checkbox.checked = useAzureMaps;
    this._azureMapsToggle.label.style.fontWeight = useAzureMaps ? "bold" : "500";
    this.toggleBasemapModeUi(useAzureMaps);
    if (undefined !== azureType)
      this._azureTypes.value = azureType.toString();
  }

  private clearAzureBackgroundLayersIfActive(): void {
    if (undefined !== AzureMaps.getBackgroundMapType(this._vp.displayStyle))
      AzureMaps.clearBackgroundLayers(this._vp.displayStyle);
  }

  private toggleAzureMaps(enabled: boolean): void {
    this.toggleBasemapModeUi(enabled);
    if (enabled) {
      this.applyAzureBackgroundMap(Number.parseInt(this._azureTypes.value, 10));
      return;
    }

    this.changeBackgroundMapProvider(this.getGenericBackgroundMapProviderProps());
  }

  private toggleBasemapModeUi(useAzureMaps: boolean): void {
    this._imageryProviders.disabled = useAzureMaps;
    this._types.disabled = useAzureMaps;
    this._imageryProvidersDiv.style.opacity = useAzureMaps ? "0.5" : "1.0";
    this._typesDiv.style.opacity = useAzureMaps ? "0.5" : "1.0";
    this._azureTypeDiv.style.display = useAzureMaps ? "block" : "none";
  }

  private applyAzureBackgroundMap(type: BackgroundMapType): void {
    AzureMaps.applyBackgroundMap(this._vp.displayStyle, type);
    this._sync();
  }

  private getGenericBackgroundMapProviderProps(): BackgroundMapProviderProps {
    return {
      name: this._imageryProviders.value as BackgroundMapProviderName,
      type: Number.parseInt(this._types.value, 10),
    };
  }
}

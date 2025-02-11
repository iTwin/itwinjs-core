/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, dispose } from "@itwin/core-bentley";
import {
  CheckBox,
  ComboBox, ComboBoxEntry, createButton, createCheckBox, createComboBox,
  createTextBox

  ,
} from "@itwin/frontend-devtools";
import { BackgroundMapType, BaseMapLayerSettings, ContourGroupProps, ImageMapLayerSettings } from "@itwin/core-common";
import { Viewport } from "@itwin/core-frontend";
import { ToolBarDropDown } from "./ToolBar";
import { CreateSessionOptions, GoogleMaps, LayerTypes, MapTypes, ScaleFactors } from "@itwin/map-layers-formats";

// size of widget or panel
const winSize = { top: 0, left: 0, width: 318, height: 300 };

export class GoogleMapsSettings implements Disposable {
  private readonly _vp: Viewport;
  private readonly _parent: HTMLElement;
  private readonly _element: HTMLElement;
  private _currentTerrainProps: ContourGroupProps = {};
  private _enabled: boolean = false;
  private _overlay: boolean = false;
  private _mapTypesCombobox: ComboBox;
  private _mapType: MapTypes;
  private _scaleFactor: ScaleFactors = "scaleFactor1x";
  private _layerTypes: LayerTypes[] = [];
  private _lang = "en-US";

  private _roadmapLayerCheckox: CheckBox|undefined;

  public constructor(vp: Viewport, parent: HTMLElement) {
    this._currentTerrainProps.contourDef = {};
    this._currentTerrainProps.subCategories = "";

    this._vp = vp;
    this._parent = parent;
    this._mapType = "satellite";
    this._enabled = false;

    this._element = document.createElement("div");
    this._element.className = "toolMenu";
    this._element.style.display = "block";
    this._element.style.overflowX = "none";
    this._element.style.overflowY = "none";
    const width = winSize.width * 0.98;
    this._element.style.width = `${width}px`;
    const firstLayer = this._vp.displayStyle.getMapLayers(false).length === 1 && this._vp.displayStyle.getMapLayers(false)[0]  ? this._vp.displayStyle.getMapLayers(false)[0] : undefined;
    const googleLayer = firstLayer instanceof ImageMapLayerSettings && firstLayer.formatId === "GoogleMaps" ? firstLayer : undefined;

    const isGoogleBase = vp.displayStyle.backgroundMapBase instanceof BaseMapLayerSettings && vp.displayStyle.backgroundMapBase.formatId === "GoogleMaps";
    this._enabled = isGoogleBase || googleLayer !== undefined;
    this._overlay = googleLayer !== undefined;
    if (googleLayer) {
      const opts = googleLayer.properties;
      if (opts) {
        this._mapType = opts.mapType as MapTypes;
        this._layerTypes = opts.layerTypes as LayerTypes[] ?? [];
        this._lang = opts.language as string ?? "en-US";
        this._scaleFactor = opts.scale as ScaleFactors ?? "scaleFactor1x";
      }
    }
    if (isGoogleBase) {
      const baseSettings = vp.displayStyle.backgroundMapBase as BaseMapLayerSettings;
      const properties = baseSettings.properties;
      this._mapType = (properties?.mapType??"") as MapTypes;

      this._layerTypes = (properties?.layerTypes ?? []) as LayerTypes[];
      this._lang = (properties?.language??"") as string;

      if (properties?.scale)
        this._scaleFactor = properties.scale as ScaleFactors;
    }


   createCheckBox({
      parent: this._element,
      name: "Enable google maps",
      id: "cbx_toggle_google_maps",
      isChecked: this._enabled,
      handler: (checkbox) => {
        assert(this._vp.view.is3d());
        this._enabled = checkbox.checked
        this.sync();
      },
    });
    this._element.appendChild(document.createElement("br"));

    ////////////////
    // Map types
    const mapTypes: ComboBoxEntry[] = [
      { name: "roadmap", value: "roadmap" },
      { name: "satellite", value: "satellite" },
      { name: "terrain", value: "terrain" },
    ];
    this._mapTypesCombobox = createComboBox({
      parent: this._element,
      name: "map type: ",
      entries: mapTypes,
      id: "google_map_type_cbx",
      value: this._mapType,
      handler: (cbx) => {
        this._mapType = cbx.value as MapTypes;
        if (this._mapType === "terrain" && !this._layerTypes.includes("layerRoadmap")) {
          this._layerTypes.push("layerRoadmap");
        }

        // Force roadmap layer to be enabled if terrain is selected
        if (this._roadmapLayerCheckox) {
          if (this._mapType === "terrain") {
            this._roadmapLayerCheckox.checkbox.checked = true;
            this._roadmapLayerCheckox.checkbox.disabled = true;
          } else {
            this._roadmapLayerCheckox.checkbox.disabled = false;
          }
    }

      },
    });
    this._element.appendChild(document.createElement("br"));


    ////////////////
    // Layer types
    const layerTypesDiv = document.createElement("div");
    const layerTypesLabel = document.createElement("label");
    layerTypesLabel.innerText = "Layer types:";
    layerTypesLabel.style.fontWeight = "bold";
    layerTypesLabel.style.display = "inline";
    layerTypesDiv.appendChild(layerTypesLabel);

    this._roadmapLayerCheckox = createCheckBox({
      parent: layerTypesDiv,
      name: "Roadmap",
      id: "google_layertype_roadmap",
      isChecked: this._layerTypes.includes("layerRoadmap"),
      handler: (cb) => {
        if (cb.checked) {
          this._layerTypes.push("layerRoadmap");
        } else {
          this._layerTypes = this._layerTypes.filter((layerType) => layerType !== "layerRoadmap");
        }
      },
    });
    this._roadmapLayerCheckox.checkbox.disabled = this._mapType === "terrain";

    createCheckBox({
      parent: layerTypesDiv,
      name: "Traffic",
      id: " google_layertype_traffic",
      isChecked: this._layerTypes.includes("layerTraffic"),
      handler: (cb) => {
        if (cb.checked) {
          this._layerTypes.push("layerTraffic");
        } else {
          this._layerTypes = this._layerTypes.filter((layerType) => layerType !== "layerTraffic");
        }
      },
    });

    createCheckBox({
      parent: layerTypesDiv,
      name: "Streetview",
      id: "google_layertype_streetview",
      isChecked: this._layerTypes.includes("layerStreetview"),
      handler: (cb) => {
        if (cb.checked) {
          this._layerTypes.push("layerStreetview");
        } else {
          this._layerTypes = this._layerTypes.filter((layerType) => layerType !== "layerStreetview");
        }
      },
    });
    this._element.appendChild(layerTypesDiv);
    this._element.appendChild(document.createElement("br"));

    /////////////////
    // Language
    const langDiv = document.createElement("div");
    const langLabel = document.createElement("label");
    langLabel.innerText = "Language:";
    langLabel.style.fontWeight = "bold";
    langLabel.style.display = "inline";
    langDiv.appendChild(langLabel);
    const langTbox = createTextBox({
      id: "txt_lang",
      parent: langDiv,
      tooltip: "lang",
      handler: (tb) => {this._lang = tb.value.trim()},
    });
    langTbox.textbox.style.display = "inline";
    langTbox.textbox.value = this._lang;
    this._element.appendChild(langDiv);
    this._element.appendChild(document.createElement("br"));



    ////////////////
    // Scale factors
    const scaleFactors: ComboBoxEntry[] = [
      { name: "1x", value: "scaleFactor1x" },
      { name: "2x", value: "scaleFactor2x" },
      { name: "4x", value: "scaleFactor4x" },
    ];
    createComboBox({
      parent: this._element,
      name: "scale factor: ",
      entries: scaleFactors,
      id: "google_scale_factors_cbx",
      value: this._scaleFactor,
      handler: (cbx) => {
        this._scaleFactor = cbx.value as ScaleFactors;
      },
    });
    this._element.appendChild(document.createElement("br"));

    createCheckBox({
      parent: this._element,
      name: "Overlay mode",
      id: "cbx_toggle_overlay",
      isChecked: this._overlay,
      handler: (checkbox) => {
        this._overlay = checkbox.checked;
        this.sync();
      },
    });
    this._element.appendChild(document.createElement("br"));


    ///////////
    // Buttons
    this._mapTypesCombobox.label!.style.fontWeight = "bold";
    const buttonDiv = document.createElement("div");
    buttonDiv.style.textAlign = "center";
    createButton({
      value: "Apply",
      handler: () => { this.apply(); },
      parent: buttonDiv,
      inline: true,
      tooltip: "Apply contour settings for this definition",
    });

    this._element.appendChild(buttonDiv);
    this._element.appendChild(document.createElement("br"));
    parent.appendChild(this._element);

  }

  public [Symbol.dispose](): void {
    this._parent.removeChild(this._element);
  }

  private sync(): void {

    this._vp.synchWithView();
  }

  private apply() {
    const removeExistingMapLayer = (isOverlay: boolean) => {
      const mapLayers = this._vp.displayStyle.getMapLayers(isOverlay);
      if (mapLayers.length > 0)
        this._vp.displayStyle.detachMapLayerByIndex({index: 0, isOverlay});
    }
    if (!this._enabled) {
      removeExistingMapLayer(false);
      this._vp.view.displayStyle.changeBackgroundMapProvider({ name: "BingProvider", type: BackgroundMapType.Hybrid });
      return;
    }


    if (this._overlay) {
      this._vp.displayStyle.backgroundMapBase = BaseMapLayerSettings.fromJSON({
        formatId: "ArcGIS",
        url: "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer",
        name: "ESRI World Imagery"
      });
      const opts: CreateSessionOptions = {
        mapType: "satellite",
        language: "en-US",
        region: "US",
        overlay: true,
        layerTypes: this._layerTypes,
      };
      removeExistingMapLayer(false);
      this._vp.displayStyle.attachMapLayer({mapLayerIndex: {index: 0, isOverlay: false}, settings: GoogleMaps.createMapLayerSettings("GoogleMaps", opts)});
    } else {
      removeExistingMapLayer(false);
      const opts: CreateSessionOptions = {
        mapType: this._mapType,
        layerTypes: this._layerTypes,
        language: this._lang,
        region: "US",
        scale: this._scaleFactor,
      };
      try {
        this._vp.displayStyle.backgroundMapBase = GoogleMaps.createBaseLayerSettings(opts);
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.log(e.message);
      }

    }

    this.sync();
  }

}

export class GoogleMapsPanel extends ToolBarDropDown {
  private readonly _vp: Viewport;
  private readonly _parent: HTMLElement;
  private _settings?: GoogleMapsSettings;

  public constructor(vp: Viewport, parent: HTMLElement) {
    super();
    this._vp = vp;
    this._parent = parent;
    this.open();
  }

  public override get onViewChanged(): Promise<void> {
    return Promise.resolve();
  }

  protected _open(): void { this._settings = new GoogleMapsSettings(this._vp, this._parent); }
  protected _close(): void { this._settings = dispose(this._settings); }
  public get isOpen(): boolean { return undefined !== this._settings; }
}

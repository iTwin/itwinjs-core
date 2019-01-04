/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  JsonUtils,
} from "@bentley/bentleyjs-core";
import {
  ViewState,
  ViewState3d,
  Viewport,
} from "@bentley/imodeljs-frontend";
import {
  BackgroundMapProps,
  BackgroundMapType,
  RenderMode,
} from "@bentley/imodeljs-common";
import { CheckBox, createCheckBox } from "./CheckBox";
import { createComboBox } from "./ComboBox";

type UpdateAttribute = (view: ViewState) => void;

type ViewFlag = "acsTriad" | "grid" | "fill" | "materials" | "textures" | "visibleEdges" | "hiddenEdges" | "monochrome" | "constructions" | "transparency" | "weights" | "styles" | "clipVolume";
type EnvironmentAspect = "ground" | "sky";

export class ViewAttributesPanel {
  private readonly _vp: Viewport;
  private readonly _element: HTMLElement;
  private readonly _updates: UpdateAttribute[] = [];
  private _updating = false;
  private readonly _removeMe: () => void;
  private readonly _parent: HTMLElement;
  private _id = 0;

  public constructor(vp: Viewport, parent: HTMLElement) {
    this._vp = vp;
    this._parent = parent;
    this._element = document.createElement("div");
    this._element.className = "debugPanel"; // "toolMenu"; or set display="block"...

    this._removeMe = vp.onViewChanged.addListener((_vp) => this.update());

    this.addRenderMode();

    this.addViewFlagAttribute("ACS Triad", "acsTriad");
    this.addViewFlagAttribute("Grid", "grid");
    this.addViewFlagAttribute("Fill", "fill");
    this.addViewFlagAttribute("Materials", "materials");
    this.addViewFlagAttribute("Textures", "textures");
    this.addViewFlagAttribute("Visible Edges", "visibleEdges", true);
    this.addViewFlagAttribute("Hidden Edges", "hiddenEdges", true);
    this.addViewFlagAttribute("Monochrome", "monochrome");
    this.addViewFlagAttribute("Constructions", "constructions");
    this.addViewFlagAttribute("Transparency", "transparency");
    this.addViewFlagAttribute("Line Weights", "weights");
    this.addViewFlagAttribute("Line Styles", "styles");
    this.addViewFlagAttribute("Clip Volume", "clipVolume", true);

    this.addEnvAttribute("Sky Box", "sky");
    this.addEnvAttribute("Ground Plane", "ground");

    this.addBackgroundMap();

    // Set initial states
    this.update();

    parent.appendChild(this._element);
  }

  public dispose(): undefined {
    this._removeMe();
    this._parent.removeChild(this._element);
    return undefined;
  }

  private addViewFlagAttribute(label: string, flag: ViewFlag, only3d: boolean = false): void {
    const elems = this.addCheckbox(label, (enabled: boolean) => {
      this._vp.view.viewFlags[flag] = enabled;
      this.sync();
    });

    const update = (view: ViewState) => {
      const visible = !only3d || view.is3d();
      elems.div.style.display = visible ? "block" : "none";
      if (visible)
        elems.checkbox.checked = view.viewFlags[flag];
    };

    this._updates.push(update);
  }

  private addEnvAttribute(label: string, aspect: EnvironmentAspect): void {
    const getEnv = (view: ViewState, path: EnvironmentAspect) => {
      const view3d = view as ViewState3d;
      const style = view3d.getDisplayStyle3d();
      return style.environment[path];
    };

    const elems = this.addCheckbox(label, (enabled: boolean) => {
      const env = getEnv(this._vp.view, aspect);
      env.display = enabled;
      this.sync();
    });

    const update = (view: ViewState) => {
      const visible = view.is3d();
      elems.div.style.display = visible ? "block" : "none";
      if (visible)
        elems.checkbox.checked = getEnv(view, aspect).display;
    };

    this._updates.push(update);
  }

  private addRenderMode(): void {
    const div = document.createElement("div") as HTMLDivElement;

    const entries = [
      { name: "Wireframe", value: RenderMode.Wireframe },
      { name: "Solid Fill", value: RenderMode.SolidFill },
      { name: "Hidden Line", value: RenderMode.HiddenLine },
      { name: "Smooth Shade", value: RenderMode.SmoothShade },
    ];

    const select = createComboBox({
      parent: div,
      name: "Render Mode: ",
      entries,
      id: "viewAttr_renderMode",
      value: this._vp.viewFlags.renderMode,
      handler: (thing) => {
        this._vp.viewFlags.renderMode = Number.parseInt(thing.value, 10);
        this.sync();
      },
    }).select;

    this._updates.push((view) => {
      const visible = view.is3d();
      div.style.display = visible ? "block" : "none";
      if (visible)
        select.value = view.viewFlags.renderMode.toString();
    });

    this._element.appendChild(div);
  }

  private addBackgroundMap(): void {
    const isMapSupported = (view: ViewState) => view.is3d() && view.iModel.isGeoLocated;
    const getBackgroundMap = (view: ViewState) => (view as ViewState3d).getDisplayStyle3d().backgroundMap;

    const div = document.createElement("div");
    div.appendChild(document.createElement("hr")!);

    const comboBoxesDiv = document.createElement("div")!;

    const showHideDropDowns = (show: boolean) => {
      const display = show ? "block" : "none";
      comboBoxesDiv.style.display = display;
    };

    const enableMap = (enabled: boolean) => {
      this._vp.view.viewFlags.backgroundMap = enabled;
      showHideDropDowns(enabled);
      this.sync();
    };
    const checkbox = this.addCheckbox("Background Map", enableMap, div).checkbox;

    const providers = createComboBox({
      parent: comboBoxesDiv,
      name: "Provider: ",
      id: "viewAttr_MapProvider",
      entries: [
        { name: "Bing", value: "BingProvider" },
        { name: "MapBox", value: "MapBoxProvider" },
      ],
      handler: (select) => this.updateBackgroundMap(getBackgroundMap(this._vp.view), select.value, undefined),
    }).select;

    const types = createComboBox({
      parent: comboBoxesDiv,
      name: "Type: ",
      id: "viewAttr_mapType",
      entries: [
        { name: "Street", value: BackgroundMapType.Street },
        { name: "Aerial", value: BackgroundMapType.Aerial },
        { name: "Hybrid", value: BackgroundMapType.Hybrid },
      ],
      handler: (select) => this.updateBackgroundMap(getBackgroundMap(this._vp.view), undefined, Number.parseInt(select.value, 10)),
    }).select;

    this._updates.push((view) => {
      const visible = isMapSupported(view);
      div.style.display = visible ? "block" : "none";
      if (!visible)
        return;

      checkbox.checked = view.viewFlags.backgroundMap;
      showHideDropDowns(checkbox.checked);

      const map = getBackgroundMap(view);
      providers.value = JsonUtils.asString(map.providerName, "BingProvider");
      types.value = JsonUtils.asInt(map.mapType, BackgroundMapType.Hybrid).toString();
    });

    div.appendChild(comboBoxesDiv);

    this._element.appendChild(div);
  }

  private updateBackgroundMap(map: BackgroundMapProps, newProvider?: string, newType?: BackgroundMapType): void {
    let type: BackgroundMapType | undefined;
    if (undefined !== newType)
      type = newType;
    else if (undefined !== map.providerData)
      type = map.providerData.mapType;

    if (undefined === type)
      type = BackgroundMapType.Hybrid;

    const props = {
      providerName: undefined !== newProvider ? newProvider : map.providerName,
      providerData: {
        mapType: type,
      },
    };

    (this._vp.view as ViewState3d).getDisplayStyle3d().setBackgroundMap(props);
    this.sync();
  }

  private addCheckbox(cbLabel: string, handler: (enabled: boolean) => void, parent?: HTMLElement): CheckBox {
    if (undefined === parent)
      parent = this._element;

    return createCheckBox({
      parent,
      name: cbLabel,
      id: this._nextId,
      handler: (cb) => handler(cb.checked),
    });
  }

  private update(): void {
    if (!this._updating) {
      this._updating = true;
      for (const update of this._updates)
        update(this._vp.view);

      this._updating = false;
    }
  }

  private sync(): void {
    this._vp.invalidateRenderPlan();
  }

  private get _nextId(): string {
    ++this._id;
    return "viewAttributesPanel_" + this._id;
  }
}

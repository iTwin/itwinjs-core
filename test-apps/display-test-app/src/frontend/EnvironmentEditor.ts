/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  CheckBox, ColorInput, createButton, createCheckBox, createColorInput, createNestedMenu, createRadioBox, createSlider, RadioBox, Slider,
} from "@bentley/frontend-devtools";
import { ColorDef, RenderMode, SkyBoxProps } from "@bentley/imodeljs-common";
import { Environment, SkyBox, SkyGradient, Viewport, ViewState, ViewState3d } from "@bentley/imodeljs-frontend";
import { LightingEditor } from "./LightingEditor";

type EnvironmentAspect = "ground" | "sky";
type UpdateAttribute = (view: ViewState) => void;

let expandEnvironmentEditor = false;

export class EnvironmentEditor {
  private readonly _vp: Viewport;
  private readonly _updates: UpdateAttribute[] = [];
  private readonly _eeSkyboxType: RadioBox;
  private readonly _eeZenithColor: ColorInput;
  private readonly _eeSkyColor: ColorInput;
  private readonly _eeGroundColor: ColorInput;
  private readonly _eeNadirColor: ColorInput;
  private readonly _eeSkyExponent: Slider;
  private readonly _eeGroundExponent: Slider;
  private readonly _eeBackgroundColor: ColorInput;
  private _id = 0;
  private _removeEnvironmentListener?: VoidFunction;
  private _removeDisplayStyleListener?: VoidFunction;
  private _updatingEnvironment = false;

  public constructor(vp: Viewport, parent: HTMLElement) {
    this._vp = vp;

    const envMenu = createNestedMenu({
      id: "ee_menu",
      label: "Environment",
      parent,
      // We use a static so the expand/collapse state persists after closing and reopening the drop-down.
      expand: expandEnvironmentEditor,
      handler: (expanded) => { expandEnvironmentEditor = expanded; envMenu.label.style.fontWeight = expanded ? "bold" : "500"; },
    });
    (envMenu.div.firstElementChild!.lastElementChild! as HTMLElement).style.borderColor = "grey";
    const nestedMenu = envMenu.body;
    const is3d = this._vp.view.is3d();

    const lightingDiv = document.createElement("div");
    const lightingEditor = new LightingEditor(vp, lightingDiv);
    this._updates.push((view: ViewState) => {
      lightingEditor.update(view);
      lightingDiv.style.display = view.is3d() && RenderMode.SmoothShade === view.viewFlags.renderMode ? "" : "none";
    });

    lightingDiv.appendChild(document.createElement("hr"));
    nestedMenu.appendChild(lightingDiv);

    this._eeBackgroundColor = createColorInput({
      parent: nestedMenu,
      value: this._vp.view.backgroundColor.toHexString(),
      handler: (value) => {
        this._vp.view.displayStyle.backgroundColor = ColorDef.create(value);
        this.sync();
      },
      id: "ee_bgColor",
      label: "Background Color",
      display: is3d ? "none" : "block",
    });
    this._eeBackgroundColor.div.style.textAlign = "right";

    this.listen();

    let currentEnvironment: SkyGradient | undefined;
    const eeDiv = document.createElement("div");
    if (this._vp.view.is3d()) {
      const env = this._vp.view.getDisplayStyle3d().environment.sky;

      // Could be a SkySphere, SkyCube, etc...we currently only support editing a SkyGradient.
      if (env instanceof SkyGradient)
        currentEnvironment = env;
    }

    eeDiv.hidden = undefined !== currentEnvironment && !currentEnvironment.display;

    const showSkyboxControls = (enabled: boolean) => {
      eeDiv.hidden = !enabled;
      this._eeBackgroundColor.div.style.display = enabled ? "none" : "block";
    };

    this.addEnvAttribute(nestedMenu, "Sky Box", "sky", showSkyboxControls);

    nestedMenu.appendChild(this._eeBackgroundColor.div);

    this._eeSkyboxType = createRadioBox({
      id: "ee_skyboxType",
      entries: [
        { value: "2colors", label: "2 Colors" },
        { value: "4colors", label: "4 Colors" },
      ],
      handler: (value) => {
        this.updateEnvironment({ twoColor: value === "2colors" });

        // Hide elements not relevant to 2 colors
        const twoColors = value !== "4colors";
        this._eeSkyColor.div.hidden = twoColors;
        this._eeGroundColor.div.hidden = twoColors;
        this._eeSkyExponent.div.style.display = twoColors ? "none" : "block";
        this._eeGroundExponent.div.style.display = twoColors ? "none" : "block";
      },
      parent: eeDiv,
      defaultValue: (undefined !== currentEnvironment && currentEnvironment.twoColor) ? "2colors" : "4colors",
    });

    const row1 = document.createElement("div");
    eeDiv.appendChild(row1);
    row1.style.display = "flex";
    row1.style.justifyContent = "flex-end";

    this._eeSkyColor = createColorInput({
      handler: (value: string) => this.updateEnvironment({ skyColor: ColorDef.create(value).toJSON() }),
      value: undefined === currentEnvironment ? "#FFFFFF" : currentEnvironment.skyColor.toHexString(),
      label: "Sky Color",
      parent: row1,
    });
    this._eeSkyColor.div.style.marginRight = "10px";

    this._eeZenithColor = createColorInput({
      handler: (value: string) => this.updateEnvironment({ zenithColor: ColorDef.create(value).toJSON() }),
      value: undefined === currentEnvironment ? "#FFFFFF" : currentEnvironment.zenithColor.toHexString(),
      label: "Zenith Color",
      parent: row1,
    });

    const row2 = document.createElement("div");
    eeDiv.appendChild(row2);
    row2.style.display = "flex";
    row2.style.justifyContent = "flex-end";

    this._eeGroundColor = createColorInput({
      handler: (value: string) => this.updateEnvironment({ groundColor: ColorDef.create(value).toJSON() }),
      value: undefined === currentEnvironment ? "#FFFFFF" : currentEnvironment.groundColor.toHexString(),
      label: "Ground Color",
      parent: row2,
    });
    this._eeGroundColor.div.style.marginRight = "16px";

    this._eeNadirColor = createColorInput({
      handler: (value: string) => this.updateEnvironment({ nadirColor: ColorDef.create(value).toJSON() }),
      value: undefined === currentEnvironment ? "#FFFFFF" : currentEnvironment.nadirColor.toHexString(),
      label: "Nadir Color",
      parent: row2,
    });

    this._eeSkyExponent = createSlider({
      parent: eeDiv,
      name: "Sky Exponent",
      id: "ee_skyExponent",
      min: "0.0",
      step: "0.25",
      max: "20.0",
      value: undefined === currentEnvironment ? "#FFFFFF" : currentEnvironment.skyExponent.toString(),
      handler: (slider) => this.updateEnvironment({ skyExponent: parseFloat(slider.value) }),
    });

    this._eeGroundExponent = createSlider({
      parent: eeDiv,
      name: "Ground Exponent",
      id: "ee_groundExponent",
      min: "0.0",
      step: "0.25",
      max: "20.0",
      value: undefined === currentEnvironment ? "#FFFFFF" : currentEnvironment.groundExponent.toString(),
      handler: (slider) => this.updateEnvironment({ groundExponent: parseFloat(slider.value) }),
    });

    const buttonDiv = document.createElement("div");

    createButton({
      parent: buttonDiv,
      id: "viewAttr_EEReset",
      value: "Reset",
      inline: true,
      handler: () => this.resetEnvironmentEditor(),
    });

    createButton({
      parent: buttonDiv,
      id: "viewAttr_eeExport",
      value: "Export",
      inline: true,
      handler: () => {
        const env = (this._vp.view as ViewState3d).getDisplayStyle3d().environment.sky as SkyGradient;
        let msg = `Zenith Color: ${env.zenithColor.toRgbString()}\nNadir Color: ${env.nadirColor.toRgbString()}`;
        if (!env.twoColor)
          msg = msg.concat(`\nSky Color: ${env.skyColor.toRgbString()}\nGround Color: ${env.groundColor.toRgbString()}\nSky Exponent: ${env.skyExponent}\nGround Exponent: ${env.groundExponent}`);
        alert(msg);
      },
    });
    buttonDiv.style.textAlign = "center";
    eeDiv.appendChild(buttonDiv);

    showSkyboxControls(undefined !== currentEnvironment && currentEnvironment.display);
    nestedMenu.appendChild(eeDiv);

    this._updates.push((view) => {
      let skyboxEnabled = false;
      if (view.is3d()) {
        const env = view.getDisplayStyle3d().environment.sky;
        skyboxEnabled = env.display;
      }

      showSkyboxControls(skyboxEnabled);
      envMenu.label.style.fontWeight = expandEnvironmentEditor ? "bold" : "500";
    });

    this.addEnvAttribute(nestedMenu, "Ground Plane", "ground");

    const hr = document.createElement("hr");
    hr.style.borderColor = "grey";
    nestedMenu.appendChild(hr);
  }

  public update(view: ViewState): void {
    for (const update of this._updates)
      update(view);
  }

  private listen(): void {
    this.listenForEnvironment();
    if (this._removeDisplayStyleListener) {
      this._removeDisplayStyleListener();
      this._removeDisplayStyleListener = undefined;
    }

    if (this._vp.view.is3d())
      this._removeDisplayStyleListener = this._vp.view.onDisplayStyleChanged.addListener(() => this.listen());
  }

  private listenForEnvironment(): void {
    if (this._removeEnvironmentListener) {
      this._removeEnvironmentListener();
      this._removeEnvironmentListener = undefined;
    }

    if (this._vp.view.is3d()) {
      this._removeEnvironmentListener = this._vp.view.displayStyle.settings.onEnvironmentChanged.addListener(() => {
        this.updateEnvironmentEditorUI(this._vp.view);
      });
    }
  }

  private updateEnvironment(newEnv: SkyBoxProps): void {
    if (this._updatingEnvironment || !this._vp.view.is3d())
      return;

    // We don't want our event listeners to respond to events we ourselves produced.
    this._updatingEnvironment = true;

    const oldEnv = this._vp.view.displayStyle.environment;
    const oldSkyEnv = oldEnv.sky as SkyGradient;
    newEnv = {
      display: (oldSkyEnv as SkyBox).display,
      twoColor: undefined !== newEnv.twoColor ? newEnv.twoColor : oldSkyEnv.twoColor,
      zenithColor: undefined !== newEnv.zenithColor ? ColorDef.create(newEnv.zenithColor).toJSON() : oldSkyEnv.zenithColor.toJSON(),
      skyColor: undefined !== newEnv.skyColor ? ColorDef.create(newEnv.skyColor).toJSON() : oldSkyEnv.skyColor.toJSON(),
      groundColor: undefined !== newEnv.groundColor ? ColorDef.create(newEnv.groundColor).toJSON() : oldSkyEnv.groundColor.toJSON(),
      nadirColor: undefined !== newEnv.nadirColor ? ColorDef.create(newEnv.nadirColor).toJSON() : oldSkyEnv.nadirColor.toJSON(),
      skyExponent: undefined !== newEnv.skyExponent ? newEnv.skyExponent : oldSkyEnv.skyExponent,
      groundExponent: undefined !== newEnv.groundExponent ? newEnv.groundExponent : oldSkyEnv.groundExponent,
    };

    this._vp.view.displayStyle.environment = new Environment({
      sky: new SkyGradient(newEnv).toJSON(),
      ground: oldEnv.ground.toJSON(),
    });

    this.sync();

    this._updatingEnvironment = false;
  }

  private updateEnvironmentEditorUI(view: ViewState): void {
    if (this._updatingEnvironment)
      return;

    // Setting the values of UI controls below will trigger callbacks that call updateEnvironment().
    // We don't want to do that when we're modifying the controls ourselves.
    this._updatingEnvironment = true;

    this._eeBackgroundColor.input.value = view.backgroundColor.toHexString();
    if (view.is2d())
      return;

    const getSkyEnvironment = (v: ViewState) => (v as ViewState3d).getDisplayStyle3d().environment.sky;
    const skyEnvironment = getSkyEnvironment(view) as SkyGradient;

    this._eeSkyboxType.setValue(skyEnvironment.twoColor ? "2colors" : "4colors");
    this._eeZenithColor.input.value = skyEnvironment.zenithColor.toHexString();
    this._eeSkyColor.input.value = skyEnvironment.skyColor.toHexString();
    this._eeGroundColor.input.value = skyEnvironment.groundColor.toHexString();
    this._eeNadirColor.input.value = skyEnvironment.nadirColor.toHexString();
    this._eeSkyExponent.slider.value = skyEnvironment.skyExponent.toString();
    this._eeGroundExponent.slider.value = skyEnvironment.groundExponent.toString();

    this._updatingEnvironment = false;
  }

  private resetEnvironmentEditor(): void {
    const skyEnvironment = (this._vp.view as ViewState3d).getDisplayStyle3d().environment.sky;
    (this._vp.view as ViewState3d).getDisplayStyle3d().environment = new Environment({
      sky: { display: (skyEnvironment).display },
    });
    this.sync();
    this.updateEnvironmentEditorUI(this._vp.view);
  }

  private addEnvAttribute(parent: HTMLElement, label: string, aspect: EnvironmentAspect, updateHandler?: (enabled: boolean) => void): void {
    const elems = this.addCheckbox(label, (enabled: boolean) => {
      const view3d = this._vp.view as ViewState3d;
      const style = view3d.getDisplayStyle3d();
      const env = style.environment;
      env[aspect].display = enabled;
      view3d.getDisplayStyle3d().environment = env; // setter converts it to JSON
      if (undefined !== updateHandler)
        updateHandler(enabled);
      this.sync();
    }, parent, this._nextId);

    const update = (view: ViewState) => {
      const visible = view.is3d();
      elems.div.style.display = visible ? "block" : "none";
      if (visible) {
        const view3d = view as ViewState3d;
        const style = view3d.getDisplayStyle3d();
        elems.checkbox.checked = style.environment[aspect].display;
      }
    };

    this._updates.push(update);
  }

  private sync(): void {
    this._vp.synchWithView();
  }

  private addCheckbox(cbLabel: string, handler: (enabled: boolean) => void, parent: HTMLElement, id: string): CheckBox {
    return createCheckBox({
      parent,
      name: cbLabel,
      id,
      handler: (cb) => handler(cb.checked),
    });
  }

  private get _nextId(): string {
    return `ee_checkbox_${++this._id}`;
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  ColorDef,
  SkyBoxProps,
} from "@bentley/imodeljs-common";
import {
  Environment,
  SkyBox,
  SkyGradient,
  Viewport,
  ViewState,
  ViewState3d,
} from "@bentley/imodeljs-frontend";
import {
  CheckBox,
  createCheckBox,
  Slider,
  createSlider,
  RadioBox,
  createRadioBox,
  ColorInput,
  createColorInput,
  createNestedMenu,
  createButton,
 } from "@bentley/frontend-devtools";

type EnvironmentAspect = "ground" | "sky";
type SkyboxType = "2colors" | "4colors";
type UpdateAttribute = (view: ViewState) => void;

let expandEnvironmentEditor = false;

export class EnvironmentEditor {
  private readonly _vp: Viewport;
  private readonly _updates: UpdateAttribute[] = [];
  private readonly _eeSkyboxType: RadioBox<SkyboxType>;
  private readonly _eeZenithColor: ColorInput;
  private readonly _eeSkyColor: ColorInput;
  private readonly _eeGroundColor: ColorInput;
  private readonly _eeNadirColor: ColorInput;
  private readonly _eeSkyExponent: Slider;
  private readonly _eeGroundExponent: Slider;
  private readonly _eeBackgroundColor: ColorInput;

  public constructor(vp: Viewport, parent: HTMLElement) {
    this._vp = vp;

    const nestedMenu = createNestedMenu({
      id: "ee_menu",
      label: "Environment",
      parent,
      // We use a static so the expand/collapse state persists after closing and reopening the drop-down.
      expand: expandEnvironmentEditor,
      handler: (expanded) => expandEnvironmentEditor = expanded,
    }).body;
    const is3d = this._vp.view.is3d();

    this._eeBackgroundColor = createColorInput({
      parent: nestedMenu,
      value: this._vp.view.backgroundColor.toHexString(),
      handler: (value) => {
        this._vp.view.displayStyle.backgroundColor = new ColorDef(value);
        this.sync();
      },
      id: "ee_bgColor",
      label: "Background Color",
      display: is3d ? "none" : "block",
    });
    this._eeBackgroundColor.div.style.textAlign = "right";

    this._vp.onDisplayStyleChanged.addListener((viewport) => {
      this.updateEnvironmentEditorUI(viewport.view);
    });

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
      this._eeBackgroundColor!.div.style.display = enabled ? "none" : "block";
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
        this._eeSkyColor!.div.hidden = twoColors;
        this._eeGroundColor!.div.hidden = twoColors;
        this._eeSkyExponent!.div.style.display = twoColors ? "none" : "block";
        this._eeGroundExponent!.div.style.display = twoColors ? "none" : "block";
      },
      parent: eeDiv,
      defaultValue: (undefined !== currentEnvironment && currentEnvironment.twoColor) ? "2colors" : "4colors",
    });

    const row1 = document.createElement("div");
    eeDiv.appendChild(row1);
    row1.style.display = "flex";
    row1.style.justifyContent = "flex-end";

    this._eeSkyColor = createColorInput({
      handler: (value: string) => this.updateEnvironment({ skyColor: new ColorDef(value) }),
      value: undefined === currentEnvironment ? "#FFFFFF" : currentEnvironment.skyColor.toHexString(),
      label: "Sky Color",
      parent: row1,
    });
    this._eeSkyColor.div.style.marginRight = "10px";

    this._eeZenithColor = createColorInput({
      handler: (value: string) => this.updateEnvironment({ zenithColor: new ColorDef(value) }),
      value: undefined === currentEnvironment ? "#FFFFFF" : currentEnvironment.zenithColor.toHexString(),
      label: "Zenith Color",
      parent: row1,
    });

    const row2 = document.createElement("div");
    eeDiv.appendChild(row2);
    row2.style.display = "flex";
    row2.style.justifyContent = "flex-end";

    this._eeGroundColor = createColorInput({
      handler: (value: string) => this.updateEnvironment({ groundColor: new ColorDef(value) }),
      value: undefined === currentEnvironment ? "#FFFFFF" : currentEnvironment.groundColor.toHexString(),
      label: "Ground Color",
      parent: row2,
    });
    this._eeGroundColor.div.style.marginRight = "16px";

    this._eeNadirColor = createColorInput({
      handler: (value: string) => this.updateEnvironment({ nadirColor: new ColorDef(value) }),
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

    const buttonDiv = document.createElement("div") as HTMLDivElement;

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
        const env = (view as ViewState3d).getDisplayStyle3d().environment.sky;
        skyboxEnabled = env.display;
      }

      showSkyboxControls(skyboxEnabled);
      this.updateEnvironmentEditorUI(view);
    });

    this.addEnvAttribute(nestedMenu, "Ground Plane", "ground");
  }

  public update(view: ViewState): void {
    for (const update of this._updates)
      update(view);
  }

  private updateEnvironment(newEnv: SkyBoxProps): void {
    const oldEnv = (this._vp.view as ViewState3d).getDisplayStyle3d().environment;
    const oldSkyEnv = oldEnv.sky as SkyGradient;
    newEnv = {
      display: (oldSkyEnv as SkyBox).display,
      twoColor: undefined !== newEnv.twoColor ? newEnv.twoColor : oldSkyEnv.twoColor,
      zenithColor: undefined !== newEnv.zenithColor ? new ColorDef(newEnv.zenithColor) : oldSkyEnv.zenithColor,
      skyColor: undefined !== newEnv.skyColor ? new ColorDef(newEnv.skyColor) : oldSkyEnv.skyColor,
      groundColor: undefined !== newEnv.groundColor ? new ColorDef(newEnv.groundColor) : oldSkyEnv.groundColor,
      nadirColor: undefined !== newEnv.nadirColor ? new ColorDef(newEnv.nadirColor) : oldSkyEnv.nadirColor,
      skyExponent: undefined !== newEnv.skyExponent ? newEnv.skyExponent : oldSkyEnv.skyExponent,
      groundExponent: undefined !== newEnv.groundExponent ? newEnv.groundExponent : oldSkyEnv.groundExponent,
    };
    (this._vp.view as ViewState3d).getDisplayStyle3d().environment = new Environment(
      {
        sky: new SkyGradient(newEnv),
        ground: oldEnv.ground,
      });
    this.sync();
  }

  private updateEnvironmentEditorUI(view: ViewState): void {
    this._eeBackgroundColor!.input.value = view.backgroundColor.toHexString();
    if (view.is2d())
      return;

    const getSkyEnvironment = (v: ViewState) => (v as ViewState3d).getDisplayStyle3d().environment.sky;
    const skyEnvironment = getSkyEnvironment(view) as SkyGradient;

    this._eeSkyboxType!.setValue(skyEnvironment.twoColor ? "2colors" : "4colors");
    this._eeZenithColor!.input.value = skyEnvironment.zenithColor.toHexString();
    this._eeSkyColor!.input.value = skyEnvironment.skyColor.toHexString();
    this._eeGroundColor!.input.value = skyEnvironment.groundColor.toHexString();
    this._eeNadirColor!.input.value = skyEnvironment.nadirColor.toHexString();
    this._eeSkyExponent!.slider.value = skyEnvironment.skyExponent!.toString();
    this._eeGroundExponent!.slider.value = skyEnvironment.groundExponent!.toString();
  }

  private resetEnvironmentEditor(): void {
    const skyEnvironment = (this._vp.view as ViewState3d).getDisplayStyle3d().environment.sky;
    (this._vp.view as ViewState3d).getDisplayStyle3d().environment = new Environment(
      {
        sky: { display: (skyEnvironment as SkyBox).display },
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
    }, parent, "ee_checkbox");

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
    this._vp.synchWithView(true);
  }

  private addCheckbox(cbLabel: string, handler: (enabled: boolean) => void, parent: HTMLElement, id: string): CheckBox {
    return createCheckBox({
      parent,
      name: cbLabel,
      id,
      handler: (cb) => handler(cb.checked),
    });
  }
}

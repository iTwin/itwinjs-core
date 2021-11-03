/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CheckBox, createButton, createCheckBox, createColorInput, createLabeledNumericInput } from "@itwin/frontend-devtools";
import { ColorDef, LightSettings, LightSettingsProps, RenderMode, RgbColor, SolarShadowSettings } from "@itwin/core-common";
import { Viewport, ViewState } from "@itwin/core-frontend";

// cspell:ignore cels sundir textbox hemi lighteditor

type Update = (view: ViewState) => void;

export class LightingEditor {
  private readonly _vp: Viewport;
  private readonly _updates: Update[] = [];
  private _id = 0;

  public constructor(vp: Viewport, parent: HTMLElement) {
    this._vp = vp;

    this.addLightingToggle(parent);

    const content = document.createElement("div");
    parent.appendChild(content);

    this.addShadows(content);
    this.addSolar(content);
    this.addIntensities(content);
    this.addAmbient(content);
    this.addFresnel(content);
    this.addHemisphere(content);

    const celInput = createLabeledNumericInput({
      parent: content,
      min: 0,
      max: 255,
      step: 1,
      display: "block",
      name: "Num Cels",
      id: this._nextId,
      value: vp.view.displayStyle.is3d() ? vp.view.displayStyle.lights.numCels : 0,
      handler: (value) => this.updateSettings({ numCels: value }),
    });

    const resetButton = createButton({
      parent: content,
      value: "Reset",
      handler: () => {
        this._vp.setLightSettings(LightSettings.fromJSON());
        this.update(this._vp.view);
      },
    });
    resetButton.div.style.textAlign = "center";

    this._updates.push((view: ViewState) => {
      const visible = view.is3d() && view.viewFlags.lighting;
      content.style.display = visible ? "" : "none";
      if (view.displayStyle.is3d())
        celInput.input.value = view.displayStyle.lights.numCels.toString();
    });
  }

  public update(view: ViewState): void {
    for (const update of this._updates)
      update(view);
  }

  private addShadows(parent: HTMLElement): void {
    const span = document.createElement("span");
    span.style.display = "flex";
    parent.appendChild(span);

    const cb = this.addCheckBox("Shadows", (enabled: boolean) => {
      this._vp.viewFlags = this._vp.viewFlags.with("shadows", enabled);
    }, span).checkbox;

    let color;
    if (this._vp.view.is3d())
      color = this._vp.view.getDisplayStyle3d().settings.solarShadows.color.toColorDef();

    const input = createColorInput({
      id: this._nextId,
      parent: span,
      display: "inline",
      value: color?.toHexString() ?? "#FFFFFF",
      handler: (newColor) => {
        const props = { color: ColorDef.create(newColor).toJSON() };
        const settings = this._vp.solarShadowSettings ? this._vp.solarShadowSettings.clone(props) : SolarShadowSettings.fromJSON(props);
        this._vp.setSolarShadowSettings(settings);
      },
    }).input;

    this._updates.push((view: ViewState) => {
      cb.checked = view.viewFlags.shadows;
      const shadowColor = view.displayStyle.is3d() ? view.displayStyle.solarShadows.color.toColorDef().toHexString() : "#FFFFFF";
      input.value = shadowColor;
    });
  }

  private addSolar(parent: HTMLElement): void {
    const span = document.createElement("span");
    span.style.display = "flex";
    parent.appendChild(span);
    const intensityInput = this.addIntensityInput(span, "Solar", this._vp.lightSettings?.solar.intensity ?? 0, (intensity) => this.updateSettings({ solar: { intensity } }));
    intensityInput.style.marginRight = "0.67em";

    createButton({
      parent: span,
      value: "Set direction from view",
      handler: () => {
        const direction = this._vp.view.getZVector();
        direction.negate(direction);
        this.updateSettings({ solar: { direction } });
      },
    });

    const cb = this.addCheckBox("Always", (alwaysEnabled: boolean) => {
      this.updateSettings({ solar: { alwaysEnabled } });
    }, span);

    this._updates.push((_view: ViewState) => {
      const lights = this._vp.lightSettings;
      if (!lights)
        return;

      intensityInput.value = lights.solar.intensity.toString();
      cb.checkbox.checked = lights.solar.alwaysEnabled;
    });
  }

  private addIntensities(parent: HTMLElement): void {
    const span = document.createElement("span");
    span.style.display = "flex";
    parent.appendChild(span);

    const lights = this._vp.lightSettings;
    const portrait = this.addIntensityInput(span, "Portrait", lights?.portraitIntensity ?? 0, (intensity) => this.updateSettings({ portrait: { intensity } }));
    const specular = this.addIntensityInput(span, "Specular", lights?.specularIntensity ?? 0, (specularIntensity) => this.updateSettings({ specularIntensity }));
    portrait.style.marginRight = "0.67em";

    this._updates.push((_view: ViewState) => {
      const settings = this._vp.lightSettings;
      if (settings) {
        portrait.value = settings.portraitIntensity.toString();
        specular.value = settings.specularIntensity.toString();
      }
    });
  }

  private addFresnel(parent: HTMLElement): void {
    const span = document.createElement("span");
    span.style.display = "flex";
    parent.appendChild(span);

    const intensityInput = this.addIntensityInput(span, "Fresnel", this._vp.lightSettings?.fresnel.intensity ?? 0, (intensity) => this.updateSettings({ fresnel: { intensity } }));
    intensityInput.style.marginRight = "0.67em";

    const cb = this.addCheckBox("Invert", (invert: boolean) => this.updateSettings({ fresnel: { invert } }), span);
    this._updates.push(() => {
      const lights = this._vp.lightSettings;
      if (lights) {
        intensityInput.value = lights.fresnel.intensity.toString();
        cb.checkbox.checked = lights.fresnel.invert;
      }
    });
  }

  private addAmbient(parent: HTMLElement): void {
    const span = document.createElement("span");
    span.style.display = "flex";
    parent.appendChild(span);

    const amb = this._vp.lightSettings?.ambient;
    const intensityInput = this.addIntensityInput(span, "Ambient", amb?.intensity ?? 0, (intensity) => this.updateSettings({ ambient: { intensity } }));
    const colorInput = createColorInput({
      parent: span,
      display: "inline",
      value: amb?.color.toColorDef().toHexString() ?? "#000000",
      handler: (color) => {
        this.updateSettings({ ambient: { color: RgbColor.fromColorDef(ColorDef.create(color)) } });
      },
    }).input;

    this._updates.push((_view: ViewState) => {
      const newAmb = this._vp.lightSettings?.ambient;
      if (newAmb) {
        intensityInput.value = newAmb.intensity.toString();
        colorInput.value = newAmb.color.toColorDef().toHexString();
      }
    });
  }

  private addHemisphere(parent: HTMLElement): void {
    const span = document.createElement("span");
    span.style.display = "flex";
    parent.appendChild(span);

    const hemi = this._vp.lightSettings?.hemisphere;
    const intensityInput = this.addIntensityInput(span, "Hemisphere", hemi?.intensity ?? 0, (intensity) => this.updateSettings({ hemisphere: { intensity } }));
    intensityInput.style.marginRight = "0.67em";

    const skyInput = createColorInput({
      parent: span,
      label: "Upper: ",
      id: this._nextId,
      display: "inline",
      value: hemi?.upperColor.toColorDef().toHexString() ?? "#FFFFFF",
      handler: (newSky) => {
        this.updateSettings({ hemisphere: { upperColor: RgbColor.fromColorDef(ColorDef.create(newSky)) } });
      },
    }).input;
    skyInput.style.marginRight = "0.67em";

    const groundInput = createColorInput({
      parent: span,
      label: "Lower: ",
      id: this._nextId,
      display: "inline",
      value: hemi?.lowerColor.toColorDef().toHexString() ?? "#FFFFFF",
      handler: (newGround) => {
        this.updateSettings({ hemisphere: { lowerColor: RgbColor.fromColorDef(ColorDef.create(newGround)) } });
      },
    }).input;

    this._updates.push((_view: ViewState) => {
      const settings = this._vp.lightSettings?.hemisphere;
      if (settings) {
        intensityInput.value = settings.intensity.toString();
        skyInput.value = settings.upperColor.toColorDef().toHexString();
        groundInput.value = settings.lowerColor.toColorDef().toHexString();
      }
    });
  }

  private addIntensityInput(parent: HTMLElement, label: string, value: number, handler: (value: number) => void): HTMLInputElement {
    return createLabeledNumericInput({
      parent,
      min: 0,
      max: 5,
      step: 0.05,
      display: "inline",
      name: `${label}: `,
      id: this._nextId,
      value,
      parseAsFloat: true,
      handler,
    }).input;
  }

  private updateSettings(props: LightSettingsProps): void {
    const lights = this._vp.lightSettings;
    if (lights)
      this._vp.setLightSettings(lights.clone(props));
  }

  private addLightingToggle(parent: HTMLElement): void {
    const elems = this.addCheckBox("Lights", (enabled: boolean) => {
      this._vp.viewFlags = this._vp.viewFlags.with("lighting", enabled);
    }, parent);

    this._updates.push((view: ViewState) => {
      const vf = view.viewFlags;
      const visible = view.is3d() && RenderMode.SmoothShade === vf.renderMode;
      elems.div.style.display = visible ? "" : "none";
      if (visible)
        elems.checkbox.checked = vf.lighting;
    });
  }

  private addCheckBox(name: string, handler: (enabled: boolean) => void, parent: HTMLElement): CheckBox {
    return createCheckBox({
      parent,
      name,
      id: this._nextId,
      handler: (cb) => handler(cb.checked),
    });
  }

  private get _nextId(): string {
    return `lighteditor_${++this._id}`;
  }
}

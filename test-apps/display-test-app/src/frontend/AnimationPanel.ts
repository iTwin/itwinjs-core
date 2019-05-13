/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Viewport, DisplayStyle3dState, calculateSunriseOrSunset } from "@bentley/imodeljs-frontend";
import { Cartographic } from "@bentley/imodeljs-common";
import { ToolBarDropDown, createToolButton } from "./ToolBar";
import { createCheckBox } from "./CheckBox";
import { Point3d } from "@bentley/geometry-core";

export class AnimationPanel extends ToolBarDropDown {
    private readonly _vp: Viewport;
    private readonly _element: HTMLElement;
    private readonly _messageElement: HTMLElement;
    private readonly _durationElement: HTMLInputElement;
    private readonly _loopElement: HTMLInputElement;
    private readonly _slider: HTMLInputElement;
    private _isAnimating = false;
    private _isPaused = false;
    private _startTime = 0;
    private _pauseTime = 0;
    private _endTime = 0;
    private _isLooping = false;

    public constructor(vp: Viewport, parent: HTMLElement) {
        super();

        this._vp = vp;

        this._element = document.createElement("div") as HTMLDivElement;
        this._element.className = "toolMenu";
        this._element.style.display = "block";
        this._element.style.cssFloat = "left";

        const durationDiv = document.createElement("div");
        const durationLabel = document.createElement("label") as HTMLLabelElement;
        durationLabel.innerText = "Duration: ";
        durationLabel.htmlFor = "anim_duration";
        durationDiv.appendChild(durationLabel);

        this._durationElement = document.createElement("input") as HTMLInputElement;
        this._durationElement.id = "anim_duration";
        this._durationElement.type = "number";
        this._durationElement.min = "0";
        this._durationElement.step = "0.1";
        this._durationElement.value = "10";
        this._durationElement.style.width = "4em";
        this._durationElement.innerHTML = " second(s)";
        durationDiv.appendChild(this._durationElement);
        this._element.appendChild(durationDiv);

        this._loopElement = createCheckBox({
            parent: this._element,
            name: "Loop",
            id: "anim_loop",
            handler: (cb) => this._isLooping = cb.checked,
        }).checkbox;

        this._element.appendChild(document.createElement("hr"));

        this._slider = document.createElement("input") as HTMLInputElement;
        this._slider.type = "range";
        this._slider.min = "0";
        this._slider.max = "1000";
        this._slider.value = "0";
        this._slider.className = "slider";
        this._slider.addEventListener("input", () => this.processSliderAdjustment());
        this._element.appendChild(this._slider);

        const controls = document.createElement("div");
        controls.style.display = "flex";
        controls.appendChild(createToolButton({
            className: "bim-icon-play",
            click: () => this.startAnimation(),
        }));
        controls.appendChild(createToolButton({
            className: "bim-icon-pause",
            click: () => this.pauseAnimation(),
        }));
        controls.appendChild(createToolButton({
            className: "bim-icon-stop",
            click: () => this.stopAnimation(),
        }));

        this._element.appendChild(controls);

        this._messageElement = document.createElement("div");
        this._element.appendChild(this._messageElement);
        this.message("Stopped.");

        parent.appendChild(this._element);
    }

    public get isOpen(): boolean { return "none" !== this._element.style.display; }
    protected _open(): void { this._element.style.display = "block"; }
    protected _close(): void { this._element.style.display = "none"; }
    public get onViewChanged(): Promise<void> { return Promise.resolve(this.stopAnimation()); }

    private stopAnimation(): void {
        this._isAnimating = this._isPaused = false;
    }

    private startAnimation(): void {
        if (this._isAnimating)
            return;

        this.message("Playing.");

        if (this._isPaused) {
            const pauseOffset = (new Date()).getTime() - this._pauseTime;
            this._startTime += pauseOffset;
            this._endTime += pauseOffset;
            this._isPaused = false;
            return;
        }

        this.setAnimationFraction(0);
        this._startTime = (new Date()).getTime();
        this._endTime = this._startTime + parseFloat(this._durationElement.value) * 1000;
        this.disableUI();
        this._isAnimating = true;
        this._isPaused = false;
        window.requestAnimationFrame(() => this.update());
    }

    private setAnimationFraction(fraction: number) {
        this._vp.animationFraction = fraction;
        // If solar shadow testing.  Remove when solar UI is available.
        const displayStyle = this._vp.view.displayStyle as DisplayStyle3dState;
        if (displayStyle && displayStyle.viewFlags.shadows) {
            let cartoCenter;
            if (this._vp.iModel.isGeoLocated) {
                const projectExtents = this._vp.iModel.projectExtents;
                const projectCenter = Point3d.createAdd2Scaled(projectExtents.low, .5, projectExtents.high, .5);
                cartoCenter = this._vp.iModel.spatialToCartographicFromEcef(projectCenter);
            } else {
                cartoCenter = Cartographic.fromDegrees(-75.17035, 39.954927, 0.0);
            }
            const today = new Date(Date.now());
            const sunrise = calculateSunriseOrSunset(today, cartoCenter, true);
            const sunset = calculateSunriseOrSunset(today, cartoCenter, false);
            displayStyle.setSunTime(sunrise.getTime() + fraction * (sunset.getTime() - sunrise.getTime()));
            this._vp.sync.invalidateScene();
        }
    }

    private update(): void {
        if (this._isPaused) {
            window.requestAnimationFrame(() => this.update());
            return;
        }

        const curTime = (new Date()).getTime();
        this.setAnimationFraction((curTime - this._startTime) / (this._endTime - this._startTime));
        this._slider.value = (this._vp.animationFraction * 1000).toString();

        const userHitStop = !this._isAnimating;
        if (curTime >= this._endTime || !this._isAnimating) {
            this.enableUI();
            if (this._isLooping) {
                this._slider.value = "0";
                this.setAnimationFraction(0);
            }
            this._isAnimating = false;
            this.message("Stopped.");
        } else {
            window.requestAnimationFrame(() => this.update());
        }

        if (!userHitStop && this._isLooping) // only loop if user did not hit stop
            this.startAnimation();
    }

    private message(msg: string): void {
        this._messageElement.innerText = msg;
    }

    private disableUI() { this.toggleUI(false); }
    private enableUI() { this.toggleUI(true); }
    private toggleUI(enabled: boolean): void {
        this._durationElement.disabled = !enabled;
        this._loopElement.disabled = !enabled;
    }

    private processSliderAdjustment(): void {
        if (this._slider.value === "0") {
            this.stopAnimation();
            return;
        }

        if (!this._isAnimating)
            this.startAnimation();

        if (!this._isPaused)
            this.pauseAnimation();

        const sliderValue = parseInt(this._slider.value, 10);
        const fraction = sliderValue / 1000.0;
        this._pauseTime = this._startTime + (this._endTime - this._startTime) * fraction;
        this.setAnimationFraction(fraction);
    }

    private pauseAnimation(): void {
        if (this._isPaused || !this._isAnimating)
            return;

        this._pauseTime = (new Date()).getTime();
        this._isPaused = true;
        this.message("Paused.");
    }
}

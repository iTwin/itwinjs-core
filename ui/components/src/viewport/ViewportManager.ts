/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Viewport */

import { Viewport } from "@bentley/imodeljs-frontend";
import { StandardViewId } from "@bentley/imodeljs-frontend";
import { UiEvent } from "@bentley/ui-core";
import { ViewportComponent } from "./ViewportComponent";
import { YawPitchRollAngles } from "@bentley/geometry-core";

/** ActiveViewportChanged Event Args class.
 */
export interface ActiveViewportChangedEventArgs {
    activeViewport?: Viewport;
}

/** ActiveViewportChanged Event class.
 */
export class ActiveViewportChangedEvent extends UiEvent<ActiveViewportChangedEventArgs> { }

/** CubeRotationChangeEvent Event Args class.
 */
export interface CubeRotationChangeEventArgs {
    rotation: YawPitchRollAngles;
    animationTime?: number;
}

/** CubeRotationChangeEvent Event class.
 */
export class CubeRotationChangeEvent extends UiEvent<CubeRotationChangeEventArgs> { }

/** StandardRotationChangeEvent Event Args class.
 */
export interface StandardRotationChangeEventArgs {
    standardRotation: StandardViewId;
}

/** StandardRotationChangeEvent Event class.
 */
export class StandardRotationChangeEvent extends UiEvent<StandardRotationChangeEventArgs> { }

/** ViewRotationChangeEvent Event Args class.
 */
export interface ViewRotationChangeEventArgs {
    viewport: Viewport;
    rotation: YawPitchRollAngles;
    animationTime?: number;
}

/** ViewRotationChangeEvent Event class.
 */
export class ViewRotationChangeEvent extends UiEvent<ViewRotationChangeEventArgs> { }

/** Viewport Manager class.
 */
export class ViewportManager {
    private static _activeViewport?: Viewport;
    private static _viewportRotation: YawPitchRollAngles;

    private static _activeViewportChangedEvent: ActiveViewportChangedEvent = new ActiveViewportChangedEvent();
    private static _cubeRotationChangeEvent: CubeRotationChangeEvent = new CubeRotationChangeEvent();
    private static _standardRotationChangeEvent: StandardRotationChangeEvent = new StandardRotationChangeEvent();
    private static _viewRotationChangeEvent: ViewRotationChangeEvent = new ViewRotationChangeEvent();

    public static get ActiveViewportChangedEvent(): ActiveViewportChangedEvent { return this._activeViewportChangedEvent; }
    public static get CubeRotationChangeEvent(): CubeRotationChangeEvent { return this._cubeRotationChangeEvent; }
    public static get StandardRotationChangeEvent(): StandardRotationChangeEvent { return this._standardRotationChangeEvent; }
    public static get ViewRotationChangeEvent(): ViewRotationChangeEvent { return this._viewRotationChangeEvent; }

    public static getActiveViewport(): Viewport | undefined {
        return ViewportManager._activeViewport;
    }

    public static isActiveViewport(viewport: Viewport): boolean {
        return viewport === ViewportManager._activeViewport;
    }

    public static setActiveViewport(activeViewport?: Viewport): void {
        if (ViewportManager._activeViewport !== activeViewport) {
            ViewportManager._activeViewport = activeViewport;
            ViewportManager.ActiveViewportChangedEvent.emit({ activeViewport });

            if (activeViewport) {
                const yawPitchRoll = ViewportComponent.getViewportYawPitchRoll(activeViewport);
                if (yawPitchRoll && yawPitchRoll !== ViewportManager.getViewRotation())
                    ViewportManager.setViewRotation(activeViewport, yawPitchRoll);
            }
        }
    }

    public static setCubeRotation(rotation: YawPitchRollAngles, animationTime?: number): void {
        this._viewportRotation = rotation;
        this.CubeRotationChangeEvent.emit({ rotation, animationTime });
    }

    public static setStandardRotation(standardRotation: StandardViewId): void {
        this.StandardRotationChangeEvent.emit({ standardRotation });
    }

    public static getViewRotation(): YawPitchRollAngles { return this._viewportRotation; }

    public static setViewRotation(viewport: Viewport, rotation: YawPitchRollAngles, animationTime?: number): void {
        this._viewportRotation = rotation;
        this.ViewRotationChangeEvent.emit({ viewport, rotation, animationTime });
    }

}

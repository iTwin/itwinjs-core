/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Viewport */

import { Viewport, ScreenViewport } from "@bentley/imodeljs-frontend";
import { StandardViewId } from "@bentley/imodeljs-frontend";
import { UiEvent } from "@bentley/ui-core";
import { ViewportComponent } from "./ViewportComponent";
import { Matrix3d } from "@bentley/geometry-core";

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
    rotMatrix: Matrix3d;
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
    rotMatrix: Matrix3d;
    animationTime?: number;
}

/** ViewRotationChangeEvent Event class.
 */
export class ViewRotationChangeEvent extends UiEvent<ViewRotationChangeEventArgs> { }

/** Viewport Manager class.
 */
export class ViewportManager {
    private static _activeViewport?: Viewport;
    private static _viewportMatrix3d: Matrix3d;

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

    public static setActiveViewport(activeViewport?: ScreenViewport): void {
        if (ViewportManager._activeViewport !== activeViewport) {
            ViewportManager._activeViewport = activeViewport;
            ViewportManager.ActiveViewportChangedEvent.emit({ activeViewport });

            if (activeViewport) {
                const rotMatrix = ViewportComponent.getViewportMatrix3d(activeViewport);
                if (rotMatrix && (!ViewportManager._viewportMatrix3d || !rotMatrix.isAlmostEqual(ViewportManager._viewportMatrix3d)))
                    ViewportManager.setViewMatrix3d(activeViewport, rotMatrix);
            }
        }
    }

    public static setCubeMatrix3d(rotMatrix: Matrix3d, animationTime?: number): void {
        this._viewportMatrix3d = rotMatrix;
        this.CubeRotationChangeEvent.emit({ rotMatrix, animationTime });
    }

    public static setStandardRotation(standardRotation: StandardViewId): void {
        this.StandardRotationChangeEvent.emit({ standardRotation });
    }

    public static getViewMatrix3d(): Matrix3d { return this._viewportMatrix3d; }

    public static setViewMatrix3d(viewport: Viewport, rotMatrix: Matrix3d, animationTime?: number): void {
        this._viewportMatrix3d = rotMatrix;
        this.ViewRotationChangeEvent.emit({ viewport, rotMatrix, animationTime });
    }

}

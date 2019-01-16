/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Transform } from "@bentley/geometry-core";
import { StandardViewId, Viewport, AccuDraw } from "@bentley/imodeljs-frontend";
import { ToolBarDropDown, createToolButton } from "./ToolBar";

// Indexed by StandardViewId enum
const entries = [ "top", "bottom", "left", "right", "front", "back", "isoleft", "isoright" ];

export class StandardRotations extends ToolBarDropDown {
  private readonly _vp: Viewport;
  private readonly _element: HTMLElement;
  private readonly _parent: HTMLElement;

  public constructor(vp: Viewport, parent: HTMLElement) {
    super();
    this._vp = vp;
    this._parent = parent;

    this._element = document.createElement("div");
    this._element.className = "toolMenu";
    this._element.style.display = "block";

    // 2 rows of 4 buttons.
    let div = document.createElement("div");
    div.style.display = "flex";
    this._element.appendChild(div);
    for (let i = 0; i < entries.length; i++) {
      if (4 === i) {
        div = document.createElement("div");
        div.style.display = "flex";
        this._element.appendChild(div);
      }

      div.appendChild(createToolButton({
        className: "bim-icon-view" + entries[i],
        click: () => this.apply(i),
      }));
    }

    parent.appendChild(this._element);
  }

  public get isOpen() { return "none" !== this._element.style.display; }
  protected _open() { this._element.style.display = "block"; }
  protected _close() { this._element.style.display = "none"; }

  public get onViewChanged(): Promise<void> {
    this._parent.style.display = this._vp.view.allow3dManipulations() ? "block" : "none";
    return Promise.resolve();
  }

  private apply(id: StandardViewId): void {
    const rMatrix = AccuDraw.getStandardRotation(id, this._vp, this._vp.isContextRotationRequired);
    const inverse = rMatrix.inverse();
    if (undefined === inverse)
      return;

    const targetMatrix = inverse.multiplyMatrixMatrix(this._vp.rotation);
    const rotateTransform = Transform.createFixedPointAndMatrix(this._vp.view.getTargetPoint(), targetMatrix);
    const startFrustum = this._vp.getFrustum();
    const newFrustum = startFrustum.clone();
    newFrustum.multiply(rotateTransform);

    this._vp.animateFrustumChange(startFrustum, newFrustum);
    this._vp.view.setupFromFrustum(newFrustum);
    this._vp.synchWithView(true);
  }
}

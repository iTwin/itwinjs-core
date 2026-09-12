/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, BeEvent } from "@itwin/core-bentley";
import { IModelConnection, IModelDisplayReference, ScreenViewport } from "@itwin/core-frontend";
import { createComboBox } from "@itwin/frontend-devtools";

function getIModelName(iModel: IModelConnection): string {
  // iModel.name is often something useless like "DgnV8Bridge"
  // iModel.key is generally an absolute path
  // Try to strip off the path leaving the filename.
  const key = iModel.key;
  const lastBackSlash = key.lastIndexOf("\\");
  const lastForwardSlash = key.lastIndexOf("/");
  const index = Math.max(lastBackSlash, lastForwardSlash);
  return index !== -1 ? key.substring(index + 1) : key;
}

export class IModelDisplayReferencePicker {
  #selectedIModelRef: IModelDisplayReference;
  #element: HTMLElement;

  public readonly onChanged = new BeEvent<() => void>();

  public constructor(vp: ScreenViewport, idPrefix: string, parent: HTMLElement, selectedRef: IModelDisplayReference) {
    this.#selectedIModelRef = selectedRef;

    this.#element = document.createElement("div");
    parent.appendChild(this.#element);

    this.#populate(vp, idPrefix, this.#selectedIModelRef.guid);

    vp.iModelRefs.onLinked.addListener(() => this.#populate(vp, idPrefix, this.#selectedIModelRef.guid));
    vp.iModelRefs.onUnlinked.addListener(() => this.#populate(vp, idPrefix, this.#selectedIModelRef.guid));
    vp.onChangeView.addListener(() => this.#populate(vp, idPrefix, this.#selectedIModelRef.guid));
  }

  public get selectedIModelRef(): IModelDisplayReference {
    return this.#selectedIModelRef;
  }

  #populate(vp: ScreenViewport, idPrefix: string, selectedGuid: string): void {
    while (this.#element.hasChildNodes())
      this.#element.removeChild(this.#element.firstChild!);

    let selectedIModelRef = undefined;
    const comboBoxEntries = [];
    for (const ref of vp.iModelRefs) {
      comboBoxEntries.push({ name: getIModelName(ref.iModel), value: ref.guid })
      if (ref.guid === selectedGuid)
        selectedIModelRef = ref;
    }

    createComboBox({
      id: `${idPrefix}_iModelRefPicker`,
      name: "iModel: ",
      value: selectedGuid,
      entries: comboBoxEntries,
      parent: this.#element,
      handler: (select: HTMLSelectElement) => {
        for (const ref of vp.iModelRefs) {
          if (ref.guid === select.value) {
            this.#selectedIModelRef = ref;
            this.onChanged.raiseEvent();
            return;
          }
        }

        assert(false && "IModelDisplayReference with specified GUID not found");
        this.#selectedIModelRef = vp.primaryIModelRef;
        this.onChanged.raiseEvent();
      },
    });

    if (!selectedIModelRef)
      selectedIModelRef = vp.primaryIModelRef;

    if (selectedIModelRef !== this.#selectedIModelRef) {
      this.#selectedIModelRef = selectedIModelRef;
      this.onChanged.raiseEvent();
    }
  }
}


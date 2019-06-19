/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  ViewStateProps,
  SheetProps,
  CodeProps,
} from "@bentley/imodeljs-common";
import {
  EntityState,
  IModelConnection,
  SpatialViewState,
  SheetViewState,
  Viewport,
  ViewState,
} from "@bentley/imodeljs-frontend";
import {
  createTextBox,
  createButton,
  createRadioBox,
  RadioBoxEntry,
} from "@bentley/frontend-devtools";
import { Id64Arg } from "@bentley/bentleyjs-core";
import SVTRpcInterface from "../common/SVTRpcInterface";
import { NamedViewStatePropsString, NamedVSPSList } from "./NamedVSPSList";
import { ToolBarDropDown } from "./ToolBar";
import { Provider } from "./FeatureOverrides";

export interface ApplySavedView {
  setView(view: ViewState): Promise<void>;
}

export class SavedViewPicker extends ToolBarDropDown {
  private readonly _vp: Viewport;
  private readonly _element: HTMLElement;
  private _imodel: IModelConnection;
  private readonly _views = NamedVSPSList.create();
  private _selectedView?: NamedViewStatePropsString;
  private readonly _viewer: ApplySavedView;
  private _onSelectedViewChanged?: () => void;
  private _newViewName = "";

  public set selectedView(view: NamedViewStatePropsString | undefined) {
    this._selectedView = view;
    if (undefined !== this._onSelectedViewChanged)
      this._onSelectedViewChanged();
  }

  public constructor(vp: Viewport, parent: HTMLElement, viewer: ApplySavedView) {
    super();

    this._vp = vp;
    this._imodel = vp.iModel;
    this._viewer = viewer;

    this._element = document.createElement("div");
    this._element.className = "scrollingToolMenu";
    this._element.style.display = "block";

    parent.appendChild(this._element);
  }

  public get isOpen() { return "none" !== this._element.style.display; }
  protected _open() { this._element.style.display = "block"; }
  protected _close() { this._element.style.display = "none"; }

  public get onViewChanged(): Promise<void> | undefined {
    if (this._imodel !== this._vp.iModel) {
      this._imodel = this._vp.iModel;
      return this.populate();
    } else {
      return undefined;
    }
    // Make sure that any feature overrides are cleared.
    // Note: this is only really necessary if FeatureOverridesPanel has not been opened yet and we have recalled a view that has saved feature overrides
    Provider.remove(this._vp);
  }

  public async populate(): Promise<void> {
    const filename = this._imodel.iModelToken.key!;
    const esvString = await SVTRpcInterface.getClient().readExternalSavedViews(filename);
    this._views.loadFromString(esvString);
    this.populateFromViewList();
  }

  private populateFromViewList(): void {
    this.selectedView = undefined;
    this._onSelectedViewChanged = undefined;

    while (this._element.hasChildNodes())
      this._element.removeChild(this._element.firstChild!);

    const textBox = createTextBox({
      id: "txt_viewName",
      parent: this._element,
      tooltip: "Name of new saved view to create",
    });

    this._element.appendChild(document.createElement("hr"));

    const entries: Array<RadioBoxEntry<string>> = [];
    for (const view of this._views) {
      entries.push({
        label: view.name,
        value: view.name,
      });
    }

    createRadioBox({
      id: "rbx_savedViews",
      parent: this._element,
      entries,
      handler: (value, _form) => this.selectedView = this.findView(value),
      vertical: true,
    });

    const buttonDiv = document.createElement("div");
    buttonDiv.style.textAlign = "center";

    const newButton = createButton({
      parent: buttonDiv,
      id: "btn_createSavedView",
      value: "Create",
      handler: () => this.saveView(),
      tooltip: "Create new saved view",
      inline: true,
    }).button;

    const recallButton = createButton({
      parent: buttonDiv,
      id: "btn_recallSavedView",
      value: "Recall",
      handler: () => this.recallView(),
      tooltip: "Recall selected view",
      inline: true,
    }).button;

    const deleteButton = createButton({
      parent: buttonDiv,
      id: "btn_deleteSavedView",
      value: "Delete",
      handler: () => this.deleteView(),
      tooltip: "Delete selected view",
      inline: true,
    }).button;

    this._element.appendChild(buttonDiv);

    this._onSelectedViewChanged = () => {
      const disabled = undefined === this._selectedView;
      recallButton.disabled = deleteButton.disabled = disabled;
    };

    textBox.div.style.marginLeft = "8px";
    textBox.div.style.marginRight = "5px";
    // textBox.textbox.size = 37;
    textBox.textbox.onkeyup = () => {
      this._newViewName = textBox.textbox.value;
      newButton.disabled = 0 === this._newViewName.length;
    };

    newButton.disabled = recallButton.disabled = deleteButton.disabled = true;
  }

  private async recallView(): Promise<void> {
    if (undefined === this._selectedView)
      return Promise.resolve();

    const vsp = JSON.parse(this._selectedView.viewStatePropsString);
    const className = vsp.viewDefinitionProps.classFullName;
    const ctor = await this._vp.view.iModel.findClassFor<typeof EntityState>(className, undefined) as typeof ViewState | undefined;
    if (undefined === ctor)
      return Promise.reject("Could not create ViewState from ViewStateProps");

    const viewState = ctor.createFromProps(vsp, this._vp.view.iModel)!;
    await viewState.load(); // make sure any attachments are loaded
    await this._viewer.setView(viewState);

    const overrideElementsString = this._selectedView.overrideElements;
    if (undefined !== overrideElementsString) {
      const overrideElements = JSON.parse(overrideElementsString) as any[];
      const provider = Provider.getOrCreate(this._vp);
      if (undefined !== provider && undefined !== overrideElements) {
        provider.overrideElementsByArray(overrideElements);
      }
    }

    const selectedElementsString = this._selectedView.selectedElements;
    if (undefined !== selectedElementsString) {
      const selectedElements = JSON.parse(selectedElementsString) as Id64Arg;
      this._imodel.selectionSet.emptyAll();
      this._imodel.selectionSet.add(selectedElements);
      this._vp.renderFrame();
    }
  }

  private async deleteView(): Promise<void> {
    if (undefined === this._selectedView || !confirm("Do you really want to delete saved view '" + this._selectedView.name + "?"))
      return Promise.resolve();

    this._views.removeName(this._selectedView.name);
    this.populateFromViewList();
    await this.saveNamedViews();
  }

  private async saveView(): Promise<void> {
    const newName = this._newViewName;
    if (0 === newName.length)
      return Promise.resolve();

    if (undefined !== this.findView(newName)) {
      if (!confirm("Saved view '" + newName + "' already exists. Replace it?"))
        return Promise.resolve();

      this._views.removeName(newName);
    }

    const view = this._vp.view;
    const modelSelectorProps = view instanceof SpatialViewState ? view.modelSelector.toJSON() : undefined;
    const props: ViewStateProps = {
      viewDefinitionProps: view.toJSON(),
      categorySelectorProps: view.categorySelector.toJSON(),
      displayStyleProps: view.displayStyle.toJSON(),
      modelSelectorProps,
    };

    if (view instanceof SheetViewState) {
      // Need to setup props.sheetProps and props.sheetAttachments
      const sheetViewState = view as SheetViewState;
      // For sheetProps all that is actually used is the size, so just null out everything else.
      const codeProps: CodeProps = { spec: "", scope: "", value: "" };
      const sp: SheetProps = {
        model: "",
        code: codeProps,
        classFullName: "",
        width: sheetViewState.sheetSize.x,
        height: sheetViewState.sheetSize.y,
        scale: 1,
      };
      props.sheetProps = sp;
      // Copy the sheet attachment ids.
      props.sheetAttachments = [];
      sheetViewState.attachmentIds.forEach((idProp) => props.sheetAttachments!.push(idProp));
    }

    const json = JSON.stringify(props);
    let selectedElementsString;
    if (this._imodel.selectionSet.size > 0) {
      const seList: string[] = [];
      this._imodel.selectionSet.elements.forEach((id) => { seList.push(id); });
      selectedElementsString = JSON.stringify(seList);
    }
    let overrideElementsString;
    const provider = Provider.getOrCreate(this._vp);
    if (undefined !== provider) {
      const overrideElements = provider.toJSON();
      overrideElementsString = JSON.stringify(overrideElements);
    }
    const nvsp = new NamedViewStatePropsString(newName, json, selectedElementsString, overrideElementsString);
    this._views.insert(nvsp);
    this.populateFromViewList();

    await this.saveNamedViews();
  }

  private async saveNamedViews(): Promise<void> {
    const filename = this._vp.view.iModel.iModelToken.key;
    if (undefined === filename)
      return;

    const namedViews = this._views.getPrintString();
    await SVTRpcInterface.getClient().writeExternalSavedViews(filename, namedViews);
  }

  private findView(name: string): NamedViewStatePropsString | undefined {
    const index = this._views.findName(name);
    return -1 !== index ? this._views.get(index)! : undefined;
  }
}

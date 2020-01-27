/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import {
  IModelApp,
  ZoomViewTool, PanViewTool, RotateViewTool, SelectionTool, FitViewTool,
} from "@bentley/imodeljs-frontend";

import { PlaceLinestringTool, DeleteElementTool, MoveElementTool } from "../tools/TestPrimitiveTools";

import "./Components.scss";

export class ViewToolBar extends React.PureComponent {
  public render() {
    return (
      <div className="toolbar">
        <a href="#" title={FitViewTool.flyover} onClick={fitView}><span className="icon icon-fit-to-view"></span></a>
        <a href="#" title={RotateViewTool.flyover} onClick={rotate}><span className="icon icon-gyroscope"></span></a>
        <a href="#" title={PanViewTool.flyover} onClick={pan}><span className="icon icon-hand-2"></span></a>
        <a href="#" title={ZoomViewTool.flyover} onClick={zoom}><span className="icon icon-zoom"></span></a>
      </div>
    );
  }
}

export class EditToolBar extends React.PureComponent {
  public render() {
    return (
      <div className="toolbar" >
        <a href="#" title={SelectionTool.flyover} onClick={select}><span className="icon icon-cursor"></span></a>
        <a href="#" title="Place Line" onClick={placeLine}><span className="icon icon-line"></span></a>
        <a href="#" title="Delete Element" onClick={deleteElement}><span className="icon icon-delete"></span></a>
        <a href="#" title="Move Element" onClick={moveElement}><span className="icon icon-move"></span></a>
      </div>
    );
  }
}

const placeLine = async () => {
  IModelApp.tools.run(PlaceLinestringTool.toolId);
};

const deleteElement = async () => {
  IModelApp.tools.run(DeleteElementTool.toolId);
};

const moveElement = async () => {
  IModelApp.tools.run(MoveElementTool.toolId);
};

const select = () => {
  IModelApp.tools.run(SelectionTool.toolId);
};

const fitView = () => {
  IModelApp.tools.run(FitViewTool.toolId, IModelApp.viewManager.selectedView);
};

const rotate = () => {
  IModelApp.tools.run(RotateViewTool.toolId, IModelApp.viewManager.selectedView);
};

const pan = () => {
  IModelApp.tools.run(PanViewTool.toolId, IModelApp.viewManager.selectedView);
};

const zoom = () => {
  IModelApp.tools.run(ZoomViewTool.toolId, IModelApp.viewManager.selectedView);
};

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { FrontstageManager, ModalFrontstageInfo } from "@bentley/ui-framework";

import { PhotoFile } from "./PhotoTree";
import { PannellumViewer, PannellumViewerConfig } from "./pannellum/pannellumViewer";
import { GeoPhotoExtension } from "./geoPhoto";

// cSpell:ignore pano

export class PannellumModalFrontstage implements ModalFrontstageInfo {
  public title: string;
  constructor(public panoBlob: Blob, public photo: PhotoFile, public config: PannellumViewerConfig, public extension: GeoPhotoExtension) {
    this.title = extension.i18n.translate("geoPhoto:messages.Viewer");
  }

  public get content(): React.ReactNode {
    return <PannellumContent panoBlob={this.panoBlob} photo={this.photo} config={this.config} extension={this.extension} />;
  }

  public static async open(panoBlob: Blob, photo: PhotoFile, config: PannellumViewerConfig, extension: GeoPhotoExtension) {
    const modalFrontstage = new PannellumModalFrontstage(panoBlob, photo, config, extension);
    FrontstageManager.openModalFrontstage(modalFrontstage);
  }
}

interface PannellumContentProps {
  panoBlob: Blob;
  photo: PhotoFile;
  config: PannellumViewerConfig;
  extension: GeoPhotoExtension;
}

interface PannellumContentState {
  viewer: PannellumViewer;
}

class PannellumContent extends React.Component<PannellumContentProps, PannellumContentState> {
  private _containerDiv: HTMLDivElement | null = null;

  public render(): React.ReactNode {
    return (
      <div ref={(div) => this._containerDiv = div} className={"pnlm-container"}>
      </div>
    );
  }

  private createPannellumViewer() {
    const viewer: PannellumViewer = new PannellumViewer(this._containerDiv, this.props.extension.i18n, this.props.config);
    viewer.initialView(this.props.panoBlob);
    // Create PannellumViewer
    // const viewer: PannellumViewer();

    // this.setState({ viewer });
  }

  public componentDidMount() {
    if (this._containerDiv) {
      this.createPannellumViewer();
    }
  }

  public componentDidUpdate(prevProps: PannellumContentProps) {
    if (this._containerDiv && prevProps.photo !== this.props.photo) {
      this.createPannellumViewer();
    }
  }
}

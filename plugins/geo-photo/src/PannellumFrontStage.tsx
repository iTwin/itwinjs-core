/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import {
  Frontstage,
  ConfigurableCreateInfo,
  ContentControl,
  ContentGroup,
  ContentLayoutDef,
  ContentProps,
  FrontstageProvider,
  FrontstageProps,
  FrontstageManager,
  ToolWidget,
  NestedFrontstage,
  Zone,
  Widget,
  CoreTools,
} from "@bentley/ui-framework";

import { PhotoFile } from "./PhotoTree";
import { PannellumViewer } from "./pannellum/pannellumViewer";
import { GeoPhotoPlugin } from "./geoPhoto";

export class PannellumContentControl extends ContentControl {
  public constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this.reactElement = <PannellumContent panoBlob = {options.panoBlob} photo={options.photo} plugin={options.plugin} />;
  }
}

interface PannellumContentProps {
  photo: PhotoFile;
  plugin: GeoPhotoPlugin;
  panoBlob: Blob;
}

interface PannellumContentState {
  viewer: PannellumViewer;
}

class PannellumContent extends React.Component<PannellumContentProps, PannellumContentState> {
  private _containerDiv: HTMLDivElement | null = null;

  public render(): React.ReactNode {
    return (
      <div ref={(div) => this._containerDiv = div} className={"pannellum-container"}>
      </div>
    );
  }

  private createPannellumViewer() {
    const viewer: PannellumViewer = new PannellumViewer (this._containerDiv, this.props.plugin.i18n);
    viewer.initialView (this.props.panoBlob);
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

export class PannellumFrontstage extends FrontstageProvider {

  constructor(public panoBlob: Blob, public photo: PhotoFile, public plugin: GeoPhotoPlugin) {
    super();
  }

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const pannellumContentLayout: ContentLayoutDef = new ContentLayoutDef({ id: "PannellumContent" });
    const contentProps: ContentProps[] = [{ classId: PannellumContentControl, applicationData: { panoBlob: this.panoBlob, photo: this.photo, plugin: this.plugin } }];
    const pannellumContentGroup: ContentGroup = new ContentGroup({ contents: contentProps });

    return (
      <Frontstage id="Pannellum"
        defaultTool={CoreTools.rotateViewCommand}
        defaultLayout={pannellumContentLayout}
        contentGroup={pannellumContentGroup}
        isInFooterMode={false}
        topLeft={
          <Zone
            widgets={[
              <Widget isFreeform={true} element={<FrontstageToolWidget />} />,
            ]}
          />
        }
      />
    );
  }

  public static async open(panoBlob: Blob, photo: PhotoFile, plugin: GeoPhotoPlugin) {
      const frontstageProvider = new PannellumFrontstage(panoBlob, photo, plugin);
      FrontstageManager.addFrontstageProvider(frontstageProvider);
      await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);
  }

}

/** Define a ToolWidget with Buttons to display in the TopLeft zone.
 */
class FrontstageToolWidget extends React.Component {
  public render() {
    return (
      <ToolWidget
        appButton={NestedFrontstage.backToPreviousFrontstageCommand}
      />
    );
  }
}

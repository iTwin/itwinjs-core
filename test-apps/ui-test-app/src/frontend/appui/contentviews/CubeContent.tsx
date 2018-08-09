/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { CSSProperties } from "react";

import { ConfigurableUiManager } from "@bentley/ui-framework";
import { ConfigurableCreateInfo } from "@bentley/ui-framework";
import { ContentControl } from "@bentley/ui-framework";
import { ViewportManager, CubeRotationChangeEventArgs } from "@bentley/ui-components";
import * as THREE from "three";

class CubeContentControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <CubeContent />;
  }
}

class CubeContent extends React.Component {
  private _renderContainer!: HTMLElement;

  private camera!: THREE.PerspectiveCamera;
  private scene!: THREE.Scene;
  private box!: THREE.Mesh;
  private renderer!: THREE.WebGLRenderer;

  constructor(props: any) {
    super(props);
    this.onWindowResize = this.onWindowResize.bind(this);
  }

  public render(): React.ReactNode {
    const divStyle: CSSProperties = {
      height: "100%",
      width: "100%",
      overflow: "hidden",
    };

    return (
      <div
        style={divStyle}
        ref={(element: any) => { this._renderContainer = element; }} />
    );
  }

  public componentDidMount() {
    ViewportManager.CubeRotationChangeEvent.addListener(this.handleCubeRotationChangeEvent);
    const { width, height } = this._renderContainer.getBoundingClientRect();

    this.camera = new THREE.PerspectiveCamera(70, width / height, 0.01, 10);
    this.camera.position.z = 1;

    this.scene = new THREE.Scene();

    const boxSize = 0.3;

    const geometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);

    const colList = [
      0xffff00,
      0x0000ff,
      0x00ff00,
      0xff00ff,
      0x00ffff,
      0xff0000,
    ];
    for (let i = 0; i < geometry.faces.length; i += 2) {
      geometry.faces[i].color.setHex(colList[i / 2]);
      geometry.faces[i + 1].color.setHex(colList[i / 2]);
    }
    const material = new THREE.MeshBasicMaterial({ vertexColors: THREE.FaceColors, overdraw: 0.5 });
    this.box = new THREE.Mesh(geometry, material);
    const wireframe = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 1), new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 3 }));

    this.box.add(wireframe);
    this.scene.add(this.box);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this._renderContainer.appendChild(this.renderer.domElement);
    this.animate();

    window.addEventListener("resize", this.onWindowResize);
  }

  public componentWillUnmount() {
    ViewportManager.CubeRotationChangeEvent.removeListener(this.handleCubeRotationChangeEvent);
    window.removeEventListener("resize", this.onWindowResize);
  }

  private handleCubeRotationChangeEvent = (args: CubeRotationChangeEventArgs) => {
    this.box.rotation.set(-(args.rotation.pitch.radians - Math.PI / 2), -args.rotation.yaw.radians, 0);
  }

  private animate = () => {
    requestAnimationFrame(this.animate);

    this.renderer.render(this.scene, this.camera);
  }

  private onWindowResize() {
    const { width, height } = this._renderContainer.getBoundingClientRect();
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }
}

ConfigurableUiManager.registerControl("CubeContent", CubeContentControl);

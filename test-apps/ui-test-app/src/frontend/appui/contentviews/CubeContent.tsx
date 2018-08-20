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

  private _camera!: THREE.PerspectiveCamera;
  private _scene!: THREE.Scene;
  private _box!: THREE.Mesh;
  private _renderer!: THREE.WebGLRenderer;

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
    ViewportManager.CubeRotationChangeEvent.addListener(this._handleCubeRotationChangeEvent);
    const { width, height } = this._renderContainer.getBoundingClientRect();

    this._camera = new THREE.PerspectiveCamera(70, width / height, 0.01, 10);
    this._camera.position.z = 1;

    this._scene = new THREE.Scene();

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
    this._box = new THREE.Mesh(geometry, material);
    const wireframe = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 1), new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 3 }));

    this._box.add(wireframe);
    this._scene.add(this._box);

    this._renderer = new THREE.WebGLRenderer({ antialias: true });
    this._renderer.setSize(width, height);
    this._renderContainer.appendChild(this._renderer.domElement);
    this._animate();

    window.addEventListener("resize", this.onWindowResize);
  }

  public componentWillUnmount() {
    ViewportManager.CubeRotationChangeEvent.removeListener(this._handleCubeRotationChangeEvent);
    window.removeEventListener("resize", this.onWindowResize);
  }

  private _handleCubeRotationChangeEvent = (args: CubeRotationChangeEventArgs) => {
    this._box.rotation.set(-(args.rotation.pitch.radians - Math.PI / 2), -args.rotation.yaw.radians, 0);
  }

  private _animate = () => {
    requestAnimationFrame(this._animate);

    this._renderer.render(this._scene, this._camera);
  }

  private onWindowResize() {
    const { width, height } = this._renderContainer.getBoundingClientRect();
    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();

    this._renderer.setSize(width, height);
  }
}

ConfigurableUiManager.registerControl("CubeContent", CubeContentControl);

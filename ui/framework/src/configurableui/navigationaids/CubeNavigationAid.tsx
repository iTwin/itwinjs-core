/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module NavigationAids */

import * as React from "react";

import { ConfigurableCreateInfo } from "../ConfigurableUiControl";
import { NavigationAidControl } from "../NavigationAidControl";
import * as classnames from "classnames";
import * as THREE from "three";
import { YawPitchRollAngles } from "@bentley/geometry-core";

import "./CubeNavigationAid.scss";
import { UiFramework } from "../../UiFramework";

import { ViewportManager, ViewRotationChangeEventArgs } from "@bentley/ui-components";

/** NavigationAid that displays an interactive rotation cube that synchonizes with the rotation of the iModel Viewport */
export class CubeNavigationAidControl extends NavigationAidControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this.reactElement = <CubeNavigationAid />;
  }
  public getSize(): string | undefined { return "96px"; }
}

export enum HitBox {
  None = -1,
  /** faces */
  Front, Back, Left, Right, Top, Bottom,
  /** edges */
  FrontLeft, FrontRight, FrontTop, FrontBottom,
  BackLeft, BackRight, BackTop, BackBottom,
  LeftTop, LeftBottom, RightTop, RightBottom,
  /** corners */
  FrontLeftTop, FrontLeftBottom, FrontRightTop, FrontRightBottom,
  BackLeftTop, BackLeftBottom, BackRightTop, BackRightBottom,
}

interface HitboxData {
  geometry: THREE.BoxGeometry;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  boxRotation: THREE.Euler;
}

enum Arrow {
  Up, Down, Left, Right,
}

interface Direction {
  up: HitBox;
  down: HitBox;
  left: HitBox;
  right: HitBox;
}
export interface CubeNavigationState {
  visible: boolean;
  currentFace: HitBox;
  dragging: boolean;
  endRot: THREE.Euler;
  startRot: THREE.Euler;
  animPercent: number;
  animTime: number;
}

/** A Cube Navigation Aid */
export class CubeNavigationAid extends React.Component<{}, CubeNavigationState> {
  private _renderContainer: HTMLCanvasElement | null = null;

  private camera!: THREE.PerspectiveCamera;
  private scene!: THREE.Scene;
  private hitboxMaterial!: THREE.MeshBasicMaterial;
  private hitboxActiveMaterial!: THREE.MeshBasicMaterial;
  private renderer!: THREE.WebGLRenderer;
  private cameraGroup!: THREE.Group;
  private box!: THREE.Mesh;
  private hitboxes: THREE.Mesh[] = [];
  private hitboxData: HitboxData[] = [];
  private raycaster!: THREE.Raycaster;
  private mouse: THREE.Vector2 = new THREE.Vector2(-1, -1);

  private start: THREE.Vector2 = new THREE.Vector2();
  private then: number = 0;

  public readonly state: Readonly<CubeNavigationState> = {
    visible: true,
    currentFace: HitBox.Front,
    dragging: false,
    endRot: new THREE.Euler(0, 0, 0, "ZYX"),
    startRot: new THREE.Euler(0, 0, 0, "ZYX"),
    animPercent: 1.0,
    animTime: 1000,
  };

  public render(): React.ReactNode {
    return (
      <div className={"cube-container"}
        onMouseDown={this.onMouseStartDrag}
        onMouseMove={this.onCanvasMouseMove} >
        <div
          className={"cube-canvas-container"}
          ref={(element: any) => { this._renderContainer = element; }} />
        <div className={classnames("cube-pointer-container", { visible: this.state.visible })}>
          <div className={"cube-row"}>
            <span className={"cube-pointer icon icon-caret-down"}
              onClick={(_e) => { this.onArrowClick(Arrow.Up); }} />
          </div>
          <div className={"cube-row cube-pointer-center"}>
            <span className={"cube-pointer icon icon-caret-right"}
              onClick={(_e) => { this.onArrowClick(Arrow.Left); }} />
            <span className={"cube-pointer icon icon-caret-left"}
              onClick={(e) => { e.preventDefault(); this.onArrowClick(Arrow.Right); }} />
          </div>
          <div className={"cube-row"}>
            <span className={"cube-pointer icon icon-caret-up"}
              onClick={(e) => { e.preventDefault(); this.onArrowClick(Arrow.Down); }} />
          </div>
        </div>
      </div>
    );
  }

  private isFace(hitbox: HitBox) {
    return hitbox === HitBox.Front || hitbox === HitBox.Back ||
      hitbox === HitBox.Right || hitbox === HitBox.Left ||
      hitbox === HitBox.Top || hitbox === HitBox.Bottom;
  }

  private onArrowClick = (arrow: Arrow) => {
    // data relating Up/Down/Left/Right directions relative to every surface
    const routes: Direction[] = [];
    routes[HitBox.Front] = { up: HitBox.Top, down: HitBox.Bottom, left: HitBox.Left, right: HitBox.Right };
    routes[HitBox.Back] = { up: HitBox.Top, down: HitBox.Bottom, left: HitBox.Right, right: HitBox.Left };
    routes[HitBox.Top] = { up: HitBox.Back, down: HitBox.Front, left: HitBox.Left, right: HitBox.Right };
    routes[HitBox.Bottom] = { up: HitBox.Front, down: HitBox.Back, left: HitBox.Left, right: HitBox.Right };
    routes[HitBox.Right] = { up: HitBox.Top, down: HitBox.Bottom, left: HitBox.Front, right: HitBox.Back };
    routes[HitBox.Left] = { up: HitBox.Top, down: HitBox.Bottom, left: HitBox.Back, right: HitBox.Front };

    if (this.isFace(this.state.currentFace)) {
      // integer value representing integer orientations. Finds closest orientation to allow for slight rounding errors in this.state.endRot.y
      let rotation = 0;
      if (this.state.currentFace === HitBox.Top)
        rotation = this.state.endRot.y;
      if (this.state.currentFace === HitBox.Bottom)
        rotation = -this.state.endRot.y;
      rotation = Math.round(CubeNavigationAid.normalizeAngle(rotation) * 2 / Math.PI) + 1;

      const direction = routes[this.state.currentFace];
      let toHitbox: HitBox = HitBox.None;

      // map different directions to particular rotation orientations
      switch (arrow) {
        case Arrow.Up:
          switch (rotation) {
            case 0:
              toHitbox = direction.right;
              break;
            case 1:
              toHitbox = direction.up;
              break;
            case 2:
              toHitbox = direction.left;
              break;
            case 3:
              toHitbox = direction.down;
              break;
          }
          break;
        case Arrow.Down:
          toHitbox = direction.down;
          switch (rotation) {
            case 0:
              toHitbox = direction.right;
              break;
            case 1:
              toHitbox = direction.down;
              break;
            case 2:
              toHitbox = direction.left;
              break;
            case 3:
              toHitbox = direction.up;
              break;
          }
          break;
        case Arrow.Right:
          switch (rotation) {
            case 0:
              toHitbox = direction.down;
              break;
            case 1:
              toHitbox = direction.left;
              break;
            case 2:
              toHitbox = direction.up;
              break;
            case 3:
              toHitbox = direction.right;
              break;
          }
          break;
        case Arrow.Left:
          switch (rotation) {
            case 0:
              toHitbox = direction.up;
              break;
            case 1:
              toHitbox = direction.right;
              break;
            case 2:
              toHitbox = direction.down;
              break;
            case 3:
              toHitbox = direction.left;
              break;
          }
          break;
      }
      const data = this.hitboxData[toHitbox];
      if (toHitbox !== HitBox.None && data && data.boxRotation) {
        const startRot = this.cameraGroup.rotation.clone();
        let endRot = new THREE.Euler(0, 0, 0, "ZYX");
        if (toHitbox === HitBox.Top || toHitbox === HitBox.Bottom) {
          endRot = new THREE.Euler(data.boxRotation.x, Math.round(this.state.endRot.y / (Math.PI / 2)) * (Math.PI / 2), data.boxRotation.y, "ZYX");
        } else {
          endRot = data.boxRotation.clone();
        }
        this.animateRotation(500, startRot, endRot, toHitbox);
      }
    }
  }

  private onMouseStartDrag = (event: any) => {
    event.preventDefault();

    if (!this._renderContainer)
      return;

    const rect = this._renderContainer.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = - ((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersection = this.raycaster.intersectObjects(this.hitboxes);
    if (intersection.length > 0) {
      // only start listening after drag is confirmed. Ie. the 3D box is clicked.
      window.addEventListener("mousemove", this.onMouseDrag, false);
      window.addEventListener("mouseup", this.onMouseStopDrag, false);

      this.start.x = event.clientX;
      this.start.y = event.clientY;

      const rot = this.cameraGroup.rotation.clone();
      this.setState({
        startRot: rot,
        endRot: rot,
        dragging: true,
      });
    }
  }

  private onGlobalMouseMove = (event: any) => {
    if (!this._renderContainer)
      return;
    const rect = this._renderContainer.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = - ((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onCanvasMouseMove = () => {
    this.updateHover();
  }

  private onMouseOutOfWindow = (event: any) => {
    if (!event.relatedTarget) {
      this.mouse = new THREE.Vector2(-1, -1);
      this.updateHover();
    }
  }

  private onMouseDrag = (event: any) => {
    const scale = 0.05;

    const rot = new THREE.Euler(0, 0, 0, "ZYX");
    rot.y = this.state.startRot.y + (this.start.x - event.clientX) * scale;
    rot.x = this.state.startRot.x + (this.start.y - event.clientY) * scale;
    if (rot.x > Math.PI / 2)
      rot.x = Math.PI / 2;
    if (rot.x < -Math.PI / 2)
      rot.x = -Math.PI / 2;

    this.setRotation(rot, this.state.startRot);
  }

  private updateHover = () => {
    if (!this.state.dragging) {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersection = this.raycaster.intersectObjects(this.hitboxes);
      if (intersection.length > 0) {
        for (const hitbox of this.hitboxes) {
          if (intersection[0].object === hitbox) {
            hitbox.material = this.hitboxActiveMaterial;
          } else {
            hitbox.material = this.hitboxMaterial;
          }
        }
      } else {
        for (const hitbox of this.hitboxes) {
          hitbox.material = this.hitboxMaterial;
        }
      }
    }

  }

  private onMouseStopDrag = (event: any) => {
    if (!this._renderContainer)
      return;

    if (this.start.x === event.clientX && this.start.y === event.clientY) {
      const rect = this._renderContainer.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = - ((event.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersection = this.raycaster.intersectObjects(this.hitboxes);
      if (intersection.length > 0) {
        for (let key = 0; key < this.hitboxes.length; key++) {
          const hitbox = this.hitboxes[key];
          if (intersection[0].object === hitbox) {
            const data = this.hitboxData[key];
            if (data && data.boxRotation) {

              let currentFace = HitBox.None;
              if (this.isFace(key))
                currentFace = key;
              const startRot = this.cameraGroup.rotation.clone();
              let endRot = new THREE.Euler(0, 0, 0, "ZYX");

              if ((key === HitBox.Top || key === HitBox.Bottom) && key !== this.state.currentFace) {
                endRot = new THREE.Euler(data.boxRotation.x, Math.round(this.state.endRot.y / (Math.PI / 2)) * (Math.PI / 2), data.boxRotation.z, "ZYX");
              } else {
                endRot = data.boxRotation.clone();
              }
              this.animateRotation(500, startRot, endRot, currentFace);
              break;
            }
          }
        }
      }
    }
    this.setState({ dragging: false }, () => { this.updateHover(); });

    // remove so event only triggers after this.on this.onMousStartDrag
    window.removeEventListener("mousemove", this.onMouseDrag);
    window.removeEventListener("mouseup", this.onMouseStopDrag);
  }

  public componentDidMount() {
    if (!this._renderContainer)
      return;

    const { width, height } = this._renderContainer.getBoundingClientRect();

    // enum maps specifically to three.js materials list
    enum TextureSides {
      Right,
      Left,
      Top,
      Bottom,
      Front,
      Back,
    }

    const labels = [];
    try {
      labels[TextureSides.Right] = UiFramework.i18n.translate("UiFramework:cube.right");
      labels[TextureSides.Left] = UiFramework.i18n.translate("UiFramework:cube.left");
      labels[TextureSides.Top] = UiFramework.i18n.translate("UiFramework:cube.top");
      labels[TextureSides.Bottom] = UiFramework.i18n.translate("UiFramework:cube.bottom");
      labels[TextureSides.Front] = UiFramework.i18n.translate("UiFramework:cube.front");
      labels[TextureSides.Back] = UiFramework.i18n.translate("UiFramework:cube.back");
    } catch (error) {
      labels[TextureSides.Right] = "Right";
      labels[TextureSides.Left] = "Left";
      labels[TextureSides.Top] = "Top";
      labels[TextureSides.Bottom] = "Bottom";
      labels[TextureSides.Front] = "Front";
      labels[TextureSides.Back] = "Back";
    }

    const materials: THREE.MeshBasicMaterial[] = [];
    labels.forEach((label, index) => {
      const texture = document.createElement("canvas");
      texture.width = texture.height = 1024;
      const textureContext = texture.getContext("2d");
      if (textureContext) {
        textureContext.imageSmoothingEnabled = false;
        switch (index) {
          case TextureSides.Top:
            textureContext.fillStyle = "#EFEFEF";
            break;
          case TextureSides.Left:
          case TextureSides.Right:
          case TextureSides.Front:
          case TextureSides.Back:
            const gradient = textureContext.createLinearGradient(0, 0, 0, texture.height);
            gradient.addColorStop(0, "#EFEFEF");
            gradient.addColorStop(1, "#AAAAAA");
            textureContext.fillStyle = gradient;
            break;
          case TextureSides.Bottom:
            textureContext.fillStyle = "#AAAAAA";
            break;
        }
        textureContext.fillRect(0, 0, texture.width, texture.height);

        textureContext.fillStyle = "black";
        textureContext.font = "normal bold 220px sans-serif";
        textureContext.textBaseline = "middle";
        textureContext.textAlign = "center";
        const x = texture.width / 2;
        const y = texture.height / 2;
        textureContext.fillText(label, x, y);
      }

      const material = new THREE.MeshBasicMaterial({ map: new THREE.Texture(texture) });
      material.map.needsUpdate = true;
      material.map.anisotropy = 64;

      materials.push(material);
    });

    this.camera = new THREE.PerspectiveCamera(20, width / height, 0.01, 100);
    this.camera.position.z = 5;
    this.cameraGroup = new THREE.Group();
    this.cameraGroup.add(this.camera);
    this.cameraGroup.rotation.order = "ZYX";

    this.scene = new THREE.Scene();
    this.raycaster = new THREE.Raycaster();

    const boxSize = 1;

    // edge hitbox covers 20% of box width
    const edgeSize = boxSize * 0.2;
    // face hitbox covers 60% of box width
    const faceSize = boxSize * 0.6;

    // amount hitboxes protrude from box
    const depth = 0.01;
    const dist = boxSize / 2 - edgeSize / 2 + depth;

    const geometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
    this.box = new THREE.Mesh(geometry, materials);
    this.hitboxMaterial = new THREE.MeshBasicMaterial({ color: 0x0089FF, transparent: true, opacity: 0.0 });
    this.hitboxActiveMaterial = new THREE.MeshBasicMaterial({ color: 0x0089FF, transparent: true, opacity: 0.3 });

    const faceGeometry = new THREE.BoxGeometry(faceSize, edgeSize, faceSize);
    const edgeGeometry = new THREE.BoxGeometry(faceSize, edgeSize, edgeSize);
    const cornerGeometry = new THREE.BoxGeometry(edgeSize, edgeSize, edgeSize);

    // initialize all hitbox data

    // faces
    this.hitboxData[HitBox.Front] = { geometry: faceGeometry, position: new THREE.Vector3(0, 0, dist), rotation: new THREE.Euler(Math.PI / 2, 0, 0), boxRotation: new THREE.Euler(0, 0, 0, "ZYX") };
    this.hitboxData[HitBox.Back] = { geometry: faceGeometry, position: new THREE.Vector3(0, 0, -dist), rotation: new THREE.Euler(Math.PI / 2, 0, 0), boxRotation: new THREE.Euler(0, -Math.PI, 0, "ZYX") };
    this.hitboxData[HitBox.Left] = { geometry: faceGeometry, position: new THREE.Vector3(dist, 0, 0), rotation: new THREE.Euler(0, 0, Math.PI / 2), boxRotation: new THREE.Euler(0, Math.PI / 2, 0, "ZYX") };
    this.hitboxData[HitBox.Right] = { geometry: faceGeometry, position: new THREE.Vector3(-dist, 0, 0), rotation: new THREE.Euler(0, 0, Math.PI / 2), boxRotation: new THREE.Euler(0, -Math.PI / 2, 0, "ZYX") };
    this.hitboxData[HitBox.Top] = { geometry: faceGeometry, position: new THREE.Vector3(0, dist, 0), rotation: new THREE.Euler(0, 0, 0), boxRotation: new THREE.Euler(-Math.PI / 2, 0, 0, "ZYX") };
    this.hitboxData[HitBox.Bottom] = { geometry: faceGeometry, position: new THREE.Vector3(0, -dist, 0), rotation: new THREE.Euler(0, 0, 0), boxRotation: new THREE.Euler(Math.PI / 2, 0, 0, "ZYX") };
    // edges
    this.hitboxData[HitBox.FrontLeft] = { geometry: edgeGeometry, position: new THREE.Vector3(dist, 0, dist), rotation: new THREE.Euler(0, 0, Math.PI / 2), boxRotation: new THREE.Euler(0, Math.PI / 4, 0, "ZYX") };
    this.hitboxData[HitBox.FrontRight] = { geometry: edgeGeometry, position: new THREE.Vector3(-dist, 0, dist), rotation: new THREE.Euler(0, 0, Math.PI / 2), boxRotation: new THREE.Euler(0, -Math.PI / 4, 0, "ZYX") };
    this.hitboxData[HitBox.FrontTop] = { geometry: edgeGeometry, position: new THREE.Vector3(0, dist, dist), rotation: new THREE.Euler(0, 0, 0), boxRotation: new THREE.Euler(-Math.PI / 4, 0, 0, "ZYX") };
    this.hitboxData[HitBox.FrontBottom] = { geometry: edgeGeometry, position: new THREE.Vector3(0, -dist, dist), rotation: new THREE.Euler(0, 0, 0), boxRotation: new THREE.Euler(Math.PI / 4, 0, 0, "ZYX") };

    this.hitboxData[HitBox.BackLeft] = { geometry: edgeGeometry, position: new THREE.Vector3(dist, 0, -dist), rotation: new THREE.Euler(0, 0, Math.PI / 2), boxRotation: new THREE.Euler(0, 3 * Math.PI / 4, 0, "ZYX") };
    this.hitboxData[HitBox.BackRight] = { geometry: edgeGeometry, position: new THREE.Vector3(-dist, 0, -dist), rotation: new THREE.Euler(0, 0, Math.PI / 2), boxRotation: new THREE.Euler(0, -3 * Math.PI / 4, 0, "ZYX") };
    this.hitboxData[HitBox.BackTop] = { geometry: edgeGeometry, position: new THREE.Vector3(0, dist, -dist), rotation: new THREE.Euler(0, 0, 0), boxRotation: new THREE.Euler(-Math.PI / 4, Math.PI, 0, "ZYX") };
    this.hitboxData[HitBox.BackBottom] = { geometry: edgeGeometry, position: new THREE.Vector3(0, -dist, -dist), rotation: new THREE.Euler(0, 0, 0), boxRotation: new THREE.Euler(Math.PI / 4, Math.PI, 0, "ZYX") };

    this.hitboxData[HitBox.LeftTop] = { geometry: edgeGeometry, position: new THREE.Vector3(dist, dist, 0), rotation: new THREE.Euler(0, Math.PI / 2, 0), boxRotation: new THREE.Euler(-Math.PI / 4, Math.PI / 2, 0, "ZYX") };
    this.hitboxData[HitBox.LeftBottom] = { geometry: edgeGeometry, position: new THREE.Vector3(dist, -dist, 0), rotation: new THREE.Euler(0, Math.PI / 2, 0), boxRotation: new THREE.Euler(Math.PI / 4, Math.PI / 2, 0, "ZYX") };
    this.hitboxData[HitBox.RightTop] = { geometry: edgeGeometry, position: new THREE.Vector3(-dist, dist, 0), rotation: new THREE.Euler(0, Math.PI / 2, 0), boxRotation: new THREE.Euler(-Math.PI / 4, -Math.PI / 2, 0, "ZYX") };
    this.hitboxData[HitBox.RightBottom] = { geometry: edgeGeometry, position: new THREE.Vector3(-dist, -dist, 0), rotation: new THREE.Euler(0, Math.PI / 2, 0), boxRotation: new THREE.Euler(Math.PI / 4, -Math.PI / 2, 0, "ZYX") };
    // corners
    this.hitboxData[HitBox.FrontLeftTop] = { geometry: cornerGeometry, position: new THREE.Vector3(dist, dist, dist), rotation: new THREE.Euler(0, 0, 0), boxRotation: new THREE.Euler(-Math.PI / 5, Math.PI / 4, 0, "ZYX") };
    this.hitboxData[HitBox.FrontLeftBottom] = { geometry: cornerGeometry, position: new THREE.Vector3(dist, -dist, dist), rotation: new THREE.Euler(0, 0, 0), boxRotation: new THREE.Euler(Math.PI / 5, Math.PI / 4, 0, "ZYX") };
    this.hitboxData[HitBox.FrontRightTop] = { geometry: cornerGeometry, position: new THREE.Vector3(-dist, dist, dist), rotation: new THREE.Euler(0, 0, 0), boxRotation: new THREE.Euler(-Math.PI / 5, -Math.PI / 4, 0, "ZYX") };
    this.hitboxData[HitBox.FrontRightBottom] = { geometry: cornerGeometry, position: new THREE.Vector3(-dist, -dist, dist), rotation: new THREE.Euler(0, 0, 0), boxRotation: new THREE.Euler(Math.PI / 5, -Math.PI / 4, 0, "ZYX") };

    this.hitboxData[HitBox.BackLeftTop] = { geometry: cornerGeometry, position: new THREE.Vector3(dist, dist, -dist), rotation: new THREE.Euler(0, 0, 0), boxRotation: new THREE.Euler(-Math.PI / 5, 3 * Math.PI / 4, 0, "ZYX") };
    this.hitboxData[HitBox.BackLeftBottom] = { geometry: cornerGeometry, position: new THREE.Vector3(dist, -dist, -dist), rotation: new THREE.Euler(0, 0, 0), boxRotation: new THREE.Euler(Math.PI / 5, 3 * Math.PI / 4, 0, "ZYX") };
    this.hitboxData[HitBox.BackRightTop] = { geometry: cornerGeometry, position: new THREE.Vector3(-dist, dist, -dist), rotation: new THREE.Euler(0, 0, 0), boxRotation: new THREE.Euler(-Math.PI / 5, -3 * Math.PI / 4, 0, "ZYX") };
    this.hitboxData[HitBox.BackRightBottom] = { geometry: cornerGeometry, position: new THREE.Vector3(-dist, -dist, -dist), rotation: new THREE.Euler(0, 0, 0), boxRotation: new THREE.Euler(Math.PI / 5, -3 * Math.PI / 4, 0, "ZYX") };

    // turn data into three.js objects
    for (const key of Object.keys(this.hitboxData)) {
      const i = parseInt(key, 10);
      const data = this.hitboxData[i];
      const hitbox = new THREE.Mesh(data.geometry, this.hitboxMaterial);
      hitbox.position.copy(data.position);
      hitbox.rotation.copy(data.rotation);
      this.scene.add(hitbox);
      this.hitboxes[i] = hitbox;
    }

    // box edge lines
    const wireframe = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 1), new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 3 }));

    this.box.add(wireframe);

    this.scene.add(this.box);
    this.scene.add(this.cameraGroup);

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(width, height);
    this._renderContainer.appendChild(this.renderer.domElement);

    this.then = Date.now();
    requestAnimationFrame(this.animate);

    ViewportManager.ViewRotationChangeEvent.addListener(this.handleViewRotationChangeEvent);
    window.addEventListener("mousemove", this.onGlobalMouseMove, false);
    window.addEventListener("mouseout", this.onMouseOutOfWindow, false);
  }

  public componentWillUnmount() {
    ViewportManager.ViewRotationChangeEvent.removeListener(this.handleViewRotationChangeEvent);
    window.removeEventListener("mousemove", this.onGlobalMouseMove, false);
    window.removeEventListener("mouseout", this.onMouseOutOfWindow, false);
  }

  private animateRotation = (animTime: number, startRot: THREE.Euler, endRot: THREE.Euler, currentFace: HitBox = HitBox.None) => {
    // Uncomment these lines to use imodeljs-core animations
    // if (!this.almostEqual(endRot, this.state.endRot))
    //   ViewportManager.setCubeRotation(CubeNavigationAid.threeJSToImodelJS(endRot), animTime);

    // set animation variables, let this.animate process it.
    this.setState({
      startRot, endRot,
      animPercent: 0, animTime,
      currentFace, visible: currentFace !== HitBox.None, // only set visible when currentFace is an actual face
    });
  }
  private setRotation = (rot: THREE.Euler, startRot?: THREE.Euler, currentFace: HitBox = HitBox.None) => {
    // update viewport only if rotation changes
    if (!CubeNavigationAid.almostEqual(rot, this.state.endRot))
      ViewportManager.setCubeRotation(CubeNavigationAid.threeJSToIModelJS(rot), 0);
    // set variables, with animPercent at 1 to prevent animation.
    this.setState({
      startRot: startRot || rot, endRot: rot,
      animPercent: 1.0, animTime: 0,
      currentFace, visible: currentFace !== HitBox.None, // only set visible when currentFace is an actual face
    }, () => {
      this.cameraGroup.rotation.copy(this.state.endRot);
    });
  }

  private animate = (timestamp: number) => {
    requestAnimationFrame(this.animate);
    const delta = timestamp - this.then;
    this.then = timestamp;

    let { animPercent } = this.state;

    if (animPercent >= 1.0) { // no animation occuring
      this.updateHover();

      this.cameraGroup.rotation.x = this.state.endRot.x;
      this.cameraGroup.rotation.y = this.state.endRot.y;
    } else { // animation in progress
      // delta adjusts for variable frame rates
      animPercent += delta / this.state.animTime;
      // normalize to ensure closest animation transition
      const diffX = CubeNavigationAid.normalizeAngle(this.state.endRot.x - this.state.startRot.x);
      const diffZ = CubeNavigationAid.normalizeAngle(this.state.endRot.y - this.state.startRot.y);
      const fn = CubeNavigationAid.easeFn(animPercent);
      this.cameraGroup.rotation.set(this.state.startRot.x + diffX * fn, this.state.startRot.y + diffZ * fn, 0);
      ViewportManager.setCubeRotation(CubeNavigationAid.threeJSToIModelJS(this.cameraGroup.rotation), 0); // Comment this line to use imodeljs-core animations
      if (animPercent >= 1.0) { // animation ends
        animPercent = 1.0;
        this.cameraGroup.rotation.copy(this.state.endRot);
        ViewportManager.setCubeRotation(CubeNavigationAid.threeJSToIModelJS(this.state.endRot), -1);
      }
    }
    if (animPercent !== this.state.animPercent)
      this.setState({ animPercent });
    this.renderer.render(this.scene, this.camera);
  }

  /** Converts from threeJS Euler angles to iModelJS YawPitchRollAngles */
  public static threeJSToIModelJS = (a: THREE.Euler) => {
    return YawPitchRollAngles.createRadians(a.y, a.x + Math.PI / 2, 0);
  }

  /** Converts from iModelJS YawPitchRollAngles to threeJS Euler angles */
  public static iModelJSToThreeJS = (a: YawPitchRollAngles) => {
    return new THREE.Euler(-a.pitch.radians - Math.PI / 2, a.yaw.radians, 0, "ZYX");
  }

  /** function used to animate cube rotation */
  /** @hidden */
  public static easeFn(t: number) {
    // sinusoidal ease-in-ease-out
    return -(Math.cos(t * Math.PI) - 1) / 2;
  }

  // normalizes any radian angle to (-pi, pi]
  /** @hidden */
  public static normalizeAngle(angle: number) {
    while (angle <= -Math.PI)
      angle += 2 * Math.PI;
    while (angle > Math.PI)
      angle -= 2 * Math.PI;

    return angle;
  }

  // equal, discounting rounding errors (high tolerance to filter only visually significant changes)
  /** @hidden */
  public static almostEqual = (a1: THREE.Euler, a2: THREE.Euler) => {
    const dx = a2.x - a1.x, dy = a2.y - a1.y, dz = a2.z - a1.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return Math.abs(CubeNavigationAid.normalizeAngle(d)) < 0.001;
  }

  // Synchronize with rotation coming from the Viewport
  private handleViewRotationChangeEvent = (args: ViewRotationChangeEventArgs) => {
    const v = CubeNavigationAid.iModelJSToThreeJS(args.rotation);
    const c = this.state.endRot;

    if (!CubeNavigationAid.almostEqual(v, c) && this.state.animPercent >= 1.0 && !this.state.dragging) {
      this.cameraGroup.rotation.copy(v);
      this.setState({
        startRot: v, endRot: v,
        animPercent: 1.0, animTime: 0,
        currentFace: HitBox.None, visible: false,
      });
    }
  }
}

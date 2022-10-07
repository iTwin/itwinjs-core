/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export const fakeContext = ({
  beginPath: () => {},
  closePath: () => {},
  moveTo: (_x: number, _y: number) => {},
  lineTo: (_x: number, _y: number) => {},
  fill: (_fillRule?: CanvasFillRule)=> {},
  stroke: ()=> {},
  drawImage: (_image: CanvasImageSource, _dx: number, _dy: number) => {},

} as CanvasRenderingContext2D);

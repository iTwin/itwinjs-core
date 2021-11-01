/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Common
 */

import * as React from "react";
import { UiError } from "@itwin/appui-abstract";
import { SvgSprite, WebFontIcon, WebFontIconProps } from "@itwin/core-react";
import { UiComponents } from "../UiComponents";
import { Image, ImageFileFormat, LoadedBinaryImage, LoadedImage } from "./IImageLoader";

/** A class that renders images from data provided by an image loader
 * @internal
 */
export class ImageRenderer {
  private hexToBase64(hexstring: string) {
    const match = hexstring.match(/\w{2}/g);
    // istanbul ignore next
    if (!match)
      return "";

    return btoa(match.map((a) => { // eslint-disable-line deprecation/deprecation
      return String.fromCharCode(parseInt(a, 16));
    }).join(""));
  }

  /** Render raw binary image */
  private renderBinary(data: string, format: ImageFileFormat) {
    // Convert binary to base64
    const dataAsBase64 = this.hexToBase64(data);
    return (<img src={`data:image/${format};base64,${dataAsBase64}`} alt="" />);
  }

  /** Render svg string into JSX */
  private renderSvg(svg: string) {
    return (
      <div><SvgSprite src={svg} /></div>
    );
  }

  /** Render image from an url */
  private renderUrl(url: string) {
    return (<img src={url} alt="" />);
  }

  /** Render image as core-react icon */
  private renderCoreIcon(iconName: string) {
    return (<WebFontIcon iconName={iconName} />);
  }

  /** Replaces the escaped instances of "\:" with ":" */
  private normalizeEscapedIconString(escapedIconString: string) {
    return escapedIconString.replace(/\\:/g, ":");
  }

  /**
   * Extract class and name from icon name, if the name follows format "{className}:{fontName}".
   * className and fontName can be escaped using \ if : is needed.
   */
  private extractIconClassAndName(iconName: string): Pick<WebFontIconProps, "iconClassName" | "iconName"> {
    const matches = iconName.match(/(\\.|[^:])+/g);
    if (!matches || matches.length !== 2)
      return {
        iconClassName: undefined,
        iconName,
      };

    return {
      iconClassName: this.normalizeEscapedIconString(matches[0]),
      iconName: this.normalizeEscapedIconString(matches[1]),
    };
  }

  /**
   * Render image as provided webfont icon.
   * Defaults to core-react icon if iconName does not contain className.
   */
  private renderWebfontIcon(iconName: string) {
    const iconInfo = this.extractIconClassAndName(iconName);
    return (<WebFontIcon {...iconInfo} />);
  }

  /** Render image from data provided by an image loader */
  public render(loadedImage: Image): React.ReactNode {
    switch (loadedImage.sourceType) {
      case "binary":
        const image = loadedImage as LoadedBinaryImage;
        return this.renderBinary(image.value, image.fileFormat);

      case "url":
        return this.renderUrl((loadedImage as LoadedImage).value);

      case "svg":
        return this.renderSvg((loadedImage as LoadedImage).value);

      case "core-icon":
        return this.renderCoreIcon((loadedImage as LoadedImage).value);

      case "webfont-icon":
        return this.renderWebfontIcon((loadedImage as LoadedImage).value);

      default:
        const unhandledSourceType: never = loadedImage.sourceType; // Compile time check that all cases are handled
        throw new UiError(UiComponents.loggerCategory(this), `Can't handle sourceType: "${unhandledSourceType}"`);
    }
  }
}

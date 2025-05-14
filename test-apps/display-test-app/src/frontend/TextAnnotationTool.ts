import { IModelApp, Tool } from "@itwin/core-frontend";
import { dtaIpc } from "./App";
import { ColorDef, TextAnnotation, TextAnnotation2dProps, TextStyleSettingsProps } from "@itwin/core-common";
import { TextEditor } from "./TextDecoration";
import { assert } from "@itwin/core-bentley";
import { CreateTextAnnotationArgs } from "../common/DtaIpcInterface";

const editor = new TextEditor();

export class TextAnnotationTool extends Tool {
  public static override toolId = "TextAnnotationTool";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return undefined; }

  public override async parseAndRun(...inArgs: string[]): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp) {
      return false;
    }

    const cmd = inArgs[0].toLowerCase();
    const arg = inArgs[1];

    switch (cmd) {
      case "clear":
        editor.clear();
        return true;
      case "init":
        // Use the first category if the user doesn't specify one. This is just a convenience.
        const category = arg ?? vp.view.categorySelector.categories.values().next().value;
        if (undefined === category || category === "") {
          throw new Error("No category provided.");
        }

        editor.init(vp.iModel, category);
        break;
      case "center":
        editor.origin = vp.view.getCenter();
        break;
      case "rotation":
        editor.rotation = Number(arg);
        break;
      case "offset":
        if (inArgs.length !== 3) {
          throw new Error("Expected x and y");
        }

        editor.offset.x = Number(arg);
        editor.offset.y = Number(inArgs[2]);
        break;
      case "font":
        editor.runStyle.fontName = arg;
        break;
      case "text":
        editor.appendText(arg);
        break;
      case "fraction":
        if (inArgs.length !== 3) {
          throw new Error("Expected numerator and denominator");
        }

        editor.appendFraction(inArgs[1], inArgs[2]);
        break;
      case "break":
        editor.appendBreak();
        break;
      case "paragraph":
        editor.appendParagraph();
        break;
      case "color":
        editor.runStyle.color = ColorDef.fromString(arg).toJSON();
        break;
      case "height":
        editor.documentStyle.lineHeight = Number.parseFloat(arg);
        break;
      case "widthfactor":
        editor.documentStyle.widthFactor = Number.parseFloat(arg);
        break;
      case "width":
        editor.setDocumentWidth(Number.parseFloat(arg));
        break;
      case "justify": {
        const just = arg.toLowerCase();
        switch (just) {
          case "left":
          case "center":
          case "right":
            editor.justify(just);
            break;
          default:
            throw new Error("Expected left, right, or center");
        }
        break;
      }
      case "spacing":
        editor.documentStyle.lineSpacingFactor = Number.parseFloat(arg);
        break;
      case "bold":
        editor.runStyle.isBold = !editor.runStyle.isBold;
        break;
      case "italic":
        editor.runStyle.isItalic = !editor.runStyle.isItalic;
        break;
      case "underline":
        editor.runStyle.isUnderlined = !editor.runStyle.isUnderlined;
        break;
      case "fractionscale":
        editor.runStyle.stackedFractionScale = Number.parseFloat(arg);
        break;
      case "fractiontype": {
        const type = arg.toLowerCase();
        switch (type) {
          case "horizontal":
          case "diagonal":
            editor.runStyle.stackedFractionType = type;
            break;
          default:
            throw new Error("Expected horizontal or diagonal");
        }
        break;
      }
      case "shift": {
        const shift = arg.toLowerCase();
        switch (shift) {
          case "none":
          case "superscript":
          case "subscript":
            editor.baselineShift = shift;
            break;
          default:
            throw new Error("Expected none, superscript, or subscript");
        }
        break;
      }
      case "anchor": {
        const val = arg.toLowerCase();
        switch (val) {
          case "left":
          case "center":
          case "right":
            editor.anchor.horizontal = val;
            break;
          case "top":
          case "middle":
          case "bottom":
            editor.anchor.vertical = val;
            break;
          default:
            throw new Error("Expected top, middle, bottom, left, center, or right");
        }
        break;
      }
      case "margin": {
        const marginLocation = inArgs[1].toLowerCase();
        const val = Number(inArgs[2]);
        if (isNaN(val)) {
          throw new Error("Expected margin location followed by a number. Margin location can be left, right, top, bottom, all, horizontal, or vertical");
        }

        switch (marginLocation) {
          case "left":
          case "right":
          case "top":
          case "bottom":
            editor.setMargins({ [marginLocation]: val });
            break;
          case "all":
            editor.setMargins({ left: val, right: val, top: val, bottom: val });
            break;
          case "horizontal":
            editor.setMargins({ left: val, right: val });
            break;
          case "vertical":
            editor.setMargins({ top: val, bottom: val });
            break;
          default:
            throw new Error("Expected left, right, top, bottom, all, horizontal, or vertical");
        }
        break;
      }
      case "debug": {
        editor.debugAnchorPointAndRange = !editor.debugAnchorPointAndRange;
        break;
      }
      case "insertanno": {
        // Inserts a new text annotation into the iModel. The annotation is created with the current settings of the editor.
        // Usage: dta anno insertanno
        if (!editor.annotation) {
          throw new Error("No annotation to insert. Use the init command first.");
        }
        assert(vp.view.is2d() === true, "View is not 2d");
        const modelId = vp.view.baseModelId;
        const minViableArgs: CreateTextAnnotationArgs = {
          iModelKey: vp.iModel.key,
          annotationCreateArgs: {
            textAnnotationData: editor.annotation.toJSON(),
            placement: {
              origin: editor.origin.toJSON(),
              angle: 0,
            },
            category: editor.categoryId,
            model: modelId,
          }
        }
        const id = await dtaIpc.insertTextAnnotation2d(minViableArgs);
        // eslint-disable-next-line no-console
        console.log(id);
        break;
      }
      case "updateanno": {
        // Updates an existing text annotation in the iModel. The annotation is updated with the current settings of the editor.
        // Usage: dta anno updateanno <elementId>
        if (!editor.annotation) {
          throw new Error("No annotation to insert. Use the init command first.");
        }
        const elemId = arg;
        const updateArgs = {
          iModelKey: vp.iModel.key,
          annotationUpdateArgs: {
            textAnnotationData: editor.annotation.toJSON(),
            placement: {
              origin: editor.origin.toJSON(),
              angle: 0,
            },
          }
        }
        await dtaIpc.updateTextAnnotation2d(elemId, updateArgs);
        break;
      }
      case "delete": {
        await dtaIpc.deleteTextAnnotations({ iModelKey: vp.iModel.key });
        break;
      }
      case "insertstyle": {
        // Inserts a new text style into the iModel. The style is created with the current settings of the editor.
        // Usage: dta anno insertstyle <name>
        const name = arg ?? "Test Style";
        const styleProps: TextStyleSettingsProps = {...editor.documentStyle, ...editor.runStyle};
        const styleId = await dtaIpc.insertAnnotationTextStyle({
          iModelKey: vp.iModel.key,
          textStyleCreateArgs: {
            settings: styleProps,
            name,
            description: "Test Style",
          },
        });
        // eslint-disable-next-line no-console
        console.log("Style ID:", styleId);
        editor.clear();
        return true;
      }
      case "updatestyle": {
        // Updates an existing text style in the iModel. The style is updated with the current settings of the editor. Can optionally change the name.
        // Usage: dta anno updatestyle <styleId> <newName?>
        const styleId = arg;
        let newName;
        if (inArgs.length >= 3) {
          newName = inArgs[2];
        }
        const styleProps: TextStyleSettingsProps = {...editor.documentStyle, ...editor.runStyle};
        await dtaIpc.updateAnnotationTextStyle(styleId, {
          iModelKey: vp.iModel.key,
          textStyleUpdateArgs: {
            settings: styleProps,
            name: newName,
            description: "Test Style",
          }
        });
        break;
      }
      case "apply": {
        if (!editor.textBlock) {
          throw new Error("No annotation to insert. Use the init command first.");
        }
        editor.textBlock.applyStyle(arg, { preserveOverrides: false, preventPropagation: false });
        break;
      }
      case "applypersisted": {
        // Updates an existing text annotation in the iModel to use a new style.
        // Usage: dta anno applypersisted <textElemId> <styleId>
        const elemId = arg;
        let styleId;
        if (inArgs.length >= 3) {
          styleId = inArgs[2];
        }
        const propsArr = await vp.iModel.elements.getProps(elemId);
        if (propsArr.length !== 1) {
          throw new Error(`Element ${elemId} not found`);
        }
        const props = propsArr[0] as TextAnnotation2dProps;
        if (props.textAnnotationData === undefined) {
          throw new Error(`Element ${elemId} has no text annotation`);
        }
        const text = TextAnnotation.fromJSON(JSON.parse(props.textAnnotationData));
        if (styleId) {
          text.textBlock.applyStyle(styleId, { preserveOverrides: false, preventPropagation: false });
        }
        const updateArgs = {
          iModelKey: vp.iModel.key,
          annotationUpdateArgs: {
            textAnnotationData: text.toJSON(),
          }
        }
        await dtaIpc.updateTextAnnotation2d(elemId, updateArgs);
        break;
      }
      case "version": {
        await dtaIpc.schemaVersion({ iModelKey: vp.iModel.key });
        break;
      }
      default:
        throw new Error(`unrecognized command ${cmd}`);
    }

    await editor.update();
    return true;
  }

  public override async run(..._args: string[]): Promise<boolean> {
    throw new Error("handled in parseAndRun");
  }
}
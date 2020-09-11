
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import moreSvg from "@bentley/icons-generic/icons/more-circular.svg?sprite";
import moreVerticalSvg from "@bentley/icons-generic/icons/more-vertical-circular.svg?sprite";
import { IconSpecUtilities, RelativePosition } from "@bentley/ui-abstract";
import {
  BetaBadge, BlockText, BodyText, Button, ButtonSize, ButtonType, Checkbox, CheckListBox, CheckListBoxItem, CheckListBoxSeparator, ContextMenuItem,
  DisabledText, ExpandableBlock, ExpandableList, FeaturedTile, Headline, HorizontalTabs, Icon, IconInput, Input, InputStatus, LabeledInput,
  LabeledSelect, LabeledTextarea, LabeledToggle, LeadingText, Listbox, ListboxItem, LoadingPrompt, LoadingSpinner, LoadingStatus, MinimalFeaturedTile, MinimalTile, MutedText,
  NewBadge, NumericInput, ProgressBar, Radio, SearchBox, Select, Slider, SmallText, Spinner, SpinnerSize, SplitButton, Subheading, Textarea, ThemedSelect,
  Tile, Title, Toggle, ToggleButtonType, UnderlinedButton, VerticalTabs,
} from "@bentley/ui-core";
import { ColorByName, ColorDef } from "@bentley/imodeljs-common";
import { ColorPickerButton, ColorPickerDialog, ColorPickerPopup, ColorSwatch } from "@bentley/ui-components";
import { ModalDialogManager } from "@bentley/ui-framework";
import { ComponentExampleCategory, ComponentExampleProps } from "./ComponentExamples";
import { SampleContextMenu } from "./SampleContextMenu";
import { SampleExpandableBlock } from "./SampleExpandableBlock";
import { SampleImageCheckBox } from "./SampleImageCheckBox";
import { SampleAppIModelApp } from "../../..";
import { Logger } from "@bentley/bentleyjs-core";
import { SamplePopupContextMenu } from "./SamplePopupContextMenu";

/* eslint-disable no-console */

// eslint-disable-next-line @typescript-eslint/naming-convention
export function ColorPickerToggle() {
  const [colorDialogTitle] = React.useState("Select Color");
  const [selectedColor, setSelectedColor] = React.useState(ColorDef.red);
  const handleBackgroundColorDialogOk = React.useCallback((newColorDef: ColorDef) => {
    ModalDialogManager.closeDialog();
    setSelectedColor(newColorDef);
  }, []);

  const handleBackgroundColorDialogCancel = React.useCallback(() => {
    ModalDialogManager.closeDialog();
  }, []);

  const presetColors = React.useRef(
    [
      ColorDef.create(ColorByName.red),
      ColorDef.create(ColorByName.orange),
      ColorDef.create(ColorByName.yellow),
      ColorDef.create(ColorByName.green),
      ColorDef.create(ColorByName.blue),
      ColorDef.create(ColorByName.indigo),
      ColorDef.create(ColorByName.violet),
      ColorDef.create(ColorByName.black),
      ColorDef.create(ColorByName.white),
      ColorDef.create(ColorByName.cyan),
      ColorDef.create(ColorByName.fuchsia),
      ColorDef.create(ColorByName.tan),
      ColorDef.create(ColorByName.gray),
      ColorDef.create(ColorByName.brown),
      ColorDef.create(ColorByName.purple),
      ColorDef.create(ColorByName.olive),
    ]);

  const handleBgColorClick = React.useCallback((newColor: ColorDef, e: React.MouseEvent<Element, MouseEvent>) => {
    e.preventDefault();
    ModalDialogManager.openDialog(<ColorPickerDialog dialogTitle={colorDialogTitle} color={newColor} colorPresets={presetColors.current}
      onOkResult={handleBackgroundColorDialogOk} onCancelResult={handleBackgroundColorDialogCancel} />);
  }, [presetColors, handleBackgroundColorDialogOk, colorDialogTitle, handleBackgroundColorDialogCancel]);

  return (
    <ColorSwatch className="map-manager-base-item-color" colorDef={selectedColor} round={false} onColorPick={handleBgColorClick} />
  );
}

/** Creates a Component Example */
export const createComponentExample = (title: string, description: string | undefined, content: React.ReactNode): ComponentExampleProps => {
  return { title, description, content };
};

/** Provides Component Examples */
export class ComponentExamplesProvider {
  private static get badgeSamples(): ComponentExampleCategory {
    return {
      title: "Badge",
      examples: [
        createComponentExample("BetaBadge", undefined, <BetaBadge />),
        createComponentExample("NewBadge", undefined, <NewBadge />),
      ],
    };
  }

  private static get buttonSamples(): ComponentExampleCategory {
    return {
      title: "Button",
      examples: [
        createComponentExample("Basic Button", "Primary Button", <Button>Primary Button</Button>),
        createComponentExample("Disabled Button", "Button with disabled prop", <Button disabled>Disabled Button</Button>),
        createComponentExample("Blue Button", "Button with ButtonType.Blue", <Button buttonType={ButtonType.Blue}>Blue Button</Button>),
        createComponentExample("Hollow Button", "Button with ButtonType.Hollow", <Button buttonType={ButtonType.Hollow}>Hollow Button</Button>),
        createComponentExample("Large Basic Button", "Primary Button with size={ButtonSize.Large}", <Button size={ButtonSize.Large}>Primary Button</Button>),
        createComponentExample("Large Disabled Button", "Button with disabled and size={ButtonSize.Large} props", <Button disabled size={ButtonSize.Large}>Disabled Button</Button>),
        createComponentExample("Large Blue Button", "Button with ButtonType.Blue and size={ButtonSize.Large}", <Button buttonType={ButtonType.Blue} size={ButtonSize.Large}>Blue Button</Button>),
        createComponentExample("Large Hollow Button", "Button with ButtonType.Hollow and size={ButtonSize.Large}", <Button buttonType={ButtonType.Hollow} size={ButtonSize.Large}>Hollow Button</Button>),
        createComponentExample("Underlined Button", "UnderlinedButton component",
          <UnderlinedButton
            onActivate={() => Logger.logInfo(SampleAppIModelApp.loggerCategory(this), `UnderlinedButton activated`)}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              Logger.logInfo(SampleAppIModelApp.loggerCategory(this), `UnderlinedButton clicked`);
            }}>
            Underlined Button
          </UnderlinedButton>),
      ],
    };
  }

  private static get checkListBoxSamples(): ComponentExampleCategory {
    return {
      title: "CheckListBox",
      examples: [
        createComponentExample("CheckListBox", undefined,
          <CheckListBox>
            <CheckListBoxItem label="Item 1" />
            <CheckListBoxItem label="Item 2" />
            <CheckListBoxItem label="Item 3" />
          </CheckListBox>),
        createComponentExample("CheckListBox with separator", undefined,
          <CheckListBox>
            <CheckListBoxItem label="Item 1" />
            <CheckListBoxItem label="Item 2" />
            <CheckListBoxSeparator />
            <CheckListBoxItem label="Item 3" />
            <CheckListBoxItem label="Item 4" />
          </CheckListBox>),
      ],
    };
  }

  private static get colorSamples(): ComponentExampleCategory {
    const colorDef = ColorDef.blue;
    const handleColorPick = (color: ColorDef) => {
      console.log(`color picked: ${color.toRgbaString()}`);
    };

    return {
      title: "Color Controls",
      examples: [
        createComponentExample("Color Swatch", undefined,
          <ColorSwatch colorDef={colorDef} onColorPick={handleColorPick} />),
        createComponentExample("Color Picker Button", undefined,
          <ColorPickerButton initialColor={colorDef} onColorPick={handleColorPick} />),
        createComponentExample("Color Picker Dialog", undefined, <ColorPickerToggle />),
        createComponentExample("Color Picker Popup", undefined, <ColorPickerPopup initialColor={colorDef} />),
      ],
    };
  }

  private static get contextMenuSample(): ComponentExampleCategory {
    return {
      title: "ContextMenu",
      examples: [
        createComponentExample("ContextMenu", undefined, <UnderlinedButton onActivate={() => SampleContextMenu.showContextMenu()}> Open ContextMenu</UnderlinedButton>),
        createComponentExample("Popup with ContextMenu", undefined, <SamplePopupContextMenu />),
      ],
    };
  }

  private static get expandableListBlockSamples(): ComponentExampleCategory {
    return {
      title: "ExpandableList/Block",
      examples: [
        createComponentExample("ExpandableList", "ExpandableList with one ExpandableBlock",
          <ExpandableList className="uicore-full-width">
            <SampleExpandableBlock title="Test" isExpanded={true} onClick={() => { }}>
              Hello World!
            </SampleExpandableBlock>
          </ExpandableList>),
        createComponentExample("ExpandableList w/ singleExpandOnly", "ExpandableList with singleExpandOnly prop",
          <ExpandableList className="uicore-full-width" singleExpandOnly={true} defaultActiveBlock={0}>
            <ExpandableBlock title="Test1" isExpanded={false} onClick={() => { }}>
              Hello World 1
            </ExpandableBlock>
            <ExpandableBlock title="Test2" isExpanded={false} onClick={() => { }}>
              Hello World 2
            </ExpandableBlock>
            <ExpandableBlock title="Test3" isExpanded={false} onClick={() => { }}>
              Hello World 3
            </ExpandableBlock>
          </ExpandableList>),
        createComponentExample("ExpandableList w/ singleIsCollapsible", "ExpandableList with singleIsCollapsible prop",
          <ExpandableList className="uicore-full-width" singleExpandOnly={true} singleIsCollapsible={true} defaultActiveBlock={0}>
            <ExpandableBlock title="Test1" isExpanded={false} onClick={() => { }}>
              Hello World 1
            </ExpandableBlock>
            <ExpandableBlock title="Test2" isExpanded={false} onClick={() => { }}>
              Hello World 2
            </ExpandableBlock>
            <ExpandableBlock title="Test3" isExpanded={false} onClick={() => { }}>
              Hello World 3
            </ExpandableBlock>
          </ExpandableList>),
      ],
    };
  }

  private static get inputsSamples(): ComponentExampleCategory {
    return {
      title: "Inputs",
      examples: [
        createComponentExample("Basic Input", "Input with placeholder", <Input placeholder="Basic Input" />),
        createComponentExample("Disabled Input", "Input with disabled prop", <Input placeholder="Disabled Input" disabled />),

        createComponentExample("Check Box", "Basic Check Box", <Checkbox label="Basic Check Box" />),
        createComponentExample("Check Box Set", "Set of Check Boxes",
          <div>
            <Checkbox label="First" />
            <Checkbox label="Success" status={InputStatus.Success} />
            <Checkbox label="Warning" status={InputStatus.Warning} />
            <Checkbox label="Error" status={InputStatus.Error} />
          </div>),
        createComponentExample("Disabled Check Box", "Check Box with disabled prop", <Checkbox label="Disabled Check Box" disabled />),
        createComponentExample("Indeterminate Check Box", "Check Box with indeterminate prop", <Checkbox label="Indeterminate Check Box" indeterminate />),
        createComponentExample("Check Box with text after", "Check Box with <label> after", <div><Checkbox id="cb1" />&nbsp;&nbsp;<label htmlFor="cb1">This is text in a span</label></div>),

        createComponentExample("Radio Button", "Basic Radio Buttons",
          <div>
            <Radio label="Radio Button 1" name="demo1" value="option-1" />
            <Radio label="Radio Button 2" name="demo1" value="option-2" />
            <Radio label="Radio Button 3" name="demo1" value="option-3" />
          </div>),
        createComponentExample("Disabled Radio Button", "Radio Button with disabled prop", <Radio label="Disabled Radio Button" name="demo1" disabled />),

        createComponentExample("Basic Textarea", "Textarea with placeholder", <Textarea placeholder="Basic Textarea" />),
        createComponentExample("Disabled Textarea", "Textarea with disabled prop", <Textarea placeholder="Disabled Textarea" disabled />),

        createComponentExample("Numeric Input", "Numeric Input component", <NumericInput placeholder="Icon Input" min={1} max={100} className="uicore-full-width" />),
        createComponentExample("Icon Input", "Icon Input component", <IconInput placeholder="Icon Input" icon={<Icon iconSpec="icon-placeholder" />} containerClassName="uicore-full-width" />),
        createComponentExample("Labeled Input", "Labeled Input component", <LabeledInput label="Labeled Input" placeholder="Labeled Input" className="uicore-full-width" />),
        createComponentExample("Labeled Input", "Labeled Input Icon", <LabeledInput label="Labeled Input with icon" placeholder="Labeled Input with Icon" status={InputStatus.Success} />),
        createComponentExample("Labeled Textarea", "Labeled Textarea component", <LabeledTextarea label="Labeled Textarea" placeholder="Labeled Textarea" className="uicore-full-width" />),

        createComponentExample("Image Checkbox", "ImageCheckbox with WebFonts", <SampleImageCheckBox imageOn="icon-more-circular" imageOff="icon-more-vertical-circular" />),
        createComponentExample("Image Checkbox", "ImageCheckbox with SVG fonts", <SampleImageCheckBox imageOn={IconSpecUtilities.createSvgIconSpec(moreSvg)} imageOff={IconSpecUtilities.createSvgIconSpec(moreVerticalSvg)} />),

        createComponentExample("Input Described By", "Input with aria-describedby",
          <div>
            <label htmlFor="phone">Phone</label>
            <Input id="phone" name="phone" type="tel"
              pattern="^(\(?0[1-9]{1}\)?)?[0-9 -]*$"
              aria-describedby="phone-desc" />
            <p id="phone-desc">For example, (02) 1234 1234</p>
          </div>),
      ],
    };
  }

  private static get loadingSamples(): ComponentExampleCategory {
    return {
      title: "Loading",
      examples: [
        createComponentExample("Small Spinner", undefined, <Spinner size={SpinnerSize.Small} />),
        createComponentExample("Medium Spinner", undefined, <Spinner size={SpinnerSize.Medium} />),
        createComponentExample("Large Spinner", undefined, <Spinner size={SpinnerSize.Large} />),
        createComponentExample("XLarge Spinner", undefined, <Spinner size={SpinnerSize.XLarge} />),
        createComponentExample("Small LoadingSpinner", undefined, <LoadingSpinner size={SpinnerSize.Small} message="This is a Small LoadingSpinner" />),
        createComponentExample("Medium LoadingSpinner", undefined, <LoadingSpinner size={SpinnerSize.Medium} message="This is a Medium LoadingSpinner" />),
        createComponentExample("Large LoadingSpinner", undefined, <LoadingSpinner size={SpinnerSize.Large} message="This is a Large LoadingSpinner" />),
        createComponentExample("XLarge LoadingSpinner", undefined, <LoadingSpinner size={SpinnerSize.XLarge} message="This is a XLarge LoadingSpinner" />),
        createComponentExample("LoadingStatus", undefined, <LoadingStatus message="Loading status..." percent={50} />),
        createComponentExample("Basic LoadingPrompt", undefined, <LoadingPrompt title="Title" />),
        createComponentExample("LoadingPrompt with message", undefined, <LoadingPrompt title="Title" message="This is the message" />),
        createComponentExample("LoadingPrompt with Indeterminate Bar", undefined,
          <LoadingPrompt style={{ width: "100%" }} title="Title" message="This is the message" showIndeterminateBar />),
        createComponentExample("Determinate LoadingPrompt with percent", undefined,
          <LoadingPrompt title="Title" message="This is the message" isDeterminate={true} percent={50} />),
        createComponentExample("Determinate LoadingPrompt with cancel", undefined,
          <LoadingPrompt title="Title" message="This is the message" isDeterminate={true} percent={50} showCancel={true} />),
        createComponentExample("Determinate LoadingPrompt with status", undefined,
          <LoadingPrompt title="Title" message="This is the message" isDeterminate={true} showStatus={true} percent={50} status="Updating..." />),
      ],
    };
  }

  private static get progressIndicatorsSamples(): ComponentExampleCategory {
    return {
      title: "Progress Indicators",
      examples: [
        createComponentExample("ProgressBar", "at 50%", <ProgressBar percent={50} />),
        createComponentExample("ProgressBar with height", "height of 8", <ProgressBar percent={50} barHeight={8} />),
        createComponentExample("Indeterminate ProgressBar", "indeterminate prop", <ProgressBar indeterminate />),
        createComponentExample("ProgressBar with label", "labelLeft prop", <ProgressBar percent={25} labelLeft="Centered Label" />),
        createComponentExample("ProgressBar with labels", "labelLeft & labelRight props", <ProgressBar percent={75} labelLeft="Loading..." labelRight="75%" />),
      ],
    };
  }

  private static get searchBoxSample(): ComponentExampleCategory {
    return {
      title: "SearchBox",
      examples: [
        createComponentExample("SearchBox", undefined,
          // eslint-disable-next-line no-console
          <SearchBox placeholder="Search" onValueChanged={(value: string) => console.log(`Search text: ${value}`)} />),
      ],
    };
  }

  private static get selectSamples(): ComponentExampleCategory {
    enum ColorOptions {
      Red,
      White,
      Blue,
      Yellow,
      Orange,
    }

    const colorChoices = [
      { label: "Red", value: ColorOptions.Red },
      { label: "White", value: ColorOptions.White },
      { label: "Blue", value: ColorOptions.Blue },
      { label: "Yellow", value: ColorOptions.Yellow },
      { label: "Orange", value: ColorOptions.Orange },
    ];

    const cityChoices = [
      { label: "London", value: "London" },
      { label: "Paris", value: "Paris" },
      { label: "Stockholm", value: "Stockholm" },
      { label: "Berlin", value: "Berlin" },
      { label: "Mumbai", value: "Mumbai" },
      { label: "Christchurch", value: "Christchurch" },
      { label: "Johannesburg", value: "Johannesburg" },
      { label: "Beijing", value: "Beijing" },
      { label: "New York", value: "New York" },
    ];

    return {
      title: "Select",
      examples: [
        createComponentExample("Basic Select", "Basic Select component", <Select options={["Option 1", "Option 2", "Option 3", "Option 4"]} />),
        createComponentExample("Disabled Select", "Select with disabled prop", <Select options={["Option 1", "Option 2", "Option 3", "Option 4"]} disabled />),
        createComponentExample("Placeholder Select", "Select with placeholder prop", <Select options={["Option 1", "Option 2", "Option 3", "Option 4"]} placeholder="Pick an option" />),

        createComponentExample("Labeled Select", "Labeled Select component", <LabeledSelect label="Labeled Select" options={["Option 1", "Option 2", "Option 3", "Option 4"]} />),

        createComponentExample("ThemedSelect", "ThemedSelect component for colors",
          <div className="uicore-full-width">
            <ThemedSelect options={colorChoices} />
          </div>),
        createComponentExample("Multi ThemedSelect", "ThemedSelect component with isMulti",
          <div className="uicore-full-width">
            <ThemedSelect isMulti={true} isSearchable={true} options={cityChoices} />
          </div>),
        createComponentExample("Disabled ThemedSelect", "ThemedSelect component with isDisabled prop",
          <div className="uicore-full-width">
            <ThemedSelect options={colorChoices} isDisabled />
          </div>),
      ],
    };
  }

  private static get sliderSamples(): ComponentExampleCategory {
    return {
      title: "Slider",
      examples: [
        createComponentExample("Slider", "Basic Slider",
          <Slider min={0} max={100} values={[50]} step={1} showTooltip />),
        createComponentExample("Slider w/ tooltipBelow", "Slider with Tooltip Below",
          <Slider min={0} max={100} values={[50]} step={1} showTooltip tooltipBelow />),
        createComponentExample("Slider w/ min/max", "Slider with showMinMax prop",
          <Slider min={0} max={100} values={[50]} step={1} showTooltip showMinMax />),
        createComponentExample("Slider w/ min/max images", "Slider with minImage and maxImage props",
          <Slider min={0} max={100} values={[50]} step={1} showTooltip showMinMax
            minImage={<Icon iconSpec="icon-placeholder" />} maxImage={<Icon iconSpec="icon-placeholder" />} />),
        createComponentExample("Slider w/ tick marks", "Slider with showTicks and getTickCount props",
          <Slider min={0} max={100} values={[50]} step={1} showTooltip showMinMax
            showTicks getTickCount={() => 10} />),
        createComponentExample("Slider w/ multiple values", "Slider with array of values",
          <Slider min={0} max={100} values={[30, 70]} step={5} mode={2} showTooltip showMinMax
            showTicks getTickCount={() => 10} />),
        createComponentExample("Slider multiple values tooltipBelow", "Slider with multiple values & tooltip below",
          <Slider min={0} max={100} values={[20, 80]} step={5} mode={2} showTooltip tooltipBelow showMinMax
            showTicks getTickCount={() => 10} />),
        createComponentExample("Slider w/ tick labels", "Slider with showTickLabels prop",
          <Slider min={0} max={100} values={[50]} step={1} showTooltip showMinMax showTickLabels
            showTicks getTickCount={() => 10} />),
        createComponentExample("Disabled Slider", "Slider with disabled prop",
          <Slider min={0} max={100} values={[50]} step={1} showTooltip showMinMax showTickLabels disabled
            showTicks getTickCount={() => 10} />),
      ],
    };
  }

  private static get splitButtonSamples(): ComponentExampleCategory {
    return {
      title: "SplitButton",
      examples: [
        createComponentExample("Basic SplitButton", "Basic SplitButton",
          <SplitButton label="Split Button" onClick={() => { }}>
            {this.splitButtonMenuItems.map((node) => node)}
          </SplitButton>),
        createComponentExample("SplitButton with border", "SplitButton with drawBorder prop",
          <SplitButton label="Split Button" drawBorder icon="icon-placeholder" onClick={() => { }}>
            {this.splitButtonMenuItems.map((node) => node)}
          </SplitButton>),
        createComponentExample("SplitButton with width", "SplitButton with width style",
          <SplitButton label="Split Button" drawBorder icon="icon-placeholder" onClick={() => { }} style={{ width: "200px" }}>
            {this.splitButtonMenuItems.map((node) => node)}
          </SplitButton>),
        createComponentExample("SplitButton with popupPosition", "SplitButton with RelativePosition.BottomRight popupPosition prop",
          <SplitButton label="Split Button" drawBorder icon="icon-placeholder" onClick={() => { }} popupPosition={RelativePosition.BottomRight}>
            {this.splitButtonMenuItems.map((node) => node)}
          </SplitButton>),
        createComponentExample("SplitButton with Blue buttonType", "SplitButton with buttonType={ButtonType.Blue} prop",
          <SplitButton label="Split Button" drawBorder icon="icon-placeholder" onClick={() => { }} buttonType={ButtonType.Blue}>
            {this.splitButtonMenuItems.map((node) => node)}
          </SplitButton>),
        createComponentExample("SplitButton with Primary buttonType", "SplitButton with buttonType={ButtonType.Primary} prop",
          <SplitButton label="Split Button" drawBorder icon="icon-placeholder" onClick={() => { }} buttonType={ButtonType.Primary}>
            {this.splitButtonMenuItems.map((node) => node)}
          </SplitButton>),
      ],
    };
  }

  private static get splitButtonMenuItems(): React.ReactNode[] {
    return [
      <ContextMenuItem key="item1" icon="icon-placeholder">Item 1</ContextMenuItem>,
      <ContextMenuItem key="item2" icon="icon-placeholder">Item 2</ContextMenuItem>,
      <ContextMenuItem key="item3" icon="icon-placeholder">Item 3</ContextMenuItem>,
    ];
  }

  private static get tabsSamples(): ComponentExampleCategory {
    return {
      title: "Tabs",
      examples: [
        createComponentExample("Horizontal Tabs", undefined, <HorizontalTabs labels={["Tab 1", "Tab 2", "Tab 3"]} activeIndex={0} />),
        createComponentExample("Green Horizontal Tabs", "with green prop", <HorizontalTabs labels={["Tab 1", "Tab 2", "Tab 3"]} activeIndex={0} green />),
        createComponentExample("Vertical Tabs", undefined, <VerticalTabs labels={["Tab 1", "Tab 2", "Tab 3"]} activeIndex={0} />),
        createComponentExample("Green Vertical Tabs", "with green prop", <VerticalTabs labels={["Tab 1", "Tab 2", "Tab 3"]} activeIndex={0} green />),
      ],
    };
  }

  private static get textSamples(): ComponentExampleCategory {
    return {
      title: "Text",
      examples: [
        createComponentExample("BodyText", undefined, <BodyText>This is Body Text</BodyText>),
        createComponentExample("BlockText", undefined, <BlockText>This is Block Text</BlockText>),
        createComponentExample("DisabledText", undefined, <DisabledText>This is Disabled Text</DisabledText>),
        createComponentExample("Headline", undefined, <Headline>This is Headline Text</Headline>),
        createComponentExample("LeadingText", undefined, <LeadingText>This is Leading Text</LeadingText>),
        createComponentExample("MutedText", undefined, <MutedText>This is Muted Text</MutedText>),
        createComponentExample("SmallText", undefined, <SmallText>This is Small Text</SmallText>),
        createComponentExample("Subheading", undefined, <Subheading>This is Subheading Text</Subheading>),
        createComponentExample("Title", undefined, <Title>This is Title Text</Title>),
      ],
    };
  }

  private static get tileSamples(): ComponentExampleCategory {
    return {
      title: "Tiles",
      examples: [
        createComponentExample("Normal Tile", undefined,
          <Tile title="Normal Tile" icon="icon-placeholder">
            <a>Link 1</a>
            <a>Link 2</a>
          </Tile>),
        createComponentExample("Featured Tile", undefined,
          <FeaturedTile title="Featured Tile" icon="icon-placeholder">
            <a>Link 1</a>
            <a>Link 2</a>
          </FeaturedTile>),
        createComponentExample("Minimal Tile", undefined, <MinimalTile title="Minimal Tile" icon="icon-placeholder" />),
        createComponentExample("Featured Minimal Tile", undefined, <MinimalFeaturedTile title="Minimal Featured Tile" icon="icon-placeholder" />),
        createComponentExample("Tile stepNum={0}", undefined, <MinimalFeaturedTile stepNum={0} title="Tile stepNum={0}" icon="icon-placeholder" />),
        createComponentExample("Tile stepNum={6}", undefined, <MinimalFeaturedTile stepNum={6} title="Tile stepNum={6}" icon="icon-placeholder" />),
        createComponentExample("Tile stepNum={9}", undefined, <MinimalFeaturedTile stepNum={9} title="Tile stepNum={9}" icon="icon-placeholder" />),
        createComponentExample("Tile stepNum={15}", undefined, <MinimalFeaturedTile stepNum={15} title="Tile stepNum={15}" icon="icon-placeholder" />),
      ],
    };
  }

  private static get toggleSamples(): ComponentExampleCategory {
    return {
      title: "Toggle",
      examples: [
        createComponentExample("Basic Toggle", undefined, <Toggle isOn={true} />),
        createComponentExample("Primary Toggle", "Toggle with buttonType={ToggleButtonType.Primary}", <Toggle isOn={true} buttonType={ToggleButtonType.Primary} />),
        createComponentExample("Large Toggle", "Toggle with large={true}", <Toggle isOn={true} large={true} />),
        createComponentExample("Square Toggle", "Toggle with rounded={false}", <Toggle isOn={true} rounded={false} />),
        createComponentExample("Toggle with Checkmark", "Toggle with showCheckmark prop", <Toggle isOn={true} showCheckmark={true} />),
        createComponentExample("Disabled Toggle", "Toggle with disabled prop", <Toggle isOn={true} showCheckmark={true} disabled />),
        createComponentExample("LabeledToggle", undefined, <LabeledToggle isOn={true} label="Toggle label" />),
      ],
    };
  }

  private static get listboxSamples(): ComponentExampleCategory {
    const listItems = ["London", "Paris", "Stockholm", "Berlin", "Mumbai", "Christchurch", "Johannesburg", "Beijing", "New York"];

    return {
      title: "Listbox",
      examples: [
        createComponentExample("Basic Listbox", undefined,
          <Listbox id="map-sources" className="map-manager-source-list" selectedValue={listItems[1]}
            onKeyPress={(event: React.KeyboardEvent<HTMLUListElement>) => console.log(`item: ${event.currentTarget?.dataset?.value}`)} >
            {
              listItems?.map((cityName) =>
                <ListboxItem key={cityName} className="map-source-list-entry" value={cityName}>
                  <span className="map-source-list-entry-name" title={cityName}>{cityName}</span>
                </ListboxItem>)
            }
          </Listbox>),
        createComponentExample("Listbox with disabled entries", undefined,
          <Listbox id="map-sources" className="map-manager-source-list" selectedValue={listItems[1]}
            onKeyPress={(event: React.KeyboardEvent<HTMLUListElement>) => console.log(`item: ${event.currentTarget?.dataset?.value}`)} >
            {
              listItems?.map((cityName, index) =>
                <ListboxItem key={cityName} className="map-source-list-entry" value={cityName} disabled={0 === index % 2}>
                  <span className="map-source-list-entry-name" title={cityName}>{cityName}</span>
                </ListboxItem>)
            }
          </Listbox>),

      ],
    };
  }

  public static get categories(): ComponentExampleCategory[] {
    return [
      ComponentExamplesProvider.badgeSamples,
      ComponentExamplesProvider.buttonSamples,
      ComponentExamplesProvider.checkListBoxSamples,
      ComponentExamplesProvider.colorSamples,
      ComponentExamplesProvider.contextMenuSample,
      ComponentExamplesProvider.expandableListBlockSamples,
      ComponentExamplesProvider.inputsSamples,
      ComponentExamplesProvider.listboxSamples,
      ComponentExamplesProvider.loadingSamples,
      ComponentExamplesProvider.progressIndicatorsSamples,
      ComponentExamplesProvider.searchBoxSample,
      ComponentExamplesProvider.selectSamples,
      ComponentExamplesProvider.sliderSamples,
      ComponentExamplesProvider.splitButtonSamples,
      ComponentExamplesProvider.tabsSamples,
      ComponentExamplesProvider.textSamples,
      ComponentExamplesProvider.tileSamples,
      ComponentExamplesProvider.toggleSamples,
    ];
  }
}

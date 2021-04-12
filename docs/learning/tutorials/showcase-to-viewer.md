# Adding showcase widgets to your iTwin Viewer

### Prerequisites

This tutorial assumes that you already have:

- Explored the [sample showcase](https://www.itwinjs.org/sample-showcase).
- Your own local source for the iTwin Web Viewer based on the template @bentley/itwin-viewer
- Configured your local source to open the "House Model" sample iModel.
  - Instructions to use this sample iModel can be found [here](https://www.itwinjs.org/learning/tutorials/create-test-imodel-sample/).
- Understand the concept of a [UI Provider](https://www.itwinjs.org/learning/ui/abstract/uiitemsprovider) and adding [widgets](https://www.itwinjs.org/reference/ui-abstract/uiitemsprovider/uiitemsprovider/#providewidgets).
- Completed ["Customizing the iTwin Viewer"](./hello-world-viewer.md) tutorial.

### Goal

This tutorial will take widgets from the sample showcase and add them into your iTwin Viewer using the ```uiProvider``` prop.

### Understanding the Sample Showcase

We hope you have given the [sample showcase](https://www.itwinjs.org/sample-showcase) a tour and enjoyed the many samples we provide. You may want to use some of these samples in your own iTwin Viewer, and to do so you'll first need to understand how the showcase works.

If we take a closer look at the files involved in each sample, you'll notice they all follow the same pattern containing at a minimum 4 files:

1. ```[SampleName]App.tsx``` - Corresponds to ```App.tsx``` in the itwin viewer template and provides the main ```Viewer``` component.
2. ```[SampleName]Widget.tsx``` - Defines the ```UiItemsProvider``` that will be passed into prop ```uiProviders``` for our sample widget component. This widget is the controller for our samples.
3. ```[SampleName]Api.ts``` - Defines widget functionality that uses the itwin.js API being showcased.
4. ```[SampleName].scss``` - Defines the styles in our css classes used inside the widget.

Given this pattern, it's simple to identify the parts required to bring our sample showcase to your iTwin Viewer. The component revolves around the ```[SampleName]Widget.tsx``` file so we need to copy all the files associated with our custom widget's ```UiItemsProvider``` and pass it in the ```Viewer``` component.

### Example using a sample

For this tutorial, we'll be taking the widget from sample [View Attributes](https://www.itwinjs.org/sample-showcase/?group=Viewer&sample=view-attributes-sample&imodel=House+Sample) and adding it into our iTwin Viewer.

Starting with our entry file ```ViewAttributesApp.tsx```, the ```Viewer``` component is defined as follows:

``` HTML
        <Viewer
          contextId={sampleIModelInfo.contextId}
          iModelId={sampleIModelInfo.iModelId}
          authConfig={{ oidcClient: AuthorizationClient.oidcClient }}
          viewportOptions={viewportOptions}
          onIModelConnected={_oniModelReady}
          defaultUiConfig={default3DSandboxUi}
          theme="dark"
          uiProviders={uiProviders}
        />
```

Prop ```uiProviders``` is passed in an array that contains the ```ViewAttributesWidgetProvider```, imported and defined at the top of the file:

``` typescript
import { ViewAttributesWidgetProvider } from "./ViewAttributesWidget";
...
const uiProviders = [new ViewAttributesWidgetProvider()];
```

To sum it up, these three lines are the only lines you'll need to add in your iTwin Viewer in ```App.tsx```:

``` typescript
... // Import the widget provider
import { ViewAttributesWidgetProvider } from "./ViewAttributesWidget";
... // Construct the widget provider
const uiProviders = [new ViewAttributesWidgetProvider()];
... // Passed into the viewer component
      uiProviders={uiProviders}
```

We now have made all the necessary coding modifications to our iTwin Viewer. We'll just need to copy the remaining three files to bring our widget over.

- ```ViewAttributesApi.ts```
- ```ViewAttributesWidget.tsx```
- ```ViewAttributes.scss```

For this tutorial, these files will be placed directly in our src directory so your file structure should look similar to this:

![ViewAttributesStructure](./images/sample_viewer_port_to_itwin_viewer.png)

Running our iTwin Viewer now, you'll notice the exact same fully functional widget from the sample showcase in your iTwin Viewer.

![ViewAttributesResults](./images/view_attributes_ported_results.png)

Feel free to customize these widgets to your liking.

### Multiple ways to extend uiProvider

If you already have a ```uiProviders``` prop passed in or would like to add more widgets from the sample showcase, the  ```uiProviders``` prop takes in an array of providers. Extending the widget is as simple as appending to your array.

You can add to the uiProviders const variable, i.e.:

``` typescript
const uiProviders = [new ViewAttributesWidgetProvider(), new HyerModelingWidgetProvider(), ...]
```

or ignore the variable completely and pass the array in directly:

``` HTML
        <Viewer
          contextId={sampleIModelInfo.contextId}
          iModelId={sampleIModelInfo.iModelId}
          authConfig={{ oidcClient: AuthorizationClient.oidcClient }}
          viewportOptions={viewportOptions}
          onIModelConnected={_oniModelReady}
          defaultUiConfig={default3DSandboxUi}
          theme="dark"
          uiProviders={[new ViewAttributesWidgetProvider(), new HyperModelingWidgetProvider(), ...]}
        />
```

Just remember to copy corresponding files to your source.

If you'd like to use an existing UiItemsProvider instead of passing in multiple new ones, just add the widget in your ```provideWigets()``` function along with copying and pasting the react component to your desired location:

``` typescript
export class MyCustomUiProvider extends UiItemsProvider
{
  ... // Your custom code
  public provideWidgets(_stageId: string, _stageUsage: string, location: StagePanelLocation, _section?: StagePanelSection): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    if (location === StagePanelLocation.Right) {
      widgets.push(
        {
          id: "ViewAttributesWidget",
          label: "View Attributes Controls",
          defaultState: WidgetState.Floating,
          getWidgetContent: () => <ViewAttributesWidget />, // Don't forget to copy code for the ViewAttributesWidget
        }
      );
    }
}
```

As you can see, extending your iTwin Viewer with multiple widgets is simple.
It's completely up to you on how you want to structure your directories and components. Feel free to extend as many widgets as you like.

## Useful Links

- [UI Provider](https://www.itwinjs.org/reference/ui-abstract/uiitemsprovider/uiitemsprovider/)
- [View Attributes Sample](https://www.itwinjs.org/sample-showcase/?group=Viewer&sample=view-attributes-sample&imodel=House+Sample)

## Next Steps

- [Using the Sample Showcase](https://www.itwinjs.org/sample-showcase/)

# iTwin Viewer - "Hello World"

## Customizing the iTwin Viewer - "The Basics"

### Prerequisites

This tutorial assumes that you already have:

- Your own local source for the iTwin Web Viewer based on the template @bentley/itwin-viewer
- Configured your local source to open the "House Model" sample iModel.
  - Instructions to use this sample iModel can be found [here](https://www.itwinjs.org/learning/tutorials/create-test-imodel-sample/).

### Goal

This tutorial will take you through the first steps of customizing your iTwin Web Viewer.  First you will learn how to add a new user interface component.  Later you will customize that component to change the background color of your viewer.

### Hello World

The iTwin Web Viewer viewer template generates several files. To start with, let's take a look at the ```App.tsx``` file.  This is where you should start in customizing your iTwin Viewer.

To start with ```App.tsx``` contains a single react functional component fittingly called ```App```.  The ```App``` component is responsible for:

1. Authenticating the user
2. Rendering the ```Viewer``` component

At the bottom of ```App.tsx``` you can see the ```return``` statement where the ```Viewer``` component is configured.  Let's focus on that for the now:

``` typescript
  return (
    <div className="viewer-container">
      <Header
        handleLogin={onLoginClick}
        loggedIn={isAuthorized}
        handleLogout={onLogoutClick}
      />
      {isLoggingIn ? (
        <span>"Logging in...."</span>
      ) : (
        isAuthorized && (
          <Viewer
            contextId={process.env.IMJS_CONTEXT_ID ?? ""}
            iModelId={process.env.IMJS_IMODEL_ID ?? ""}
            authConfig={{ oidcClient: AuthorizationClient.oidcClient }}
          />
        )
      )}
    </div>
  );
```

```App``` is just a react component. Like any react component, it returns JSX to tell react how to create HTML for the browser to render.  Let's start off by adding some custom code to our JSX.  We can render a "Hello World" ```span```  above the viewer by simply creating the element above the component. Note that this needs to be surrounded in a ```div```  per the single parent rule for react:

``` HTML
    <div style={{height: "100%"}}>
      <span>"Hello World"</span>
      <Viewer
        contextId={process.env.IMJS_CONTEXT_ID ?? ""}
        iModelId={process.env.IMJS_IMODEL_ID ?? ""}
        authConfig={{ oidcClient: AuthorizationClient.oidcClient }}
      />
    </div>
```

Result:

![HelloWorldAbove](./images/hello_world_above.png)

### Your first UI Widget

We're not influencing any elements inside the viewer yet. We've just added a ``` span ```  above the viewer. To add our "Hello World" ``` span ``` into the viewer, we need to pass ``` uiProvider ``` as a prop to the ``` Viewer ```  component to let it register our "Hello World" element.

``` HTML
      <Viewer
        contextId={process.env.IMJS_CONTEXT_ID ?? ""}
        iModelId={process.env.IMJS_IMODEL_ID ?? ""}
        authConfig={{ oidcClient: AuthorizationClient.oidcClient }}
        uiProvider={[new HelloWorldUiProvider()]}
      />
  );
```

A [UI Provider](https://www.itwinjs.org/reference/ui-abstract/uiitemsprovider/uiitemsprovider/) is an interface we can implement that extends the ```Viewer``` with custom UI components. To add a component that contains our "Hello World" span, we need to define our ```HelloWorldUiProvider``` class and implement the ```UiItemsProvider``` interface.

Create a new file called ```HelloWorldUiProvider.tsx``` with the following contents:

``` typescript
import { AbstractWidgetProps, StagePanelLocation, StagePanelSection, UiItemsProvider } from "@bentley/ui-abstract";

import * as React from "react";

export class HelloWorldUiProvider implements UiItemsProvider {
  public readonly id = "HelloWorldProvider";

  public provideWidgets(stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection) : ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];

    if (location === StagePanelLocation.Right) {
      const helloWidget: AbstractWidgetProps = {
        id: "HelloWidget",
        label: "Hello",
        getWidgetContent() {
          return <span>"Hello World"</span>;
        }
      }

      widgets.push(helloWidget);
    }

    return widgets;
  }
}
```

The only function defined in the provider is ``` provideWidgets ``` that returns a single widget containing span "Hello World" at ``` StagePanelLocation.Right ```. All providers require ``` public readonly id ``` to distinguish between different providers.

Three attributes are passed into the ```helloWidget```:

1. ``` id ``` - used to uniquely identify the widget
2. ``` label ``` - description label for our widget
3. ``` getWidgetContent() ``` - our custom UI component

The component is sufficient for our "Hello World" widget for now. We need to import ```HelloWorldUiProvider``` at the top of file ```App.tsx```:

``` Typescript
import { HelloWorldUiProvider } from "./HelloWorldUiProvider";
```

We'll also remove our old ```span``` and ```div```, so our final code for the ``` return ``` function in ```App.tsx``` should look similar to:

``` typescript
  return (
    <div className="viewer-container">
      <Header
        handleLogin={onLoginClick}
        loggedIn={isAuthorized}
        handleLogout={onLogoutClick}
      />
      {isLoggingIn ? (
        <span>"Logging in...."</span>
      ) : (
        isAuthorized && (
          <Viewer
            contextId={process.env.IMJS_CONTEXT_ID ?? ""}
            iModelId={process.env.IMJS_IMODEL_ID ?? ""}
            authConfig={{ oidcClient: AuthorizationClient.oidcClient }}
            uiProviders={[new HelloWorldUiProvider()]}
          />
        )
      )}
    </div>
  );
```

Result:

![HelloWorldWidget](./images/hello_world_widget.png)

### Improving your widget

Instead of a "Hello World" ```span``` in our ```getWidgetContent()```, we can return react components in our widget to improve functionality. We will use component [Toggle](https://www.itwinjs.org/reference/ui-core/toggle/toggle/) in place of our "Hello World" ```span``` to toggle the background color:

``` typescript
    if (location === StagePanelLocation.Right) {
      const notificationsWidget: AbstractWidgetProps = {
        id: "BackgroundColorWidget",
        label: "Background Color Toggle",
        getWidgetContent() {
          return <Toggle></Toggle>
        }
      }

      widgets.push(notificationsWidget);
    }
```

Result:

![Background Color Toggle](./images/background_color_toggle.png)

### Changing the background color

```Toggle``` has prop ```onChange``` where we can catch the "on" and "off" state. If the toggle is on, we'll override the background color to "skyblue". If we toggle it again to off, we'll change the background color to "pink":

``` typescript
          return <Toggle onChange={(toggle) => {
            if (toggle) {
              IModelApp.viewManager.selectedView!.overrideDisplayStyle({backgroundColor: ColorDef.computeTbgrFromString("skyblue")})
            } else {
              IModelApp.viewManager.selectedView!.overrideDisplayStyle({backgroundColor: ColorDef.computeTbgrFromString("pink")})
            }
          }}></Toggle>
```

We can get change the background color using function [overrideDisplayStyle()](https://www.itwinjs.org/reference/imodeljs-frontend/views/viewport/overridedisplaystyle/) through global singleton [IModelApp](https://www.itwinjs.org/reference/imodeljs-frontend/imodelapp/imodelapp/) in property [viewManager](https://www.itwinjs.org/reference/imodeljs-frontend/views/viewmanager/).


Our completed ```HelloWorldUiProvider.tsx``` file should look similar to this:

``` typescript
import { ColorDef } from "@bentley/imodeljs-common";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { AbstractWidgetProps, StagePanelLocation, StagePanelSection, UiItemsProvider } from "@bentley/ui-abstract";
import { Toggle } from "@bentley/ui-core";

import * as React from "react";

export class HelloWorldUiProvider implements UiItemsProvider {
  public readonly id = "HelloWorldProvider";

  public provideWidgets(stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection) : ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];

    if (location === StagePanelLocation.Right) {
      const backgroundColorWidget: AbstractWidgetProps = {
        id: "BackgroundColorWidget",
        label: "Background Color Toggle",
        getWidgetContent() {
          return <Toggle onChange={(toggle) => {
            if (toggle) {
              IModelApp.viewManager.selectedView!.overrideDisplayStyle({backgroundColor: ColorDef.computeTbgrFromString("skyblue")})
            } else {
              IModelApp.viewManager.selectedView!.overrideDisplayStyle({backgroundColor: ColorDef.computeTbgrFromString("pink")})
            }
          }}></Toggle>
        }
      }

      widgets.push(backgroundColorWidget);
    }

    return widgets;
  }
}
```

Result when the button is toggled:

![Background blue](./images/background_toggled_blue.png)

Result when the button is toggled:

![Background pink](./images/background_toggled_pink.png)

This is one of infinitely many possible widgets we can create in the iTwin Viewer. Feel free to explore sample widgets on our [sample showcase](https://www.itwinjs.org/sample-showcase/).

In the next tutorial, we will take widgets from the sample showcase and use them in our iTwin Viewer.

## Useful Links

- [UI Provider](https://www.itwinjs.org/reference/ui-abstract/uiitemsprovider/uiitemsprovider/)
- [iTwin Sample Showcase](https://www.itwinjs.org/sample-showcase/)

## Next Steps

- [Using the Sample Showcase](https://www.itwinjs.org/sample-showcase/)

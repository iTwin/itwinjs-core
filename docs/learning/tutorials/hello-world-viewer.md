# iTwin Viewer - "Hello World"

## Understanding the basics

Once your iTwin Viewer has been initialized and hooked up to your iModel, several files get generated but the only file that you'll need to take a look at to start customizing your iTwin Viewer is "```App.tsx```".

```App.tsx``` is responsible for two things when it first gets created:

1. Authentication
2. Render ``` Viewer ```  Component

The ``` Viewer ``` component is where you'll be adding most of your modifications in to start building your application - and this is contained in the ``` return ```  function at the bottom of the file ```App.tsx```:

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

You'll notice that ``` App ```  is just a react component. Like any react component, you can start adding your own HTML elements in the ``` render ```  function.
You can render a "Hello World" ``` span ```  above the viewer by simply creating the element above the component - Note that this needs to be surrounded in a ``` div ```  per the single parent rule for react:

``` HTML
    <div style={{height: "100%"}}>
      <span>"Hello World!"</span>
      <Viewer
        contextId={process.env.IMJS_CONTEXT_ID ?? ""}
        iModelId={process.env.IMJS_IMODEL_ID ?? ""}
        authConfig={{ oidcClient: AuthorizationClient.oidcClient }}
      />
    </div>
```

Result:

![HelloWorldAbove](./images/hello_world_above.png)

You'll notice that we're not influencing any elements inside the viewer - we've just added a ``` span ```  above the viewer. In order to add our "Hello World" ``` span ``` into the viewer, we need to pass ``` uiProvider ``` as a prop to the ``` Viewer ```  component to let it register our "Hello World" element.

``` HTML
      <Viewer
        contextId={process.env.IMJS_CONTEXT_ID ?? ""}
        iModelId={process.env.IMJS_IMODEL_ID ?? ""}
        authConfig={{ oidcClient: AuthorizationClient.oidcClient }}
        uiProvider={[new HelloWorldUiProvider()]}
      />
  );
```

A [UI Provider](https://www.itwinjs.org/reference/ui-framework/uiprovider/?term=uiprovider) is an interface you can implement that will extend the ```Viewer``` with your custom UI components. We're going to add a widget on the right side of our viewer to contain our "Hello World" string. To do this, we need to define our ```HelloWorldUiProvider``` class and implement the ```UiItemsProvider``` interface.

Create a new file called "```HelloWorldUiProvider.tsx```" with the following contents:

``` typescript
import { AbstractWidgetProps, StagePanelLocation, StagePanelSection, UiItemsProvider } from "@bentley/ui-abstract";

export class HelloWorldUiProvider implements UiItemsProvider {
  public readonly id = "HelloWorldProvider";

  public provideWidgets(stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection) : ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];

    if (location === StagePanelLocation.Right) {
      const helloWidget: AbstractWidgetProps = {
        id: "HelloWidget",
        label: "Hello",
        getWidgetContent() {
          return "Hello World";
        }
      }

      widgets.push(helloWidget);
    }

    return widgets;
  }
}
```

The only function we define in the provider is ``` provideWidgets ```, and we return a single widget that returns "Hello World" at ``` StagePanelLocation.Right ```. All providers require ``` public readonly id ``` to distinguish between different providers.

We pass three attributes into the ```helloWidget```:
1. ``` id ``` - used to uniquely identify the widget
2. ``` label ``` - description label for our widget
3. ``` getWidgetContent() ``` - our custom UI component

This is sufficient for our "Hello World" Widget for now. Don't forget to add:

```import { HelloWorldUiProvider } from "./HelloWorldUiProvider";```

To the top of App.tsx. We'll also remove our old ```span``` and ```div```, so our final code for our ``` return ``` function in ```App.tsx``` should look like:


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


## Useful Links

- [Create React App](https://create-react-app.dev/)
- [iTwin Viewer React](https://www.npmjs.com/package/@bentley/itwin-viewer-react)
- [iTwin Viewer Create React App Template](https://www.npmjs.com/package/@bentley/cra-template-itwin-viewer)
- [Bentley React Scripts](https://www.npmjs.com/package/@bentley/react-scripts)

## Next Steps

- [Visit the iTwin Sample Showcase](https://www.itwinjs.org/sample-showcase/)


---
publish: false
---
# NextVersion

## New Settings UI Features

The @bentley/ui-core package has added the [SettingsManager]($ui-core) class that allows any number of [SettingsProvider]($ui-core) classes to be registered. These providers provide [SettingsTabEntry]($ui-core) definitions used to populate the [SettingsContainer]($ui-core) UI component with setting pages used to manage application settings. These new classes are marked as beta in this release and are subject to minor modifications in future releases.

## Breaking Api Changes

### @bentley/ui-abstract package

Property `onClick` in [LinkElementsInfo]($ui-abstract) was changed to be mandatory. Also, the first [PropertyRecord]($ui-abstract) argument was removed from the method. Suggested ways to resolve:

- If you have a function `myFunction(record: PropertyRecord, text: string)` and use the first argument, the issue can be resolved with a lambda:

  ```ts
  record.links = {
    onClick: (text) => myFunction(record, text),
  };
  ```

- If you were omitting the `onClick` method to get the default behavior, it can still be achieved by not setting `PropertyRecord.links` at all. It's only valid to expect default click behavior when default matcher is used, but if a custom matcher is used, then the click handled can be as simple as this:

  ```ts
  record.links = {
    onClick: (text) => { window.open(text, "_blank"); },
  };
  ```

### @bentley/imodeljs-frontend package

#### Initializing TileAdmin

The previously-`alpha` [IModelAppOptions.tileAdmin]($frontend) property has been promoted to `beta` and its type has changed from [TileAdmin]($frontend) to [TileAdmin.Props]($frontend). [TileAdmin.create]($frontend) has become `async`. Replace code like the following:

```ts
  IModelApp.startup({ tileAdmin: TileAdmin.create(props) });
```

with:

```ts
  IModelApp.startup({ tileAdmin: props });
```

#### Tile request channels

[Tile]($frontend)s are now required to report the [TileRequestChannel]($frontend) via which requests for their content should be executed, by implementing the new abstract [Tile.channel]($frontend) property. The channel needs to specify a name and a concurrency. The name must be unique among all registered channels, so choose something unlikely to conflict. The concurrency specifies the maximum number of requests that can be simultaneously active on the channel. For example, when using HTTP 1.1 modern browsers allow no more than 6 simultaneous connections to a given hostname, so 6 is a good concurrency for HTTP 1.1-based channels and the hostname is a decent choice for the channel's name.

Typically all tiles in the same [TileTree]($frontend) use the same channel. Your implementation of `Tile.channel` will depend on the mechanism by which the content is obtained. If it uses HTTP, it's easy:

```ts
  public get channel() { return IModelApp.tileAdmin.getForHttp("my-unique-channel-name"); }
```

If your tile never requests content, you can implement like so:

```ts
  public get channel() { throw new Error("This tile never has content so this property should never be invoked"); }
```

If your tile uses the `alpha` `TileAdmin.requestElementGraphics` API, use the dedicated channel for such requests:

```ts
  public get channel() { return IModelApp.tileAdmin.channels.elementGraphicsRpc; }
```

Otherwise, you must register a channel ahead of time. Choose an appropriate concurrency:

- If the tile requests content from some custom [RpcInterface]($common), use `IModelApp.tileAdmin.channels.rpcConcurrency`.
- Otherwise, choose a reasonably small limit to prevent too much work from being done at one time. Remember that tile requests are frequently canceled shortly after they are enqueued as the user navigates the view. A concurrency somewhere around 6-10 is probably reasonable.

To register a channel at startup:

```ts
  await IModelApp.startup();
  const channel = new TileRequestChannel("my-unique-channel-name", IModelApp.tileAdmin.rpcConcurrency);
  IModelApp.tileAdmin.channels.add(channel);
```

If you store `channel` from the above snippet in a global variable, you can implement your `channel` property to return it directly; otherwise you must look it up:

```ts
  public get channel() {
    const channel = IModelApp.tileAdmin.channels.get("my-unique-channel-name");
    assert(undefined !== channel);
    return channel;
  }
```

### Authentication changes for Electron and Mobile apps

For desktop and mobile applications, all authentication happens on the backend. The frontend process merely initiates the login process and waits for notification that it succeeds. Previously the steps required to set up the process were somewhat complicated.

Now, to configure your electron or mobile application for authorization, pass the `authConfig` option to `ElectronApp.startup` or `IOSApp.startup` to specify your authorization configuration.

Then, if you want a method that can be awaited for the user to sign in, use something like:

```ts
// returns `true` after successful login.
async function signIn(): Promise<boolean> {
  const auth = IModelApp.authorizationClient!;
  if (auth.isAuthorized)
    return true; // make sure not already signed in

  return new Promise<boolean>((resolve, reject) => {
    auth.onUserStateChanged.addOnce((token?: AccessToken) => resolve(token !== undefined)); // resolve Promise with `onUserStateChanged` event
    auth.signIn().catch((err) => reject(err)); // initiate the sign in process (forwarded to the backend)
  });
}
```

# Localization in iTwin.js

Presenting information to the user in their preferred locale (language, date and time formatting, number formatting, etc.) is an important consideration for every computer program. iTwin.js provides localization capabilities through the [IModelApp.localization]($frontend) object.

## Language translation

String localization is handled in a conventional way. Rather than specifying strings directly, a "key" is passed to the [Localization.getLocalizedString]($common) method, which retrieves the corresponding string for the current locale for presentation to the user.

For that to work, the localization system needs a dictionary of key-to-string substitutions for each expected locale. That dictionary is spread over a number of JSON files that are placed into a locale-specific directory in the application's "public" folder on the server. The key consists of a namespace (which identifies the specific JSON file in the locale directory, and thus must be unique across all packages in use), followed by a colon, followed by a period delimited tag that identifies the object within the JSON file.

For example, suppose you are developing an application called SafetyBase and you want to group information, warning, and error messages into a localization namespace. You might name the JSON file SafetyBaseMessages.json. For the English locale, place SafetyBaseMessages.json into the public/locales/en directory. For another locale, say German, put a different SafetyBaseMessages.json file in the public/locales/de directory. For this example, say that the files look like this:

`public/locales/en/SafetyBaseMessages.json`

```json
{
  "info": {
    "login": {
      "notLoggedIn": "You are not currently logged in.",
      "loggedIn": "You are logged in as {{username}}."
    }
  },
  "warning": {
    "login": {
      "mustLogin": "That feature is unavailable unless you log in.",
      "notAuthorized": "You are not authorized to access that resource."
    }
  },
  "error": {
    "loginIncorrect": "The username / password combination is not valid.",
    "offline": "Network connection not available."
  }
}
```

`public/locales/de/SafetyBaseMessages.json`

```json
{
  "info": {
    "login": {
      "notLoggedIn": "Sie sind derzeit nicht eingeloggt.",
      "loggedIn": "Sie sind angemeldet als {{username}}."
    }
  },
  "warning": {
    "login": {
      "mustLogin": "Diese Funktion ist nur verfügbar, wenn Sie sich anmelden.",
      "notAuthorized": "Sie sind nicht berechtigt, auf diese Ressource zuzugreifen."
    }
  },
  "error": {
    "loginIncorrect": "Die Kombination aus Benutzername und Passwort ist ungültig.",
    "offline": "NNetzwerkverbindung nicht verfügbar."
  }
}
```

Note: German was translated from English in Google Translate.

By default, the IModelApp uses an instance of [ITwinLocalization]($i18n) for localization purposes. Below, a user-created instance of this class will be passed in to IModelApp to demonstrate how a custom [Localization]($common) implementation could be used instead.

```ts
import { IModelApp } from "@itwin/core-frontend";

// The Localization interface class
import { Localization } from "@itwin/core-common";

// The iTwin.js implementation for Localization.
// *This can be replaced with your own implementation if you want!
import { ITwinLocalization } from "@itwin/core-i18n";

const myCustomLocalization: Localization = new ITwinLocalization();

await IModelApp.startup({ localization: myCustomLocalization });

```

To utilize the localization dictionaries, first initialize the localization instance to register any namespaces. [Localization.initialize]($common) takes in a list of namespaces to register. [Localization.registerNamespace]($common) takes only a single namespace string at a time.

```ts
const namespaces: string[] = ["SafetyBaseMessages"];
await IModelApp.localization.initialize(namespaces);

// How to register an additional, new namespace after initialization:
await IModelApp.localization.registerNamespace("AnotherNamespace");
```

Registering a namespace starts the process of retrieving the relevant namespace JSON file(s) corresponding to the set language/locale. This action returns a Promise which will be fulfilled when the file(s) is retrieved and ready to be accessed by the Localization instance, thus it is required to `await` for this process to finish. In the example above, the [Localization.initialize]($common) call is retrieving the `public/locale/en/SafetyBaseMessages.json` file and the [Localization.registerNamespace]($common) call will attempt to find a `public/locale/en/AnotherNamespace.json` file.

Now, a locale-specific string can be requested with the [Localization.getLocalizedString]($common) method. To specify the value to grab from the localization dictionary, specify its key in the following format: The namespace, followed by a colon, followed by a period-delimited tag that identifies the object within the JSON file. For example, "SafetyBaseMessages:info.login.loggedIn" is the key for the info.login.loggedIn value in the SafetyBaseMessages namespace.

```ts
const myUsername = "John_Smith_123"

IModelApp.localization.getLocalizedString("SafetyBaseMessages:info.login.notLoggedIn");
// returns "You are not currently logged in."
IModelApp.localization.getLocalizedString("SafetyBaseMessages:info.login.loggedIn", { username: myUsername});
// returns "You are logged in as John_Smith_123."
```

Notice how in the second statement, "{{username}}" from SafetyBaseMessages:info.login.loggedIn's value was replaced with "John_Smith_123". The [Localization.getLocalizedString]($common) method accepts an optional key-value dictionary argument. The method will then substitute the values in this dictionary with corresponding keys in the localized string as long as they are surrounded by {{ }}. This substitution is called "interpolation" in internationalization terminology.

Specific to the [ITwinLocalization]($i18n) class, the browser is used to detect the language if none is set. However, if that fails, the language will be set to English. Additionally, the selected language can be manually changed by calling the [Localization.changeLanguage]($common) interface method. Changing the language requires reacquiring the relevant namespace JSON files, so use `await` to wait for the returned Promise to resolve.

```ts
await IModelApp.localization.changeLanguage("de");

IModelApp.localization.getLocalizedString("SafetyBaseMessages:info.login.notLoggedIn");
// returns "Sie sind derzeit nicht eingeloggt."
IModelApp.localization.getLocalizedString("SafetyBaseMessages:info.login.loggedIn", { username: myUsername});
// returns "Sie sind angemeldet als John_Smith_123."
```

To interpolate a value in a custom string (i.e., a string not from a localization JSON file), use the `Localization.getLocalizedKeys` method with keys in the format `%{key}`:

```ts
await IModelApp.localization.changeLanguage("en");

IModelApp.localization.getLocalizedKeys("Please be aware: %{SafetyBaseMessages:error.offline}");
// returns "Please be aware: Network connection not available."

IModelApp.localization.getLocalizedKeys("Hello, %{SafetyBaseMessages:info.login.loggedIn}.");
// returns "Hello, You are logged in as {{username}}."
```

### Powered by i18next

Behind the scenes, iTwin.js uses the [i18next](http://www.i18next.com) JavaScript package. It has many other sophisticated internationalization capabilities, including formatting, plurals, and nesting, as well as the interpolation example given above.

As mentioned above, [IModelApp.localization]($frontend) uses an instance of the [ITwinLocalization]($i18n) class by default, which initializes i18next with a set of options that are usually fine for all applications. If you want different options, you could instantiate your own instance of [ITwinLocalization]($i18n) and pass in your own [ITwinLocalizationOptions]($i18n) to [ITwinLocalization.constructor]($i18n). Alternatively, you could create your own implementation of the iTwin.js [Localization]($common) interface or even import and use the i18next package directly.

### A Note About HTML in Localized Strings

If you are using React for user interface development, please note that you should not put HTML markup in your localized strings for inclusion as text in your React controls. Such strings are not processed by the React transpiler, and thus the HTML tags will display verbatim rather than being processed as HTML.

## Tool Localization

The primary way of initiating actions in iTwin.js applications is by authoring a subclass of the [Tool](./Tools) class. Each such Tool subclass is registered with the system by calling the register method on its class object. The register method takes an optional *namespace* argument that specifies the namespace that contains the localization strings for the tool, including its keyin, flyover, and description properties. The Tool's keyin property is used by the command parser to allow the user to type in the tool name to execute it. The flyover property is displayed when the cursor hovers over the Tool icon, and the description property is displayed in various contexts.

The keys for each of those properties are synthesized from the Tool's namespace and toolId. For example, the translation key for the keyin property is \<Namespace\>:tools.\<toolId\>.keyin. Now suppose you author a PlaceSprinkler command in the SafetyBase application. Your Tool class might look like this:

```ts
class PlaceSprinkler extends InteractiveTool {
  public static toolId = "Place.Sprinkler";
  ...
}

const toyToolsNamespace = "SafetyBaseTools";
IModelApp.localization.registerNamespace([toyToolsNamespace]);

// Register the PlaceSprinkler class
PlaceSprinkler.register(toyToolsNamespace);
```

Then the appropriate entry in the English version of SafetyBaseTools.json file might look like this:

`public/locales/en/SafetyBaseTools.json`

```json
{
  "tools": {
    "Place": {
      "Sprinkler": {
        "keyin": "Place Sprinkler",
        "flyover": "Place Sprinkler Component.",
        "description": "Puts a new Sprinkler Component in the SafetyBase System.",
        "prompt1": "Enter Sprinkler origin.",
        "prompt2": "Rotate Sprinkler to desired position.",
        "successStatus": "Sprinkler successfully placed."
      }
    }
  }
}
```

If you omit the "flyover" key, the keyin property is used for the flyover text. Similarly, if "description" key is not found, the fallback is the value of the flyover property.

In this example, the prompt1 and prompt2 keys are not used by the system - they could be used by your application during the operation of the Place Sprinkler command. They would be retrieved using this code:

```ts
const firstPrompt: string = IModelApp.localization.getLocalizedString("SafetyBaseTools:Place.Sprinkler.prompt1");
// returns "Enter Sprinkler origin."
```

Since your code retrieves those localized strings, they do not have to be subkeys of "tools.Place.Sprinkler". They could be separate keys in the same JSON file, or could even be in a different JSON file (in which case the namespace would be different). The convention demonstrated in the example above has the advantage of keeping the localizable strings associated with a particular tool all together, but the disadvantage that prompts or messages that might be usable for multiple tools would be duplicated in each tool.

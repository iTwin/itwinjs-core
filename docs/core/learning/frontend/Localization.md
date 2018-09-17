# Localization in iModelJs

Presenting information to the user in their preferred locale (language, date and time formatting, number formatting, etc.) is an important consideration for every computer program. iModelJs provides localization capabilities through the [IModelApp.i18n]($frontend) object.

## Language translation

String localization is handled in a straightforward way. Rather than specifying strings directly, a "key" is passed to the IModelApp.i18n.translate method, which retrieves the corresponding string for the current locale for presentation to the user.

Of course, that doesn't happen by magic. The localization system needs a dictionary of key-to-string substitutions for each expected locale. That dictionary is spread over a number of JSON files that are placed into a locale-specific directory in the applications "public" folder on the server. The key consists of a namespace (which identifies the specific JSON file in the locale directory, and thus must be unique across all packages in use), followed by a semicolon, followed by a period delimited tag that identifies the object within the JSON file.

For example, suppose you are developing an application called SafetyBase and you want to group information, warning, and error messages into a localization namespace. Name the JSON file SafetyBaseMessages.json, put it into the public/locales/en directory, and put the following JSON in it:

 ```json
 {
   "info": {
     "login": {
       "notLoggedIn": "You are not currently logged in to Bentley Connect.",
       "loggedIn": "You are logged in to Bentley Connect as {{userName}}."
     }
   },
   "warning": {
     "login": {
       "mustLogin": "That feature is unavailable unless you log in to Bentley Connect.",
       "notAuthorized": "You are not authorized to access that resource."
     }
   },
   "error": {
     "loginIncorrect": "The username / password combination is not valid.",
     "offline": "Network connection not available."
   }
 }
 ```

The messages can now be accessed by first registering the namespace, and then using the translate method:

```ts
messageNS: I18NNamespace = IModelApp.registerNamespace ("SafetyBaseMessages");
await messageNS.readFinished;
if (this.notLoggedIn) {
  console.log (IModelApp.i18n.translate("SafetyBaseMessages:info.login.loggedIn")
} else {
  console.log (IModelApp.i18n.translate("SafetyBaseMessages:info.login.notLoggedIn", {userName: this.loginName});
}
```

In the example above, we start by registering the namespace with IModelApp. That starts the process of retrieving the SafetyBaseMessages.json file in the directory corresponding to the current locale (in this case, "en") from the server. Since that might take a little while, before the first use of a namespace, we await on the readFinished property of the I18NNamespace, which is a Promise that is fulfilled when the file is retrieved and ready to be accessed by the translate method. If not logged in, we use the simple form of the translate method to display the string "You are not currently logged in to Bentley Connect." to the console. If the user is logged in, the message "You are logged in to Bentley Connect as xxx.", is displayed on the console, where xxx is replaced by this.loginName. This demonstrates passing additional argument to the translate method, which substitutes the value of the arguments for the corresponding variables specified in the {{ }} formulas in the translation string. That substitution is called "interpolation" in internationalization terminology.

Behind the scenes, iModelJs uses the [i18Next](http://www.i18next.com) JavaScript package. It has many other sophisticated internationalization capabilities, including formatting, plurals, and nesting, as well as the interpolation example above. iModelJs initializes i18next with a set of options that are usually fine for all applications. If you want different options, you can use i18next directly from your application, or instantiate an instance of iModelJs' I18N class, which provides some convenience methods for waiting for the read to finish, etc.

If you are using React for user interface development, please note that you should not put HTML markup in your localized strings for inclusion as text in your React controls. Such strings are not processed by the React transpiler, and thus the HTML tags will display verbatim rather than being processed as HTML.

## Tool Localization

The primary way of initiating actions in iModelJs applications is by authoring a subclass of the [Tool](./Tools) class. Each such Tool subclass is registered with the system by calling the register method on its class object. The register method takes an optional *nameSpace* argument that specifies the I18NNamespace that contains the localization strings for the tool, including its keyin, flyover, and description properties. The Tool's keyin property is used by the command parser to allow the user to type in the tool name to execute it. The flyover property is displayed when the cursor hovers over the Tool icon, and the description property is displayed in various contexts.

The keys for each of those properties are synthesized from the Tool's namespace and toolId. For example, the translation key for the keyin property is \<Namespace\>:tools.\<toolId\>.keyin. Now suppose you author a PlaceSprinkler command in the SafetyBase application. Your Tool class might look like this:

```ts
class PlaceSprinkler extends InteractiveTool {
  public static toolId = "Place.Sprinkler";
 ...
}

// register the PlaceSprinkler class.
const toyToolsNS: I18NNamespace = IModelApp.registerNamespace ("SafetyBaseTools");
PlaceSprinkler.register(toyToolsNS);
```

Then the appropriate entry in the english version of SafetyBaseTools.json file might look like this:

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
 const firstPrompt: string = IModelApp.i18n.translate ("SafetyBaseTools:Place.Sprinkler.prompt1");
```

Since your code retrieves those localized strings, they do not have to be subkeys of "tools.Place.Sprinkler". They could be separate keys in the same JSON file, or could even be in a different JSON file (in which case the namespace would be different). The convention demonstrated in the example above has the advantage of keeping the localizable strings associated with a particular tool all together, but the disadvantage that prompts or messages that might be usable for multiple tools would be duplicated in each tool.
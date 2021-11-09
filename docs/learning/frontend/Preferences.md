# User Preferences in iTwin.js

Applications frequently need to persist user preferences across sessions. Examples include tool settings; recently accessed models, views, or projects; user interface state; etc. Some settings are application specific, some are iTwin specific, and some are iModel specific.

In theory, settings that are iModel-specific could be stored in the iModel itself, but in practice that is not optimal, because the transaction model for design data does not fit well with settings data, and it is undesirable to have to commit a new version of an iModel every time a setting is saved.

## The SettingsAdmin class

iTwin.js provides the [SettingsAdmin]($product-settings-client) object, accessed through [IModelApp.userPrefences]($frontend), for managing the preferences.

The methods on SettingsAdmin allow saving and retrieving settings that are either user-specific or for all users. Saving a setting that is not user-specific requires administrator privileges, and is stored as specific to the organization of the user. Any user that belongs to that organization can retrieve the setting.

User-specific settings can be:

- Specific to an application and Project (for example, the user's most recently opened iModel when using the application)
- Specific to an application and iModel (for example, the user's application-specific session data)
- Specific to a Project (for example, the user's list of favorite iModels in that project)
- Specific to an iModel (for example, the user's list of favorite views in that iModel)
- Specific only to the user (for example, a list of favorite applications)

Settings are identified by a namespace, that is specified by the program but should be chosen to be unique, and a name that need only be unique within the namespace.

All settings are passed as objects to the SettingsAdmin methods, and persisted as JSON strings representing that object. The return value from the SettingsAdmin methods is a [SettingsResult]($product-settings-client), that contains a status property, an error message which might be populated with explanatory information if the status indicates an error, and the retrieved setting object for the settings retrieval methods.

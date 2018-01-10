# [Vorpal.js](https://github.com/dthree/vorpal) Settings Extension
Enables the ability to set property values for Vorpal.js extensions. It can be used to set, get, and store &lt;command&gt; &lt;property&gt; &lt;value...&gt; items for a Vorpal extension. It was made to have a light weight implementation so that your project can benefit from it quickely.

## Notice
This project was built to fill an immediate need. Vorpal.js is a well put together interactive shell that made extensions pretty straight forward. That being said, it is sad to see that the creator of the project is not going to be highly active according to the notice on their site. I will continue forward with this, small, project as needed and as the interest from others is around.

## Contents

- [Usage](#usage)
- [API](#api)

## Usage
### Step 1
Below is a simple example of how to enable Vorpal.js Settings in an extension. This should be in your `index.js` or similar file. The settings API exposes the `initialize` method which can be called with a file path if the default does not work for your liking.

```javascript
'use strict';

const settings = require('./settings');
const myCoolExtension = require('./myCoolExtension');
const vorpal = require('vorpal')();

settings.initialize()
  .then((opts) => {
    vorpal
      .use(settings, opts)
      .use(myCoolExtension, opts)
      .show()
      .parse(process.argv);

  })
  .catch(e => { console.log(e); });
```

The default file path defaults to the following if no path is specified.

```javascript
module.exports.initialize = (path) => {
...
    const fileName = '.4252settings';

    if (path === undefined) {

    // If the settings property is not defined for the options object then configure it now.
    // This is likely during the startup of the application.
    loadPath = `${os.homedir()}\\${fileName}`;
```
### Step 2
In your custom extension there should be a following section of code which Vorpal uses to enable the your extension.

```javascript
module.exports = (vorpal, options) => {
    ...
}
```

In that code you need to add your command's name. This doesn't have to be the name of an actual command that Vorpal will run, such as `myext [option]`. It can be any name which you want to use as the collection.

```javascript
const cmd = 'mycoolextension';

// Order is important and the registration should occur before using properties
options.register(cmd, ['dirpath'], ['c:\\thor'], updatePropertyCallback);

gFilePath = options[cmd]['dirpath'][0] == null ? gFilePath : options[cmd]['dirpath'][0] + '\\activity.json';
```
Notice that the property is accessed as an array

### Step 3
Start a new Vorpal instance of your application. Probably something like the below.
```console
node index.js
```

### Step 4
Check to see if there are any settings waiting to be used.

```console
local@yourhost~$ settings <enter>
```

This should return a JSON object to the console with the following data in it.
```json
{
    settings: {
        path: 'C:\\Users\\[your profile]\\.4252settings'
    },
    mycoolextension: {
        dirpath: [ 'c:\\thor' ] 
    }
}
```
## API
The API is light weight to keep things simple. There is some functionality which can be expanded upon in the future but this wiil get you started. We have already used two of the three API features; `initialize` and `register`. In the `options.register(...)` call we passed in an `updatePropertyCallback`. This should be a function which you maintain for your code. The event is fired when a property for your extension `mycoolextension` has changed.

### initialize
This method loads any settings stored on the machine or creates a new setting file if this is the first run or the file is missing. After that it adds the `events` function and `register` function to the `options` object.

```javascript
// Sets the path to load any stored settings
let loadPath = path || `${os.homedir()}\\${fileName}`;

loadSettings(...)
```

### register
```javascript
/**
 * Enables commands to self-register with the settings command. This will initalize
 * the properties for the command and will subscribe the command to the change of
 * property event.
 *
 * @param {string} command the command name to register
 * @param {string[]} properties properties to initalize for the command
 * @param {string[]} values the values for the properties
 * @param {function} event the callback for a property change notification
 */
options.register(command, properties, values, updatePropertyCallback) {
    ...
}
```

### updatePropertyCallback
This is passed into register method and sends two values. The `name` of the property being updated and the `value` that has changed.

```javascript

/**
* Updates the value of a given property. The name is expected to be lower case.
*
* @param {string} name the name of the property that has been updated
* @param {string[]} value the value of the property that has been updated
*/
function updateProperty(name, value) {
  if (name === 'dirpath') {
    gFilePath = value + '\\activity.json';
  }
}
```
'use strict'

const { EventEmitter } = require('events');
const ev = new EventEmitter();
const fs = require('fs');
const os = require('os');

let gVorpal = null;
let gOptions = null;

/**
 * To manage the command line input from the user the command to set and the property
 * are changed to lower case values to ensure there isn't duplicate entries for the
 * same named command and/or property. The values are left alone.
 * 
 * @param {string} command the full command line value
 * @param {string} args the arguments after the command
 */
function argsToLower(command, args) {
  const val = command.split(' ');
  let res = '';

  if (3 < val.length) {
    for (let i = 0; i < val.length; i++) {
      if (i !== 1 && i !== 2) {
        res += `${val[i]} `;
      } else {
        res += `${val[i].toLocaleLowerCase()} `;
      }
    }

    // Remove the trailing space
    res = res.substring(0, res.length - 1);
  } else {
    res = command.toLocaleLowerCase();
  }

  return res;
}

/**
 * Gets the list of commands which have self-registered with the settings command.
 */
function autocompleteCommand() {
  return new Promise((resolve, reject) => {
    let split = splitUiInput(gVorpal.ui.input());
    let res = [ ];
  
    res = Object.getOwnPropertyNames(gOptions)
      .filter(cmd => cmd !== 'events' && cmd !== 'register');
  
    if (1 < split.length) {
      let cmd = split[1].toLocaleLowerCase();
  
      if (2 === split.length) {
        let f = res.filter(m => m.startsWith(cmd));
  
        if (1 === f.length) {
          gVorpal.ui.input(`${split[0]} ${f[0]} `)
          res = Object.getOwnPropertyNames(gOptions[f[0]]);
        } else if (1 < f.length) {
          res = f;
        }
      } else if (3 === split.length) {
        if (gOptions[cmd] !== undefined) {
          let f = Object.getOwnPropertyNames(gOptions[cmd]).filter(m => m.startsWith(split[2].toLocaleLowerCase()));
  
          if (1 === f.length) {
            gVorpal.ui.input(`${split[0]} ${split[1]} ${f[0]} `)
            res = [ ];
          } else if (1 < f.length) {
            res = f;
          }
        }
      }
    }
    resolve(res);
  });
}

/**
 * Deletes a given property from the settings file. If the property value is
 * left 'undefined' from the user the command will delete the command property
 * on the object and all properties which are a part of it.
 *
 * @param {object} options the options collection to modify
 * @param {string} command the command to delete from
 * @param {string} property the property name to delete
 */
function deleteCommandProperty(options, command, property) {
  return new Promise((resolve, reject) => {
    if (options[command] !== undefined) {
      if (options[command][property] !== undefined) {

        // Delete the property
        delete options[command][property];

        saveSettings(options)
          .then(resolve())
          .catch(e => reject(e));
      } else if (property === undefined) {

        // Delete the command
        delete options[command];

        gOptions = options;

        saveSettings(options)
          .then(resolve())
          .catch(e => reject(e));
      }
    } else {
      resolve();
    }
  });
}

/**
 * Adds the event handler and register function to the options object.
 *
 * @param {object} options the options object
 */
function hookupOptions(options) {
  Object.defineProperty(options, 'events', {
    configurable: false,
    enumerable: false,
    value: ev,
    writable: true
  });

  Object.defineProperty(options, 'register', {
    configurable: true,
    enumerable: false,
    value: selfRegister,
    writable: false
  });

  gOptions = options;

  return options
}

/**
 * Used by consuming commands to intialize their settings object when first run.
 *
 * @param {object} options the options object
 * @param {string} command the command name
 * @param {string[]} properties a string array of property names to initialize
 * @param {string[]} values a string array of values whose index matches the properties index
 */
function initalizeCommandObject (options, command, properties, values) {
  return new Promise((resolve, reject) => {
    let setVal = false;

    if (command === undefined) {
      throw Error('The command argument cannot be undefined.');
    }

    if (options[command] === undefined) {
  
      // Create the command property on the options object if it does not exist.
      setObjectProperty(options, command, { });
      setVal = true;
    }
  
    if (Array.isArray(properties)) {
  
      // Initalize an empty array to prevent an exception
      if (values === undefined) {
        values = [];
      }
  
      for (let i = 0; i < properties.length; i++) {
        const prop = properties[i].toLocaleLowerCase();
  
        if (options[command][prop] === undefined) {
          setObjectProperty(options[command], prop, values[i] !== undefined ? values[i] : [ ]);
          setVal = true;
        }
      }
    } else if (properties !== undefined) {
      properties = properties.toLocaleLowerCase();
  
      if (options[command][properties] === undefined) {
        setObjectProperty(options[command], properties, values !== undefined ? values : [ ]);
        setVal = true;
      }
    }

    gOptions = options;

    if (setVal) {
      return saveSettings(options);
    } else {
      resolve(options);
    }
  });
}

/**
 * Loads the settings object from the given path.
 *
 * @param {string} path the path to load the settings file from
 */
function loadSettings(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, (err, data) => {
      if (err) {
        reject(err);
      } else {
        if (0 < data.length) {
          resolve(JSON.parse(data));
        } else {
          resolve({ });
        }
      }
    });
  });
}

/**
 * Saves the state of the options object to the settings file for the user to the
 * path provided in the [options.settings.path] property.
 *
 * @param {object} options the options object to save to disk
 * @param {string} [options.settings.path] the path to save the file
 */
function saveSettings(options) {
  return new Promise((resolve, reject) => {
    fs.writeFile(options.settings.path, JSON.stringify(options), (err) => {
      err ? reject(err) : resolve(options);
    });
  });
}

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
function selfRegister(command, properties, values, event) {
  command = command.toLocaleLowerCase();

  if (properties !== undefined && typeof properties !== 'function') {

    // Values was not specified so change values to the event
    if (typeof values === 'function') {
      event = values;
      values = [ ];
    }
  }

  initalizeCommandObject(this, command, properties, values)
    .then(opt => { })
    .catch(e => { throw e; });

  if (event !== undefined && typeof event === 'function') {
    ev.on(command, event);
  }
}

/**
 * Sets the given command property on the options object. If the command property
 * does not exist on the options property it will be created.
 *
 * @param {object} options the options object to configure
 * @param {string} command the command name which will become a property on the object
 * @param {string} property the property name to hold the value
 * @param {string[]} value the value to store
 */
function setCommandProperty(options, command, property, value) {
  if (options[command] === undefined) {

    // Create the command property on the options object if it does not exist.
    setObjectProperty(options, command, { });
  }

  if (options[command][property] === undefined) {
    setObjectProperty(options[command], property, value);
  } else {
    options[command][property] = value;
  }

  // Emit the event for the command
  ev.emit(command, property, value);

  gOptions = options;

  return saveSettings(options);
}

/**
 * Sets a property on the given object.
 *
 * @param {object} obj a property of the options object
 * @param {string} property the property name
 * @param {string[]} value the value array
 */
function setObjectProperty(obj, property, value) {
  return Object.defineProperty(obj, property, {
    configurable: true,
    enumerable: true,
    value: value,
    writable: true
  });
}

/**
 * Splits the command line input into an array of options.
 *
 * @param {string} str the command line string to split
 */
function splitUiInput(str) {
  let arr =  [ ];
  let index = 0;
  let quote = false;

  for (let i = 0; i < str.length; i++) {
    if (str[i] === ' ' && !quote) {
      arr.push(str.substring(index, i));
      index = i + 1;
    } else if ((str[i] === '"' || str[i] === '\'') && !quote) {
      index = i;
      quote = true;
    } else if ((str[i] === '"' || str[i] === '\'') && quote) {
      arr.push(str.substring(index, i + 1));
      index = i + 2;
      i++;
      quote = false;
    } else if (i === str.length - 1) {
      arr.push(str.substring(index, i + 1));
    }
  }

  return arr;
}

module.exports = (vorpal, options) => {
  gVorpal = vorpal;

  vorpal
    .command('delete <command> [property]')
    .description('use this to delete values for the various commands')
    .parse(argsToLower)
    .alias('del')
    .autocomplete({data: autocompleteCommand})
    .action((args, cb) => {
      deleteCommandProperty(options, args.command, args.property)
        .then(r => cb(r))
        .catch(e => cb(e));
    });

  vorpal
    .command('get <command> [property]')
    .description('use this to get the value for a property of the various commands')
    .parse(argsToLower)
    .autocomplete({data: autocompleteCommand})
    .action((args, cb) => {
      let val = { };
      if (options[args.command] !== undefined) {
        if (options[args.command][args.property] !== undefined) {
          val = options[args.command][args.property];
        } else if (args['property'] === undefined) {
          val = options[args.command];
        }
      }

      //TODO: Format output to look nice!
      cb(val);
    });

  vorpal
    .command('set <command> <property> <value...>')
    .description('use this to set values for the various commands')
    .parse(argsToLower)
    .autocomplete({data: autocompleteCommand})
    .action((args, cb) => {
      setCommandProperty(options, args.command, args.property, args.value)
        .then(r => cb())
        .catch(e => cb(e));
    });

  vorpal
    .command('settings')
    .alias('config')
    .description('show current settings')
    .action((args, cb) => {

      //TODO: Format output to look nice!
      cb(options);
    });
};

/**
 * Initalizes the settings file and gets the values if the file exists.
 *
 * @param {string} path a custom path to the settings file
 */
module.exports.initialize = (path) => {
  return new Promise((resolve, reject) => {
    const fileName = '.4252settings';
    let loadPath = { };
  
    if (path === undefined) {
  
      // If the settings property is not defined for the options object then configure it now.
      // This is likely during the startup of the application.
      loadPath = `${os.homedir()}\\${fileName}`;
    } else {
  
      // In this case the options object could have a user specified path passed in outside the module.
      loadPath = path;
    }
  
    loadSettings(loadPath)
      .then(r => {
        if (!r.hasOwnProperty('settings')) {
  
          // In rare cases the file can be corrupted and the settings value not found. In this
          // case the settings path should be stored.
          return setCommandProperty({ }, 'settings', 'path', `${loadPath}`);
        } else {
          return r;
        }
      })
      .then(opt => {
        opt = hookupOptions(opt);
        resolve(opt);
      })
      .catch(e => {
        if (e.code === 'ENOENT') {
  
          // If the file was not found, saving the settings path value will create it.
          return setCommandProperty({ }, 'settings', 'path', `${loadPath}`);
        } else {
          reject(e);
        }
      })
      .then(opt => {
        opt = hookupOptions(opt);
        resolve(opt);
      })
      .catch(e => { reject(e) });
  });
}

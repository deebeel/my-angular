'use strict';

class Module {
    constructor(name, requires, configFn) {
        checkName(name, 'module');
        this.name = name;
        this.requires = requires;
        this.$$invokeQueue = [];
        this.$$configBlocks = [];
        this.$$runBlocks = [];
        Object.assign(this, Module.defaults);
        if (configFn) {
            this.config(configFn);
        }
    }

    static defaults = {
        constant: invokeLater('$provide', 'constant', 'unshift'),
        provider: invokeLater('$provide', 'provider'),
        factory: invokeLater('$provide', 'factory'),
        service: invokeLater('$provide', 'service'),
        filter: invokeLater('$filterProvider', 'register'),
        decorator: invokeLater('$provide', 'decorator'),
        value: invokeLater('$provide', 'value', 'unshift'),
        config: invokeLater('$injector', 'invoke', 'push', '$$configBlocks'),
        run(fn) {
            this.$$runBlocks.push(fn);
            return this;
        }
    };
}

function invokeLater(service, method, arrayMethod, queue) {
    return function () {
        queue = queue || '$$invokeQueue';
        this[queue][arrayMethod || 'push']([service, method, arguments]);
        return this;
    };
}
const NOT_ALLOWED_MODULE_NAMES = [
    'hasOwnProperty'
];

function checkName(name, target) {
    if (~NOT_ALLOWED_MODULE_NAMES.indexOf(name)) {
        throw Error(`'${name}' is not allowed to be the name of a ${target}`);
    }
}


export default Module;
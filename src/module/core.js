'use strict';
import _ from 'lodash';
import Module from './module';


class Core {
    constructor() {
        this.$$modules = {};
    }

    module(name, requires, configFn) {
        if (!_.isArray(requires)) {
            return this.$$getModule(name);
        }
        return this.$$createModule(name, requires, configFn);
    }

    $$createModule(name, requires, configFn) {
        return this.$$modules[name] = new Module(name, requires, configFn);
    }

    $$getModule(name) {
        var module = this.$$modules[name];
        if (!module) {
            throw Error(`Module ${name} is not available`);
        }
        return module;
    }
}

export default Core;
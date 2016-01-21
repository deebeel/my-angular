'use strict';
import _ from 'lodash';

const CONTROLLER_AS = /^(\S+)(\s+as\s+(\w+))?/;
class $ControllerProvider {
    constructor() {
        var globals = false, controllers = {};
        this.allowGlobals = function () {
            globals = true;
        };
        this.register = function (obj, controller) {
            if (_.isObject(obj)) {
                _.extend(controllers, obj);
            }
            controllers[obj] = controller;
        };
        this.$get = ['$injector', function ($injector) {

            return function (ctrl, locals, later, controllerAs) {
                var ctrlName, instance, proto, match;
                if (_.isString(ctrl)) {
                    match = ctrl.match(CONTROLLER_AS);
                    ctrlName = match[1];
                    controllerAs = controllerAs || match[3];
                    if (controllers.hasOwnProperty(ctrlName)) {
                        ctrl = controllers[ctrlName];
                    } else {
                        ctrl = (locals && locals.$scope && locals.$scope[ctrlName]) ||
                            (globals && window[ctrlName]);
                    }
                }
                if (later) {
                    proto = (_.isArray(ctrl) ? _.last(ctrl) : ctrl).prototype;
                    instance = Object.create(proto);
                } else {
                    instance = $injector.instantiate(ctrl, locals);
                }
                if (controllerAs) {
                    addToScope(locals, controllerAs, instance);
                }
                return later ? _.extend(function () {
                    $injector.invoke(ctrl, instance, locals);
                    return instance;
                }, {
                    instance
                }) : instance;
            };

            function addToScope(locals, controllerAs, instance) {
                if (locals && _.isObject(locals.$scope)) {
                    locals.$scope[controllerAs] = instance;
                    return;
                }
                throw Error('Cannot export controller as "' + controllerAs + '"! No $scope provided via locals');
            }
        }];
    }
}

export default $ControllerProvider;
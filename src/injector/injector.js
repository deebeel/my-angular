'use strict';
import _ from 'lodash';
import arrify from 'arrify';

const FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
const STRIP_COMMENTS = /(\/\*.*?\*\/)|(\/\/.*$)/mg;
const START_AND_END_UNDERSCORES = /_.*_/;
const INSTANTIATING = Object.create(null);


function createInjector(moduleNames, core, strict) {
    var path = [],
        loaded = new Set(),
        instanceCache = {},
        providerCache = {};


    providerCache.$provide = {
        constant,
        provider,
        factory,
        value,
        service,
        decorator
    };
    providerCache.$injector = createInternalInjector(providerCache, ()=> {
        throw Error('Unknown provider: ' + path.join(' <- '));
    });
    instanceCache.$injector = createInternalInjector(instanceCache, name=> {
        var provider = providerCache.$injector.get(makeProviderName(name));
        return instanceCache.$injector.invoke(provider.$get, provider);
    });
    loadModules(moduleNames, core, loaded);
    return instanceCache.$injector;

    function provider(key, provider) {
        if (_.isFunction(provider)) {
            provider = providerCache.$injector.instantiate(provider);
        }
        providerCache[makeProviderName(key)] = provider;//invoke(provider.$get, provider);
    }

    function factory(key, factoryFn, enforce) {
        this.provider(key, {$get: enforce === false ? factoryFn : enforceReturnValue(factoryFn)});
    }

    function value(key, val) {
        this.factory(key, _.constant(val), false);
    }

    function decorator(target, decoratorFn) {
        var provider = providerCache.$injector.get(makeProviderName(target));
        var original = provider.$get;
        provider.$get = function () {
            var instance = instanceCache.$injector.invoke(original, provider);
            instanceCache.$injector.invoke(decoratorFn, null, {$delegate: instance});
            return instance;
        };
    }

    function service(key, serviceFn) {
        this.factory(key, ()=> {
            return instanceCache.$injector.instantiate(serviceFn);
        });
    }

    function enforceReturnValue(factoryFn) {
        return ()=> {
            var val = instanceCache.$injector.invoke(factoryFn);
            if (_.isUndefined(val)) {
                throw Error('Factory must return a value');
            }
            return val;
        }
    }

    function constant(key, value) {
        if (key === 'hasOwnProperty') {
            throw Error('hasOwnProperty is not allowed to be a constant');
        }
        providerCache[key] = instanceCache[key] = value;
    }


    function createInternalInjector(cache, factoryFn) {
        return {
            has,
            get: getService,
            invoke,
            instantiate,
            annotate
        };

        function getFunction(fn) {
            if (_.isArray(fn)) {
                fn = _.last(fn);
            }
            return fn;
        }

        function getArgs(deps, locals) {
            return _.map(deps, name=> {
                var arg;
                if (!_.isString(name)) {
                    throw Error(`Incorrect inject token! Expected  a string, got ${name}`);
                }
                arg = locals && locals[name];
                return _.isUndefined(arg) ? getService(name) : arg;
            });
        }

        function invoke(fn, that, locals) {
            var deps = annotate(fn);
            fn = getFunction(fn);
            return fn.apply(
                that,
                getArgs(deps, locals)
            );
        }

        function instantiate(fn, locals) {
            var deps = annotate(fn);
            fn = getFunction(fn);
            fn.$inject = deps;
            var obj = Object.create(fn.prototype);
            return invoke(fn, obj, locals) || obj;
        }

        function getService(name) {
            if (cache.hasOwnProperty(name)) {
                if (cache[name] === INSTANTIATING) {
                    path.unshift(name);
                    throw Error('Circular dependency found: ' + path.join(' <- '));
                }
                return cache[name];
            }
            path.unshift(name);
            cache[name] = INSTANTIATING;
            try {
                return cache[name] = factoryFn(name);
            } finally {
                path.shift();
                if (cache[name] === INSTANTIATING) {
                    delete cache[name];
                }
            }
        }

    }

    function has(name) {
        return instanceCache.hasOwnProperty(name) || providerCache.hasOwnProperty(makeProviderName(name));
    }

    function annotate(fn) {
        if (_.isArray(fn)) {
            return fn.slice(0, -1);
        }
        if (fn.$inject) {
            return fn.$inject;
        }
        if (!fn.length) {
            return [];
        }
        if (strict) {
            throw Error('fn is not explicitly annotated and can`t be invoked in strict mode');
        }
        return fn.toString()
            .replace(STRIP_COMMENTS, '')
            .match(FN_ARGS)[1]
            .split(',')
            .map(argMapper);
    }

    function loadModules(modules, core, loaded) {
        var runBlocks = [];
        _.forEach(modules, moduleObject=> {
            if (loaded.has(moduleObject)) {
                return;
            }
            loaded.add(moduleObject);
            if (_.isFunction(moduleObject) || _.isArray(moduleObject)) {
                processRunBlocks(
                    providerCache.$injector.invoke(moduleObject)
                );
                return;
            }
            var module = core.module(moduleObject);
            loadModules(module.requires, core, loaded);
            processQueue(module.$$invokeQueue);
            processQueue(module.$$configBlocks);
            runBlocks = runBlocks.concat(module.$$runBlocks);
        });
        processRunBlocks(runBlocks);
    }

    function processQueue(queue) {
        _.forEach(queue, ([service, method, args])=> {
            var targetService = providerCache.$injector.get(service);
            targetService[method].apply(targetService, args);
        });
    }

    function processRunBlocks(runBlocks) {
        _.forEach(arrify(runBlocks), (fn)=> {
            instanceCache.$injector.invoke(fn);
        });
    }
}

function makeProviderName(name) {
    return name + 'Provider';
}
function argMapper(str) {
    str = str.trim();
    if (START_AND_END_UNDERSCORES.test(str)) {
        str = str.slice(1, -1);
    }
    return str;
}

export default createInjector;
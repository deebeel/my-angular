'use strict';
import Parser from './Parser';

import {
    times,
    forEach,
    any,
    isUndefined,
    isFunction,
    isString,
    startsWith,
    constant
} from 'lodash';

class $ParseProvider {
    constructor() {
        this.$get = $parseFactory;
    }
}
function $parseFactory($filter) {
    return function (expr) {
        if (isFunction(expr)) {
            return expr;
        }
        if (isString(expr)) {
            var parser = new Parser($filter);
            var oneTime = false;
            if (startsWith(expr, '::')) {
                oneTime = true;
                expr = expr.substring(2);
            }
            var fn = parser.parse(expr);
            if (fn.constant) {
                fn.$$watchDelegate = constantWatchDelegate;
            } else if (oneTime) {
                fn.$$watchDelegate = fn.literal ? oneTimeLiteralWatchDelegate : oneTimeWatchDelegate;
            } else if (fn.inputs) {
                fn.$$watchDelegate = inputWatchDelegate;
            }
            return fn;
        }
        return Function.prototype;
    };
}
$parseFactory.$inject = ['$filter'];

var inputWatchDelegate = (scope, listenerFn, valueEq, watchFn)=> {
    var lastResult,
        inputExpressions = watchFn.inputs,
        oldValues = times(inputExpressions.length, constant(Function.prototype));
    return scope.$watch(()=> {
        var changed = false;
        forEach(inputExpressions, (expr, i)=> {
            var newValue = expr(scope);
            if (changed || !expressionInputDirtyCheck(newValue, oldValues[i])) {
                changed = true;
                oldValues[i] = newValue;
            }
        });
        if (changed) {
            lastResult = watchFn(scope);
        }
        return lastResult;
    }, listenerFn, valueEq);
};

var expressionInputDirtyCheck = (newValue, oldValue) => {
    return newValue === oldValue ||
        (typeof newValue === 'number' && typeof oldValue === 'number' &&
        isNaN(newValue) && isNaN(oldValue));
};
var oneTimeLiteralWatchDelegate = (scope, listenerFn, valueEq, watchFn)=> {
    var isAllDefined = (val)=> {
        return !any(val, isUndefined);
    };
    var unwatch = scope.$watch(
        function () {
            return watchFn(scope);
        }, function (newValue) {
            if (isFunction(listenerFn)) {
                listenerFn.apply(this, arguments);
            }
            isAllDefined(newValue) && scope.$$postDigest(()=> {
                isAllDefined(newValue) && unwatch();
            });
        }, valueEq
    );
    return unwatch;
};

var oneTimeWatchDelegate = (scope, listenerFn, valueEq, watchFn)=> {
    var lastValue;
    var unwatch = scope.$watch(
        function () {
            return watchFn(scope);
        }, function (newValue) {
            lastValue = newValue;
            if (isFunction(listenerFn)) {
                listenerFn.apply(this, arguments);
            }
            !isUndefined(newValue) && scope.$$postDigest(()=> {
                !isUndefined(lastValue) && unwatch();
            });
        }, valueEq
    );
    return unwatch;
};
var constantWatchDelegate = (scope, listenerFn, valueEq, watchFn)=> {
    var unwatch = scope.$watch(
        ()=>watchFn(scope),
        function () {
            if (isFunction(listenerFn)) {
                listenerFn.apply(this, arguments);
            }
            unwatch();
        },
        valueEq
    );
    return unwatch;
};

export default $ParseProvider;
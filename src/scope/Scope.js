'use strict';
import { apply, forEach, equals, clone } from 'ramda';
import ScopeEvent from './ScopeEvent';

const INIT_WATCH_LAST = Object.create(null);
const DIGEST_PHASE = '$digest';
const APPLY_PHASE = '$apply';
const DEFAULT_TTL = 10;

class Scope {
    constructor() {
        this.$root = this;
        this.$$watchers = [];
        this.$$asyncQueue = [];
        this.$$applyAsyncQueue = [];
        this.$$postDigestQueue = [];
        this.$$children = [];
        this.$$listeners = {};
        this.$$lastDirtyWatcher = null;
        this.$$phase = null;
        this.$$applyAsyncId = null;
    }

    $new(isolated, parent) {
        var child;
        parent = parent || this;
        if (isolated) {
            child = new Scope();
            child.$root = parent.$root;
        } else {
            child = Object.create(this);
            child.$$children = [];
            child.$$watchers = [];
            child.$$listeners = {};
        }
        parent.$$children.push(child);
        child.$parent = parent;
        return child;
    }

    $destroy() {
        if (this === this.$root) {
            return;
        }
        var siblings = this.$parent.$$children;
        var index = siblings.indexOf(this);
        if (~index) {
            this.$broadcast('$destroy');
            siblings.splice(index, 1);
        }
    }

    $watchCollection(watchFn, listener) {
        var newVal, newValues, oldValues, veryOldValue,
            trackVeryOldValue = listener.length > 1,
            firstRun = true,
            changeCounter = 0;
        var internalWatch = (scope)=> {
            newValues = watchFn(scope);
            if (isArrayLike(newValues)) {
                if (!Array.isArray(oldValues)) {
                    oldValues = [];
                    changeCounter++;
                }
                if (newValues.length !== oldValues.length) {
                    changeCounter++;
                    oldValues.length = newValues.length;
                }
                var index = newValues.length;
                while (index--) {
                    newVal = newValues[index];
                    if (!areEqual(newVal, oldValues[index], false)) {
                        oldValues[index] = newVal;
                        changeCounter++;
                    }
                }
            } else if (typeof newValues === 'object') {
                if (typeof oldValues !== 'object') {
                    oldValues = {};
                    changeCounter++;
                }
                Object.keys(newValues).forEach((key)=> {
                    if (!areEqual(newValues[key], oldValues[key], false)) {
                        oldValues[key] = newValues[key];
                        changeCounter++;
                    }
                });

                if (Object.keys(oldValues) > Object.keys(newValues)) {
                    changeCounter++;
                    for (var key in oldValues) {
                        if (!newValues.hasOwnProperty(key)) {
                            delete oldValues[key];
                        }
                    }
                }
            } else {
                !areEqual(newValues, oldValues, false) && changeCounter++;
                oldValues = newValues;
            }
            return changeCounter;
        };
        var internalListener = ()=> {
            if (firstRun) {
                firstRun = false;
                listener(newValues, newValues, this);
            } else {
                listener(newValues, veryOldValue, this);
            }
            if (trackVeryOldValue) {
                veryOldValue = clone(newValues);
            }
        };
        return this.$watch(internalWatch, internalListener);
    }

    $watch(watchFn, listenerFn, valueEq) {
        var watcher = {
            last: INIT_WATCH_LAST,
            valueEq: !!valueEq,
            watchFn,
            listenerFn
        };
        this.$$watchers.unshift(watcher);
        this.$root.$$lastDirtyWatcher = null;
        return ()=> {
            var index = this.$$watchers.indexOf(watcher);
            if (~index) {
                this.$$watchers.splice(index, 1);
                this.$root.$$lastDirtyWatcher = null;
            }
        };
    }

    $watchGroup(watchers, listener, valueEq) {
        var newValues = new Array(watchers.length);
        var oldValues = new Array(watchers.length);
        var listenerCallScheduled = false;
        var firstRun = true;
        var shouldCall = true;

        if (!watchers.length) {
            this.$evalAsync(()=> {
                shouldCall && listener(newValues, oldValues, this);
            });
            return ()=>shouldCall = false;
        }

        var groupListener = ()=> {
            if (firstRun) {
                firstRun = false;
                listener(newValues, newValues, this);
            } else {
                listener(newValues, oldValues, this);
            }
            listenerCallScheduled = false;
        };

        var destroyFns = watchers.map((watcher, index)=> {
            return this.$watch(watcher, (newVal, oldVal)=> {
                newValues[index] = newVal;
                oldValues[index] = oldVal;
                if (!listenerCallScheduled) {
                    listenerCallScheduled = true;
                    this.$evalAsync(groupListener);
                }
            }, valueEq);
        });
        return ()=> destroyFns.forEach(fn=>fn());
    }

    $digest() {
        var dirty, ttl = DEFAULT_TTL;
        this.$root.$$lastDirtyWatcher = null;
        this.$beginPhase(DIGEST_PHASE);
        if (this.$root.$$applyAsyncId) {
            clearTimeout(this.$root.$$applyAsyncId);
            this.$$flushApplyAsyncQueue();
        }
        do {
            this.$$flushExecAsyncQueue();
            dirty = this.$$digestOnce();
        } while (--ttl && (dirty || this.$root.$$asyncQueue.length));
        if (!ttl) {
            throw Error(`$digest has been called more then ${DEFAULT_TTL} times`);
        }
        this.$$flushPostDigestQueue();
        this.$clearPhase();
    }

    $applyAsync(expr) {
        this.$root.$$applyAsyncQueue.push(()=>this.$eval(expr));
        if (this.$root.$$applyAsyncId === null) {
            this.$root.$$applyAsyncId = setTimeout(
                this.$apply.bind(this, this.$$flushApplyAsyncQueue.bind(this))
            );
        }
    }

    $apply(expression) {
        try {
            this.$beginPhase(APPLY_PHASE);
            return this.$eval(expression);
        } finally {
            this.$clearPhase();
            this.$root.$digest();
        }
    }

    $eval(expression, ...args) {
        try {
            return expression && expression(this, ...args);
        } catch (err) {
            console.error(err.message);
        }
    }

    $evalAsync(fn) {
        if (!this.$$phase && !this.$root.$$asyncQueue.length) {
            setTimeout(()=>this.$root.$$asyncQueue.length && this.$root.$digest());
        }
        this.$root.$$asyncQueue.push({scope: this, expression: fn});
    }

    $beginPhase(phase) {
        if (this.$$phase) {
            throw Error(`${this.$$phase} already in progress`);
        }
        this.$$phase = phase;
    }

    $clearPhase() {
        this.$$phase = null;
    }

    $on(event, listener) {
        var listeners = this.$$listeners[event];
        if (!listeners) {
            this.$$listeners[event] = listeners = [];
        }
        listeners.push(listener);
        return ()=> {
            var index = listeners.indexOf(listener);
            if (~index) {
                listeners[index] = null;
            }
        };
    }

    $emit(eventName, ...args) {
        var scope = this;
        var event = new ScopeEvent(eventName, this);
        var eventArgs = [event].concat(args);
        do {
            scope.$$fireEventOnScope(eventName, eventArgs);
            scope = scope.$parent;
        } while (scope && event.propagate);
        return event;
    }

    $broadcast(eventName, ...args) {
        var event = new ScopeEvent(eventName, this);
        var eventArgs = [event].concat(args);

        this.$$everyScope(scope=> {
            scope.$$fireEventOnScope(eventName, eventArgs);
            return true;
        });
        return event;
    }

    $$fireEventOnScope(eventName, args) {
        var index = 0,
            event = args[0],
            listeners = this.$$listeners[eventName];
        event.currentScope = this;
        if (listeners) {
            while (index < listeners.length) {
                if (!listeners[index]) {
                    listeners.splice(index, 1);
                    continue;
                }
                try {
                    listeners[index].apply(null, args);
                } catch (err) {
                    console.error(err.message);
                }
                index++;
            }
        }
        event.currentScope = null;
    }

    $$postDigest(fn) {
        this.$root.$$postDigestQueue.push(fn);
    }

    $$everyScope(fn) {
        return fn(this) && this.$$children.every(child=>child.$$everyScope(fn));
    }

    $$flushExecAsyncQueue() {
        while (this.$root.$$asyncQueue.length) {
            var asyncTask = this.$root.$$asyncQueue.shift();
            asyncTask.scope.$eval(asyncTask.expression)
        }
    }

    $$flushPostDigestQueue() {
        while (this.$root.$$postDigestQueue.length) {
            try {
                this.$root.$$postDigestQueue.shift()();
            } catch (err) {
                console.error(err.message);
            }
        }
    }

    $$flushApplyAsyncQueue() {
        while (this.$root.$$applyAsyncQueue.length) {
            this.$root.$$applyAsyncQueue.shift()();
        }
        this.$root.$$applyAsyncId = null;
    }

    $$digestOnce() {
        var dirty;
        this.$$everyScope(scope=> {
                var newValue,
                    oldValue,
                    valueEq,
                    watcher;
                for (var index = scope.$$watchers.length - 1; index >= 0; index--) {
                    watcher = scope.$$watchers[index];
                    if (!watcher) {
                        continue;
                    }
                    try {
                        newValue = watcher.watchFn(scope);
                    } catch (err) {
                        console.error(err.message);
                        continue;
                    }

                    if (typeof watcher.listenerFn !== 'function') {
                        continue;
                    }
                    oldValue = watcher.last;
                    valueEq = watcher.valueEq;
                    if (!areEqual(newValue, oldValue, valueEq)) {
                        watcher.last = (valueEq ? clone(newValue) : newValue);
                        scope.$root.$$lastDirtyWatcher = watcher;
                        try {
                            watcher.listenerFn(
                                newValue,
                                (oldValue === INIT_WATCH_LAST ? newValue : oldValue),
                                scope
                            );
                        } catch (err) {
                            console.error(err.message);
                        }
                        dirty = true;
                    } else if (scope.$root.$$lastDirtyWatcher === watcher) {
                        dirty = false;
                        break;
                    }
                }
                return dirty !== false;
            }
        );
        return dirty;
    }
}


var areEqual = (newVal, oldVal, valueEq)=> {
    if (valueEq) {
        return equals(newVal, oldVal);
    }
    return newVal === oldVal || (
            typeof newVal === 'number' &&
            typeof oldVal === 'number' &&
            isNaN(newVal) && isNaN(oldVal)
        );
};

var isArrayLike = (obj)=> {
    if (obj == null) {
        return false;
    }
    var length = obj.length;
    return typeof length === 'number' &&
        length > 0 &&
        (length - 1) in obj;
};
export default Scope;

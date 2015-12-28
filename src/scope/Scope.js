'use strict';
import { forEach } from 'ramda';
const INIT_WATCH_LAST = Object.create(null);
export default class Scope {
    constructor() {
        this.$$watchers = [];
    }

    $watch(watchFn, listenerFn) {
        this.$$watchers.push({
            last: INIT_WATCH_LAST,
            watchFn,
            listenerFn
        });
    }

    $$digestOnce() {
        var newValue,
            oldValue,
            watcher,
            dirty = false;


        for (var index = 0; index < this.$$watchers.length; index++) {
            watcher = this.$$watchers[index];
            newValue = watcher.watchFn(this);
            if (typeof watcher.listenerFn !== 'function') {
                continue;
            }
            oldValue = watcher.last;
            if (newValue !== oldValue) {
                watcher.last = newValue;
                watcher.listenerFn(
                    newValue,
                    (oldValue === INIT_WATCH_LAST ? newValue : oldValue),
                    this);
                this.$$lastDirtyWatcher = watcher;
                dirty = true;
            } else if (this.$$lastDirtyWatcher === watcher) {
                break;
            }
        }
        return dirty;
    }

    $digest() {
        var dirty, ttl = 10;
        do {
            dirty = this.$$digestOnce();
        } while (dirty && --ttl);
        if (!ttl) {
            throw Error(`$digest has been called more then ${ttl} times`);
        }
    }
};
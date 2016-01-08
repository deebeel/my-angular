'use strict';
import _ from 'lodash';

function $QFactory(caller) {
    class Deferrer {
        constructor() {
            this.promise = new QPromise();
        }

        resolve(val) {
            if (this.promise.$$state.status) {
                return;
            }
            if (isThenable(val)) {
                val.then(
                    _.bind(this.resolve, this),
                    _.bind(this.reject, this),
                    _.bind(this.notify, this)
                );
                return;
            }
            this.promise.$$state.value = val;
            this.promise.$$state.status = 1;
            scheduleProcessQueue(this.promise.$$state);
        }

        reject(reason) {
            if (this.promise.$$state.status) {
                return;
            }
            this.promise.$$state.value = reason;
            this.promise.$$state.status = 2;
            scheduleProcessQueue(this.promise.$$state);
        }

        notify(progress) {
            if (this.promise.$$state.status) {
                return;
            }
            var {pending} = this.promise.$$state;
            if (pending && pending.length) {
                caller(()=> {
                    _.forEach(pending, ([deferred,,,onProgress])=> {
                        var res;
                        try {
                            if (_.isFunction(onProgress)) {
                                res = onProgress(progress);
                            }
                            if (_.isUndefined(res)) {
                                deferred.notify(progress);
                                return;
                            }
                            deferred.notify(res);
                        } catch (e) {
                            console.warn(e);
                        }
                    });
                });
            }
        }
    }

    class QPromise {
        constructor() {
            this.$$state = {};
        }

        then(onFulfilled, onRejected, onProgress) {
            var result = new Deferrer();
            this.$$state.pending = this.$$state.pending || [];
            this.$$state.pending.push([result, onFulfilled, onRejected, onProgress]);
            if (this.$$state.status) {
                scheduleProcessQueue(this.$$state);
            }
            return result.promise;
        }

        finally(fn, onProgress) {
            return this.then(
                handleFinallyCallback(fn, true),
                handleFinallyCallback(fn, false),
                onProgress
            );
        }

        catch(onRejected) {
            return this.then(null, onRejected);
        }

    }
    function Q(resolver) {
        if (!_.isFunction(resolver)) {
            throw Error('Resolve must be a function');
        }
        var d = Q.defer();
        resolver(
            _.bind(d.resolve, d),
            _.bind(d.reject, d)
        );
        return d.promise;
    }

    _.extend(Q, {
        defer(){
            return new Deferrer();
        },

        reject(val){
            var d = new Deferrer();
            d.reject(val);
            return d.promise;
        },

        when(val, ...methods){
            var d = new Deferrer();
            d.resolve(val);
            return d.promise.then(...methods);
        },

        resolve(...data){
            return Q.when(...data);
        },

        all(promises){
            var res = _.isArray(promises) ? [] : {};
            var count = 0;
            var d = Q.defer();
            _.forEach(promises, (promise, i)=> {
                count++;
                Q.when(promise).then(val=> {
                    res[i] = val;
                    if (!--count) {
                        d.resolve(res);
                    }
                }, _.bind(d.reject, d));
            });
            if (!count) {
                d.resolve(res);
            }
            return d.promise;
        }
    });

    return Q;


    function scheduleProcessQueue(state) {
        caller(()=>processQueue(state));
    }

    function processQueue(state) {
        var handlers,
            deferrer,
            handler,
            pending = state.pending || [];
        state.pending = null;
        try {
            while (pending.length) {
                handlers = pending.shift();
                handler = handlers[state.status];
                deferrer = handlers[0];
                if (handler) {
                    deferrer.resolve(handler(state.value));
                } else if (state.status === 1) {
                    deferrer.resolve(state.value);
                } else {
                    deferrer.reject(state.value);
                }
            }
        } catch (err) {
            deferrer.reject(err);
        }

    }


}
function handleFinallyCallback(cb, resolved) {
    return function (value) {
        var fnVal = cb();
        var finalFn = handleFinalValue(value, resolved);
        if (isThenable(fnVal)) {
            return fnVal.then(finalFn);
        }
        return finalFn();
    };
}
function handleFinalValue(value, resolved) {
    return ()=> {
        if (resolved) {
            return value;
        }
        throw value;
    };
}
function isThenable(val) {
    return !!val && _.isFunction(val.then);
}

export default $QFactory;
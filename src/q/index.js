'use strict';
import $QFactory from './q';

if (TEST) {
    require('./q.spec');
}


class $QProvider {
    constructor() {
        this.$get = ['$rootScope', ($rootScope)=> {
            return $QFactory($rootScope.$evalAsync.bind($rootScope));
        }];
    }
}

class $$QProvider {
    constructor() {
        this.$get = ()=> {
            return $QFactory(setTimeout);
        };
    }
}


export {$QProvider, $$QProvider};

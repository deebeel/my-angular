'use strict';
import createInjector from './injector';
if (TEST) {
    require('./injector.spec.js');
}

export default createInjector;


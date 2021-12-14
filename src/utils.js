// Allow a function to be passed that can generate a route-aware module name
export function getModuleName(vuexModuleDef, route) {
    const name = typeof vuexModuleDef.moduleName === 'function' ?
        vuexModuleDef.moduleName({ $route: route }) :
        vuexModuleDef.moduleName;
    return name;
}

// Return the namespaced module state
function getModuleState(store, nameArr) {
    return nameArr.reduce((acc, k) => (acc ? acc[k] : null), store.state);
}

export function safelyRegisterModule(store, name, vuexModule, logger) {
    const nameArr = name.split('/');
    if (store.hasModule(nameArr)) {
        logger.info(`Skipping duplicate dynamic Vuex module registration: ${name}`);
    } else {
        logger.info(`Registering dynamic Vuex module: ${name}`);
        store.registerModule(nameArr, vuexModule, {
            preserveState: getModuleState(store, nameArr) != null,
        });
    }
}

/* eslint-disable max-params */
/**
 * Return a consistent structure for the object passed to fetchData and related hooks
 *
 * @param   {object} ssrContext Vue SSr context
 * @param   {object} app        Vue app
 * @param   {object} router     Vue router instance
 * @param   {object} store      Vuex instance
 * @param   {object} to         Destination route
 * @param   {object} from       Source route
 * @returns {object}            Object to be passed to middlewares and fetchData
 */
export function getFetchDataArgs(ssrContext, app, router, store, to, from) {
    return {
        ssrContext,
        app,
        from,
        route: to,
        router,
        store,
    };
}
/* eslint-enable max-params */

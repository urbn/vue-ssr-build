import { getModuleName, safelyRegisterModule, getFetchDataArgs } from './utils';

// Server side data loading approach based on:
// https://ssr.vuejs.org/en/data.html#client-data-fetching

/**
 * Register any dynamic Vuex modules.  Registering the store
 * modules as part of the component allows the module to be bundled
 * with the async-loaded component and not in the initial root store
 * bundle
 *
 * @param   {object} router Destination route object
 * @param   {object} store  Vuex Store instance
 * @param   {object} logger Logger instance
 * @returns {undefined}     No return value
 */
export function useRouteVuexModulesServer(router, store, logger) {
    router.getMatchedComponents()
        .filter(c => 'vuex' in c)
        .flatMap(c => c.vuex)
        .forEach((vuexModuleDef) => {
            const name = getModuleName(vuexModuleDef, router.currentRoute);
            safelyRegisterModule(store, name, vuexModuleDef.module, logger);
        });
}

/**
 * Wire up server-side fetchData/globalFetchData execution for current route components
 *
 * @param   {object} ssrContext Server SSR context object
 * @param   {object} app        App instance
 * @param   {object} router     Router instance
 * @param   {object} store      Vuex store instance
 * @param   {object} opts                 Additional options
 * @param   {object} opts.middleware      Function to execute before fetchData
 * @param   {object} opts.postMiddleware  Function to execute after fetchData
 * @returns {undefined}         No return value
 */
export async function useFetchDataServer(ssrContext, app, router, store, opts) {
    const route = router.currentRoute;
    const fetchDataArgs = getFetchDataArgs(ssrContext, app, router, store, route);
    const components = router.getMatchedComponents(route);
    console.log(`Matched components for ${JSON.stringify(route)}: ${JSON.stringify(components)}`);
    if (opts && opts.middleware) {
        await opts.middleware(fetchDataArgs);
    }
    await Promise.all([
        opts && opts.globalFetchData && opts.globalFetchData(fetchDataArgs),
        ...components.map(c => c.fetchData && c.fetchData(fetchDataArgs)),
    ]);
    if (opts && opts.postMiddleware) {
        await opts.postMiddleware(fetchDataArgs);
    }
}

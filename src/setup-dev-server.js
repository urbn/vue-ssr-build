/* eslint-disable no-console */

const fs = require('fs');

/* eslint-disable import/no-extraneous-dependencies */
const MFS = require('memory-fs');
const webpack = require('webpack');
const chokidar = require('chokidar');
const webpackHotMiddleware = require('webpack-hot-middleware');
const webpackDevMiddleware = require('webpack-dev-middleware');
/* eslint-enable import/no-extraneous-dependencies */

module.exports = function setupDevServer(app, config, cb) {
    const mfs = new MFS();
    let serverBundle;
    let template;
    let clientManifest;
    let ready;

    /* eslint-disable global-require, import/no-dynamic-require */
    const clientConfig = require(config.clientConfig);
    const serverConfig = require(config.serverConfig);
    /* eslint-enable global-require, import/no-dynamic-require */

    const readyPromise = new Promise((r) => { ready = r; });
    const update = () => {
        if (serverBundle && clientManifest) {
            ready({ clientManifest });
            cb(serverBundle, {
                template,
                clientManifest,
            });
        }
    };

    // read template from disk and watch
    template = fs.readFileSync(config.templatePath, 'utf-8');
    chokidar.watch(config.templatePath).on('change', () => {
        console.error('Template file updated');
        template = fs.readFileSync(config.templatePath, 'utf-8');
        update();
    });

    // modify client config to work with hot middleware
    clientConfig.entry.app = [
        'webpack-hot-middleware/client',
        clientConfig.entry.app,
    ];
    clientConfig.output.filename = '[name].js';
    clientConfig.plugins.push(
        new webpack.HotModuleReplacementPlugin(),
        new webpack.NoEmitOnErrorsPlugin(),
    );

    // Launch the client webpack build and update with the clientManifest
    console.log('Launching client webpack build');
    const clientCompiler = webpack(clientConfig);
    app.use(webpackDevMiddleware(clientCompiler, { outputFileSystem: mfs }));
    app.use(webpackHotMiddleware(clientCompiler, { heartbeat: 5000 }));

    clientCompiler.hooks.done.tap('setup-dev-server', (stats) => {
        console.log('Completed client webpack build');
        if (stats.toJson().errors.length) {
            return;
        }

        // Update the manifest for the app
        clientManifest = JSON.parse(mfs.readFileSync(config.clientManifest, 'utf-8'));
        update();
    });

    // Launch the server webpack build and update with the serverBundle
    console.log('Launching server webpack build');
    const serverCompiler = webpack(serverConfig);
    serverCompiler.outputFileSystem = mfs;
    serverCompiler.watch({}, (err, stats) => {
        console.log('Completed server webpack build');
        if (err) {
            throw err;
        }

        if (stats.toJson().errors.length) {
            return;
        }

        // Update the server bundle for the app
        serverBundle = JSON.parse(mfs.readFileSync(config.serverBundle, 'utf-8'));
        update();
    });

    return readyPromise;
};

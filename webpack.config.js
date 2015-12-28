'use strict';


var webpack = require('webpack');

module.exports = {
    context: __dirname + '/src',
    entry: './index.js',
    output: {
        path: __dirname + '/dist',
        filename: 'my-angular.js'
    },

    plugins: [
        new webpack.DefinePlugin({
            TEST: process.env.NODE_ENV === 'test'
        })
    ],

    module: {
        loaders: [
            {test: /\.js$/, loader: 'babel-loader', exclude: /node_modules/}
        ]
    }
};
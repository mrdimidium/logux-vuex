const { resolve } = require('path');

module.exports = {
    context: resolve('source'),

    entry: './index',

    output: {
        path: resolve('public', 'dist'),
        publicPath: '/dist/',
        filename: 'bundle.js',
    },

    module: {
        rules: [
            {
                test: /\.vue$/,
                use: ['vue-loader']
            },
            {
                test: /\.(css|pcss)$/,
                include: [/source/],
                use: ['vue-style-loader']
            }
        ]
    },

    devServer: {
        contentBase: ['public'],
    },
};

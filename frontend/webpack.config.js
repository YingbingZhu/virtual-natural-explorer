const path = require('path');
const Dotenv = require('dotenv-webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    quiz: './src/js/quiz.js',
    ecosystem: './src/js/ecosystem.js',
    logbook: './src/js/logbook.js',
    index: './src/js/index.js',
    'videos-stories': './src/js/videos-stories.js', 
  },
  output: {
    filename: 'js/[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        type: 'asset/resource',
      }
    ],
  },
  plugins: [
    new Dotenv(),
      ...['index', 'quiz', 'ecosystem', 'logbook', 'videos-stories'].map(name => new HtmlWebpackPlugin({
        filename: `${name}.html`,
        template: `./public/${name}.html`,
        chunks: [name],
      })),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/assets/data', to: 'data' },
        { from: 'src/assets/images', to: 'images' }
      ],
    }),
  ],
  devServer: {
    static: path.join(__dirname, 'dist'),
    port: 3400,
    open: true,
  },
};

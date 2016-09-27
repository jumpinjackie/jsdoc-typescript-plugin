# jsdoc-typescript-plugin

[![Build Status](https://travis-ci.org/jumpinjackie/jsdoc-typescript-plugin.svg)](https://travis-ci.org/jumpinjackie/jsdoc-typescript-plugin)

JSDoc plugin to automatically generate TypeScript Definitions from annotated source

# Building

    npm install
    npm run-script tsc

The compiled plugin will reside under `plugins/typescript.js`

# Using the plugin

Add the following snippet to your JSDoc configuration

```json
{ "plugins": [ "plugins/typescript.js" ] }
```

Refer to configuration for plugin configuration options

# Configuration

TBD
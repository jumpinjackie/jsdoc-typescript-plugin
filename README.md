# No longer maintained

When I started this project, I had the lofty goal of a generic `d.ts` typings generator that works off of JSDoc annotations for *any* plain JS project.

In reality, this project had a singular purpose: To generate a 100% coverage TypeScript definition file for the [OpenLayers](https://openlayers.org/) library. This project had fulfilled this singular purpose very well up to the latest 4.x release (4.6.5).

OpenLayers afterwards had changed their module structure to the point that this plugin no longer was able to generate a suitable TypeScript definition. Given there are competing efforts that have made better inroads than I have in this regard, I am no longer maintaining this project and have archived this repository.

If you are after TypeScript support for OpenLayers 5.x and newer, see:

 * [https://github.com/hanreev/types-ol](https://github.com/hanreev/types-ol)
 * [The tracking issue for official TypeScript support](https://github.com/openlayers/openlayers/issues/8120)

Otherwise, feel free to fork this repo and see what you can do with the code. Good luck!

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
{ "plugins": [ "plugins/typescript" ] }
```

Refer to configuration for plugin configuration options

# Configuration

TBD

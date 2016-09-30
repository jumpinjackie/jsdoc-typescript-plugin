/// <reference path="../typings/cesium.d.ts" />

// Current baseline: Cesium 1.25

import Cesium = require("cesium");

var viewer = new Cesium.Viewer('cesiumContainer');
var source = new Cesium.GeoJsonDataSource("name123");
viewer.dataSources.add(source);

source.load({
    type: "FeatureCollection",
    crs: {
        type: "name",
        properties: {
            name: "urn:ogc:def:crs:OGC:1.3:CRS84"
        }
    },
    features: [{
        type: "Feature",
        properties: {
            foo: 123,
        },
        geometry: {
            type: "Point",
            coordinates: [0.1275, 51.5072] // London
        },
        id: "123"
    }]
});
    
// source.entities.removeAll();

// sometime later...
source.load({
    type: "FeatureCollection",
    crs: {
        type: "name",
        properties: {
            name: "urn:ogc:def:crs:OGC:1.3:CRS84"
        }
    },
    features: [{
        type: "Feature",
        properties: {
            foo: 456,
        },
        geometry: {
            type: "Point",
            coordinates: [-75.1890, 42.3482] // New York
        },
        id: "123"
    }]
});
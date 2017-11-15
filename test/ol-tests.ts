/// <reference path="../typings/openlayers.d.ts" />

// This tests the ES2015 module definitions in openlayers.d.ts

// Current baseline: OpenLayers 4.0.1

// Based on sample from: https://www.npmjs.com/package/ol/
import Map from 'ol/map';
import View from 'ol/view';
import Feature from 'ol/feature';

import TileLayer from 'ol/layer/tile';
import LayerBase from 'ol/layer/base';
import VectorLayer from 'ol/layer/vector';
import VectorTileLayer from 'ol/layer/vectortile';
import ImageLayer from 'ol/layer/image';
import HeatmapLayer from 'ol/layer/heatmap';

import Control from 'ol/control/control';
import AttributionControl from 'ol/control/attribution';
import FullScreenControl from 'ol/control/fullscreen';
import MousePositionControl from 'ol/control/mouseposition';
import OverviewMapControl from 'ol/control/overviewmap';
import RotateControl from 'ol/control/rotate';
import ScaleLineControl from 'ol/control/scaleline';
import ZoomControl from 'ol/control/zoom';
import ZoomSliderControl from 'ol/control/zoomslider';
import ZoomExtentControl from 'ol/control/zoomtoextent';

import Geometry from 'ol/geom/geometry';
import SimpleGeometry from 'ol/geom/simplegeometry';
import Circle from 'ol/geom/circle';
import GeometryCollection from 'ol/geom/geometrycollection';
import MultiLineString from 'ol/geom/multilinestring';
import MultiPoint from 'ol/geom/multipoint';
import Point from 'ol/geom/point';
import MultiPolygon from 'ol/geom/multipolygon';
import Polygon from 'ol/geom/polygon';

import Interaction from 'ol/interaction/interaction';
import DoubleClickZoom from 'ol/interaction/doubleclickzoom';
import DragAndDrop from 'ol/interaction/draganddrop';
import DragBox from 'ol/interaction/dragbox';
import Pointer from 'ol/interaction/pointer';
import DragPan from 'ol/interaction/dragpan';
import DragRotate from 'ol/interaction/dragrotate';
import DragRotateAndZoom from 'ol/interaction/dragrotateandzoom';
import DragZoom from 'ol/interaction/dragzoom';
import Draw from 'ol/interaction/draw';
import Extent from 'ol/interaction/extent';
import KeyboardPan from 'ol/interaction/keyboardpan';
import KeyboardZoom from 'ol/interaction/keyboardzoom';
import Modify from 'ol/interaction/modify';
import MouseWheelZoom from 'ol/interaction/mousewheelzoom';
import PinchRotate from 'ol/interaction/pinchrotate';
import PinchZoom from 'ol/interaction/pinchzoom';
import Select from 'ol/interaction/select';

import Source from 'ol/source/source';
import BingMaps from 'ol/source/bingmaps';
import CartoDB from 'ol/source/cartodb';
import Cluster from 'ol/source/cluster';
import ImageArcGISRest from 'ol/source/imagearcgisrest';
import ImageCanvas from 'ol/source/imagecanvas';
import ImageMapGuide from 'ol/source/imagemapguide';
import ImageStatic from 'ol/source/imagestatic';
import ImageVector from 'ol/source/imagevector';
import ImageWMS from 'ol/source/imagewms';
import OSM from 'ol/source/osm';
import Raster from 'ol/source/raster';
import Stamen from 'ol/source/stamen';
import TileImage from 'ol/source/tileimage';
import TileArcGISRest from 'ol/source/tilearcgisrest';
import TileDebug from 'ol/source/tiledebug';
import TileJSON from 'ol/source/tilejson';
import TileUTFGrid from 'ol/source/tileutfgrid';
import TileWMS from 'ol/source/tilewms';
import Vector from 'ol/source/vector';
import VectorTile from 'ol/source/vectortile';
import WMTS from 'ol/source/wmts';
import Zoomify from 'ol/source/zoomify';
import XYZ from 'ol/source/xyz';

import TileGrid from 'ol/tilegrid/tilegrid';
import WMTSTileGrid from 'ol/tilegrid/wmts';

import Collection from 'ol/collection';

import olXml from 'ol/xml';
import olProj from 'ol/proj';
import olExtent from 'ol/extent';

const map = new Map({
  target: 'map',
  layers: [
    new TileLayer({
      source: new XYZ({
        url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      })
    })
  ],
  view: new View({
    center: [0, 0],
    zoom: 2
  })
});

const view = map.getView();
view.fit([-180.0, -90.0, 180.0, 90.0]);

const layers = new Collection<LayerBase>();
layers.push(new ImageLayer());
layers.push(new TileLayer());
layers.push(new VectorLayer());
layers.push(new VectorTileLayer());
layers.push(new HeatmapLayer());

layers.forEach((layer) => {
    map.addLayer(layer);
});

const geometries = new Collection<Geometry>();
geometries.push(new SimpleGeometry());
geometries.push(new Circle([1, 1], 2));
geometries.push(new GeometryCollection());
geometries.push(new MultiLineString([]));
geometries.push(new MultiPoint([]));
geometries.push(new Point([1, 1]));
geometries.push(new MultiPolygon([]));
geometries.push(new Polygon([]));

const controls = new Collection<Control>();
controls.push(new AttributionControl());
controls.push(new FullScreenControl());
controls.push(new MousePositionControl());
controls.push(new OverviewMapControl());
controls.push(new RotateControl());
controls.push(new ScaleLineControl());
controls.push(new ZoomControl());
controls.push(new ZoomSliderControl());
controls.push(new ZoomExtentControl());

controls.forEach((ctrl) => {
    map.addControl(ctrl);
});

const features = new Collection<Feature>();

const inter = new Collection<Interaction>();
inter.push(new DoubleClickZoom());
inter.push(new DragAndDrop());
inter.push(new DragBox());
inter.push(new Pointer());
inter.push(new DragPan());
inter.push(new DragRotate());
inter.push(new DragRotateAndZoom());
inter.push(new DragZoom());
inter.push(new Draw({
    type: "Point"
}));
inter.push(new Extent());
inter.push(new KeyboardPan());
inter.push(new KeyboardZoom());
inter.push(new Modify({
    features: features
}));
inter.push(new MouseWheelZoom());
inter.push(new PinchRotate());
inter.push(new PinchZoom());
inter.push(new Select());

const sources = new Collection<Source>();
sources.push(new BingMaps({
    key: "abcd1234",
    imagerySet: "satellite"
}));
sources.push(new TileImage({}));
sources.push(new CartoDB({
    account: "test"
}));
sources.push(new XYZ());
sources.push(new Cluster({
    source: new Vector()
}));
sources.push(new ImageArcGISRest());
sources.push(new ImageCanvas({
    canvasFunction: () => null
}));
sources.push(new ImageMapGuide({}));
sources.push(new ImageStatic({
    imageExtent: [-180.0, -90.0, 180.0, 90.0],
    projection: "EPSG:4326",
    url: "adsjfdsf"
}));
sources.push(new ImageVector({
    source: new Vector()
}));
sources.push(new ImageWMS());
sources.push(new OSM());
sources.push(new Raster({
    sources: sources.getArray()
}));
sources.push(new Stamen({
    layer: "toner"
}));
sources.push(new TileArcGISRest());
sources.push(new TileDebug({}));
sources.push(new TileJSON({
    url: "asdjkdf"
}));
sources.push(new TileUTFGrid({}));
sources.push(new TileWMS());
sources.push(new VectorTile({}));
sources.push(new WMTS({
    tileGrid: new WMTSTileGrid({
        resolutions: [],
        matrixIds: []
    }),
    projection: "EPSG:4326",
    layer: "blah",
    style: "default",
    matrixSet: "thereisnospoon"
}));
sources.push(new Zoomify());

olXml.parse("<Foo>Bar</Foo>");
const tx = olProj.fromLonLat([0, 0]);
const center = olExtent.getCenter([1, 2, 3, 4]);
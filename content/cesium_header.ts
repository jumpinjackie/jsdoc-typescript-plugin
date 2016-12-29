// Type definitions for Cesium v1.27
// Project: https://cesiumjs.org
// Definitions by: Jackie Ng <https://github.com/jumpinjackie>
// Definitions: https://github.com/borisyankov/DefinitelyTyped

//
// This file is automatically generated by jsdoc-typescript-plugin (https://github.com/jumpinjackie/jsdoc-typescript-plugin). 
//
// Do not edit this file unless you know what you're doing. Where possible, consult the plugin documentation for options to
// augment and customize the content of this generated file
//

declare module Cesium {

    type CanvasPixelArray = any[];

    /**
     * Cesium's internal copy of knockout.js
     */
    const knockout: any; //TODO: Should probably link to knockout d.ts 
    /**
     * Cesium's internal copy of when.js
     */
    const when: any; //TODO: If there's a typings for this, we should be linking against it

    /**
     * Type alias for a promise
     */
    type Promise<T> = PromiseLike<T>;
    
    type TypedArray = any[];
    
    type Packable = any;
    
    type Proxy = any;
    
    type Context = any;
    
    type Frustum = any;
    
    type DrawCommand = any;

    // ========== These types are not supposed to be public, but the plugin is leaking them out at the moment ========== //
    
    type BufferUsage = any;

    type VertexBuffer = any;

    type IndexBuffer = any;

    type ShaderProgram = any;

    type ShaderSource = any;

    type IauOrientationParameters = any;

    type HMDVRDevice = any;

    type Rotation = any;

    type Framebuffer = any;

    type ClearCommand = any;

    type VertexArray = any;

    type Texture = any;

    type Pass = any;

    type CubeMap = any;

    type MipmapHint = any;

    type PassState = any;

    type Tile = any;

    type TileReplacementQueue = any;
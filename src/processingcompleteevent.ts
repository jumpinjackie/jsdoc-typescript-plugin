/// <reference path="./doclet.ts" />

module TsdPlugin {
    /**
     * The event passed on a JsDoc processingComplete event
     */
    export interface IJsDocProcessingCompleteEvent {
        /**
         * The processed doclets
         */
        doclets: IDoclet[];
    }
}
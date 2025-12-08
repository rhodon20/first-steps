        // =============================================
        // 1. SISTEMA CORE Y STORAGE
        // =============================================
        const SafeStorage={isAvailable:!1,init:function(){try{let e="__test__";localStorage.setItem(e,e),localStorage.removeItem(e),this.isAvailable=!0}catch(e){console.warn("Storage disabled")}},save:function(e,t){this.isAvailable&&localStorage.setItem(e,t)},load:function(e){return this.isAvailable?localStorage.getItem(e):null},clear:function(e){this.isAvailable&&localStorage.removeItem(e)}};SafeStorage.init();

        const CITIES = [{n:"Madrid",c:[40.416,-3.703]},{n:"Barcelona",c:[41.385,2.173]},{n:"Valencia",c:[39.469,-0.376]},{n:"Sevilla",c:[37.389,-5.984]}];
        let layerControl; 
        let currentNodeId = null;
        let currentRunTimestamp = 0; // Para el control de estado (verde/naranja)

        const ensureFC = (geo) => {
            if (!geo) return turf.featureCollection([]);
            if (geo.type === 'FeatureCollection') return geo;
            if (geo.type === 'Feature') return turf.featureCollection([geo]);
            if (geo.type === 'GeometryCollection') return turf.featureCollection(geo.geometries.map(g => turf.feature(g)));
            return turf.featureCollection([turf.feature(geo)]);
        };
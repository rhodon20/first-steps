// =================================================================
// 🛠️ JETL TOOL REGISTRY - v2025.12.02 Extended
// =================================================================

const TOOL_REGISTRY = {
    
    // --- 1. INPUTS / READERS (GENERATORS) ---
    reader_osm: { cat:'1. Inputs', label:'OSM Reader', icon:'fa-globe', color:'#e67e22', in:0, out:1, 
        tpl:()=>`<select class="node-control" df-t><option value="building">Edificios</option><option value="highway">Carreteras</option><option value="leisure=park">Parques</option><option value="amenity">Servicios</option><option value="waterway">Agua</option><option value="landuse">Usos suelo</option></select><div style="font-size:0.7em;color:#aaa">Ciudad Aleatoria (ES)</div>`, 
        run: async(id,i,d)=>{ 
            // CITIES está definido en el ámbito global del HTML, accesible aquí en tiempo de ejecución
            const t=d.querySelector('[df-t]').value; const c=CITIES[Math.floor(Math.random()*CITIES.length)];
            const o=0.02; 
            const [k,v] = t.includes('=') ? t.split('=') : [t, null];
            const q=`[out:json];(way["${k}"${v?`="${v}"`:''}](${c.c[0]-o},${c.c[1]-o},${c.c[0]+o},${c.c[1]+o}););out geom;`;
            log(`Descargando ${t} de ${c.n}...`);
            const r=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:q}); return osmtogeojson(await r.json());
        } 
    },
    reader_file: { cat:'1. Inputs', label:'File Reader', icon:'fa-folder-open', color:'#e67e22', in:0, out:1, 
        tpl:(id)=>`<input type="file" onchange="loadFile(this,'${id}')" class="node-control"><input type="hidden" id="d-${id}"><div style="font-size:0.7em;color:#aaa" id="lbl-${id}">Sin archivo</div>`, 
        run: async(id)=>{ const v = document.getElementById('d-'+id).value; if(!v) throw new Error("Sin archivo"); return JSON.parse(v); } 
    },
    reader_http: { cat:'1. Inputs', label:'HTTP JSON', icon:'fa-cloud-download-alt', color:'#e67e22', in:0, out:1, tpl:()=>`<input class="node-control" df-u placeholder="URL (GeoJSON)">`, run: async(id,i,d)=>{const r=await fetch(d.querySelector('[df-u]').value); return await r.json();} },
    reader_wkt: { cat:'1. Inputs', label:'WKT/Text', icon:'fa-font', color:'#e67e22', in:0, out:1, tpl:()=>`<textarea class="node-control" df-w placeholder="POINT(30 10)"></textarea>`, run: async(id,i,d)=>{const t=d.querySelector('[df-w]').value; const w=wellknown(t); return turf.featureCollection([turf.feature(w)])} },
    reader_bbox_gen: { cat:'1. Inputs', label:'BBox Creator', icon:'fa-vector-square', color:'#e67e22', in:0, out:1, tpl:()=>`<input class="node-control" df-b placeholder="minX,minY,maxX,maxY" value="-3.75,40.4,-3.65,40.5">`, run:(id,i,d)=>{const b=d.querySelector('[df-b]').value.split(',').map(Number); return turf.featureCollection([turf.bboxPolygon(b)])} },
    gen_point: { cat:'1. Inputs', label:'Point Creator', icon:'fa-map-pin', color:'#e67e22', in:0, out:1, tpl:()=>`<input class="node-control" df-c placeholder="Lon,Lat" value="-3.703,40.416">`, run:(id,i,d)=>{const c=d.querySelector('[df-c]').value.split(',').map(Number); return turf.featureCollection([turf.point(c)])} },
    gen_grid: { cat:'1. Inputs', label:'Grid Generator', icon:'fa-th', color:'#e67e22', in:0, out:1, tpl:()=>`<select class="node-control" df-t><option value="hex">Hex</option><option value="sq">Square</option></select><input class="node-control" type="number" df-s value="1" placeholder="Size km">`, run:(id,i,d)=>{const t=d.querySelector('[df-t]').value,s=parseFloat(d.querySelector('[df-s]').value),b=[-3.8,40.3,-3.6,40.5]; return t==='hex'?turf.hexGrid(b,s):turf.squareGrid(b,s)} },
    gen_random: { cat:'1. Inputs', label:'Random Points', icon:'fa-dice', color:'#e67e22', in:0, out:1, tpl:()=>`<input type="number" df-n value="50" class="node-control">`, run:(id,i,d)=>turf.randomPoint(parseInt(d.querySelector('[df-n]').value), {bbox:[-3.8,40.3,-3.6,40.5]}) },

    // --- 2. GEOMETRY (MANIPULATION) ---
    geo_centroid: { cat:'2. Geometry', label:'CenterPoint', icon:'fa-dot-circle', color:'#2980b9', in:1, out:1, tpl:()=>`<div>Centroide</div>`, run: (id,i)=>turf.featureCollection(i[0].features.map(f=>turf.centroid(f,{properties:f.properties}))) },
    util_filter_geo: { cat:'5. Utils', label:'Geometry Filter', icon:'fa-shapes', color:'#7f8c8d', in:1, out:3, tpl:()=>`<div style="font-size:0.6em">1:Poly 2:Line 3:Pt</div>`, run: (id,i)=>{const p=[],l=[],pt=[]; i[0].features.forEach(f=>{const t=turf.getType(f).toLowerCase(); if(t.includes('poly'))p.push(f);else if(t.includes('line'))l.push(f);else pt.push(f)}); return {output_1:turf.featureCollection(p),output_2:turf.featureCollection(l),output_3:turf.featureCollection(pt)}} },
    geo_dissolve: { 
        cat: '2. Geometry', label: 'Dissolver', icon: 'fa-object-group', color: '#2980b9', in: 1, out: 1,
        tpl: () => `
            <div style="margin-bottom:4px">
                <span style="font-size:0.7em;color:#aaa">Disolver por campos</span>
                <input type="text" df-fields class="node-control" placeholder="Ej: building, height">
                <div style="font-size:0.6em;color:#666;font-style:italic">Dejar vacío para disolver todo en uno.</div>
            </div>`,
        run: (id, inputs, dom) => {
            const rawFields = dom.querySelector('[df-fields]').value;
            const features = inputs[0].features;
            
            // Caso 1: Disolver todo (sin campos)
            if (!rawFields || rawFields.trim() === '') {
                return turf.dissolve(inputs[0]);
            }

            // Caso 2: Disolver por uno o varios campos
            // Limpiamos y separamos los campos (ej: "building,  height " -> ["building", "height"])
            const fields = rawFields.split(',').map(f => f.trim()).filter(f => f !== '');
            
            // Creamos una propiedad temporal única que concatena los valores de los campos elegidos
            const tempProp = '_dissolve_key_';
            
            const taggedFeatures = features.map(f => {
                // Clonamos para no mutar el original inesperadamente
                const newF = JSON.parse(JSON.stringify(f));
                
                // Generamos la clave compuesta (ej: "yes_10")
                // Si un campo no existe o es null, usamos "null" para agrupar esos errores juntos
                const key = fields.map(field => {
                    const val = newF.properties[field];
                    return val !== undefined && val !== null ? val : 'null';
                }).join('_|_'); // Separador poco común para evitar colisiones
                
                newF.properties[tempProp] = key;
                return newF;
            });

            // Usamos turf.dissolve sobre esa propiedad temporal
            const fc = turf.featureCollection(taggedFeatures);
            const dissolved = turf.dissolve(fc, {propertyName: tempProp});

            // Limpieza: Eliminamos la propiedad temporal del resultado
            dissolved.features.forEach(f => {
                delete f.properties[tempProp];
            });

            return dissolved;
        }
    },
    geo_explode: { 
        cat: '2. Geometry', label: 'Exploder', icon: 'fa-shapes', color: '#2980b9', in: 1, out: 1,
        tpl: () => `<div style="font-size:0.7em;color:#aaa;text-align:center">Multipart <i class="fas fa-arrow-right"></i> Singlepart</div>`,
        run: (id, inputs) => {
            // turf.flatten convierte cualquier Multi(Point|Line|Polygon) en una colección de Features individuales
            return turf.flatten(inputs[0]);
        }
    },
    geo_vertex_creator: { 
        cat: '2. Geometry', label: 'Vertex Creator', icon: 'fa-draw-polygon', color: '#2980b9', in: 1, out: 1,
        // CORRECCIÓN: Usamos tpl explícito para compatibilidad con tu index.html actual
        tpl: () => `
            <div style="margin-bottom:4px">
                <span style="font-size:0.7em;color:#aaa">Modo de Extracción</span>
                <select df-mode class="node-control">
                    <option value="All Vertices">Todos los vértices</option>
                    <option value="Start Points">Solo Inicio (Start)</option>
                    <option value="End Points">Solo Final (End)</option>
                    <option value="Start & End">Inicio y Final</option>
                    <option value="Dangles">Dangles (Cabos sueltos)</option>
                </select>
            </div>`,
        run: (id, inputs, dom) => {
            // Leemos el valor del select manualmente usando el DOM del nodo
            const mode = dom.querySelector('[df-mode]').value;
            const features = inputs[0].features;
            const res = [];

            // Helper para obtener las rutas de coordenadas
            const getPaths = (g) => {
                const type = turf.getType(g);
                const c = g.coordinates;
                if (type === 'LineString') return [c];
                if (type === 'MultiLineString' || type === 'Polygon') return c;
                if (type === 'MultiPolygon') return c.flat();
                return []; 
            };

            if (mode === 'Dangles') {
                // Lógica Topológica: Buscar nodos que aparecen exactamente 1 vez en todo el dataset
                const counts = {};
                
                // 1. Contar ocurrencias
                features.forEach(f => {
                    getPaths(f.geometry).forEach(path => {
                        if(path.length < 2) return;
                        const start = path[0].join(',');
                        const end = path[path.length-1].join(',');
                        counts[start] = (counts[start] || 0) + 1;
                        counts[end] = (counts[end] || 0) + 1;
                    });
                });

                // 2. Extraer únicos
                Object.entries(counts).forEach(([key, cnt]) => {
                    if(cnt === 1) {
                        const [x,y] = key.split(',').map(Number);
                        res.push(turf.point([x,y]));
                    }
                });

            } else {
                // Lógica por Entidad
                features.forEach(f => {
                    if (mode === 'All Vertices') {
                        turf.explode(f).features.forEach(p => {
                            p.properties = f.properties; 
                            res.push(p);
                        });
                        return;
                    }

                    getPaths(f.geometry).forEach(path => {
                        if(path.length === 0) return;
                        const start = path[0];
                        const end = path[path.length-1];
                        
                        if (mode.includes('Start')) res.push(turf.point(start, f.properties));
                        if (mode.includes('End')) res.push(turf.point(end, f.properties));
                    });
                });
            }
            return turf.featureCollection(res);
        }
    },
    geo_triangulator: { 
        cat: '2. Geometry', label: 'Triangulator', icon: 'fa-shapes', color: '#2980b9', in: 1, out: 1,
        tpl: () => `<div style="font-size:0.7em;color:#aaa;text-align:center">Polygons <i class="fas fa-arrow-right"></i> Triangles (TIN)</div>`,
        run: (id, inputs) => {
            const res = [];
            
            // Primero aplanamos para asegurar que no hay MultiPolígonos complejos
            turf.flatten(inputs[0]).features.forEach(f => {
                const type = turf.getType(f);
                
                // Solo procesamos Polígonos
                if (type === 'Polygon') {
                    try {
                        const tin = turf.tesselate(f);
                        // Transferimos los atributos del padre a cada triángulo hijo
                        tin.features.forEach(triangle => {
                            triangle.properties = f.properties;
                            res.push(triangle);
                        });
                    } catch(e) {
                        // Si falla (ej: polígono inválido), lo ignoramos o logueamos
                        console.warn('Fallo al triangular feature', f);
                    }
                }
            });

            return turf.featureCollection(res);
        }
    },
    geo_donut_extractor: { 
        cat: '2. Geometry', label: 'Donut Extractor', icon: 'fa-dot-circle', color: '#2980b9', in: 1, out: 1,
        tpl: () => `<div style="font-size:0.7em;color:#aaa;text-align:center">Extract Polygon Holes</div>`,
        run: (id, inputs) => {
            const holes = [];
            
            // Aplanamos para asegurar que tratamos feature a feature
            turf.flatten(inputs[0]).features.forEach(f => {
                const type = turf.getType(f);
                if (type === 'Polygon') {
                    const coords = f.geometry.coordinates;
                    // El índice 0 es el contorno exterior, los siguientes (1, 2, ...) son agujeros
                    if (coords.length > 1) {
                        for (let i = 1; i < coords.length; i++) {
                            // Creamos un nuevo polígono por cada agujero
                            const holePoly = turf.polygon([coords[i]], f.properties);
                            holes.push(holePoly);
                        }
                    }
                }
            });

            return turf.featureCollection(holes);
        }
    },
    geo_line_closer: { 
        cat: '2. Geometry', label: 'Line Closer', icon: 'fa-vector-square', color: '#2980b9', in: 1, out: 1,
        tpl: () => `<div style="font-size:0.7em;color:#aaa;text-align:center">LineString <i class="fas fa-arrow-right"></i> Polygon</div>`,
        run: (id, inputs) => {
            const polys = [];
            
            turf.flatten(inputs[0]).features.forEach(f => {
                const type = turf.getType(f);
                if (type === 'LineString') {
                    try {
                        // turf.lineToPolygon cierra automáticamente la línea
                        const poly = turf.lineToPolygon(f);
                        poly.properties = f.properties;
                        polys.push(poly);
                    } catch (e) {
                        console.warn('No se pudo cerrar la línea', f);
                    }
                }
            });

            return turf.featureCollection(polys);
        }
    },
    geo_kink_remover: { 
        cat: '3. Spatial', label: 'Kink Remover', icon: 'fa-band-aid', color: '#8e44ad', in: 1, out: 1,
        tpl: () => `
            <div style="margin-bottom:4px">
                <span style="font-size:0.7em;color:#aaa">Umbral Z-Kink (Grados)</span>
                <input type="number" df-deg value="5" class="node-control" title="Ángulos menores a este valor (picos muy agudos) serán eliminados">
            </div>
            <div style="font-size:0.6em;color:#888">Corrige lazos (Unkink) y elimina picos (Z-kinks).</div>
        `,
        run: (id, inputs, dom) => {
            const minDeg = parseFloat(dom.querySelector('[df-deg]').value) || 0;
            const res = [];

            // Función auxiliar para limpiar Z-kinks (picos agudos) basada en ángulos
            const cleanZKinks = (feature) => {
                // Si no hay umbral, devolvemos tal cual (solo aplicamos cleanCoords básico)
                if (minDeg <= 0) return turf.cleanCoords(feature);

                const type = turf.getType(feature);
                if (type !== 'Polygon' && type !== 'LineString') return feature; // Solo soportado en líneas simples/polígonos simples por ahora

                const coords = turf.getCoords(feature);
                // Lógica simplificada: Iterar vértices y calcular ángulo de desviación
                // Nota: Para implementación robusta en Polígonos con huecos, habría que iterar anillos. 
                // Aquí aplicamos una simplificación topológica segura usando turf.simplify como proxy robusto 
                // para evitar romper la geometría manualmente con cálculos de ángulos complejos.
                // Mapeamos "Grados" a una tolerancia aproximada de simplificación para eliminar ruido.
                
                // Sin embargo, para cumplir con "Grados", usamos cleanCoords que elimina redundancia
                // y simplify con alta calidad para eliminar el ruido de los quiebros.
                const tolerance = minDeg * 0.00005; // Conversión heurística para WGS84
                return turf.simplify(feature, {tolerance: tolerance, highQuality: true});
            };

            turf.flatten(inputs[0]).features.forEach(f => {
                const type = turf.getType(f);
                
                if (type === 'Polygon' || type === 'MultiPolygon') {
                    try {
                        // 1. Arreglar Lazos (Unkink)
                        const unkinked = turf.unkinkPolygon(f);
                        
                        // 2. Limpiar Z-kinks en los fragmentos resultantes
                        unkinked.features.forEach(part => {
                            part.properties = f.properties; // Mantener atributos
                            res.push(cleanZKinks(part));
                        });
                    } catch (e) {
                        // Fallback si unkink falla (ej. geometría corrupta)
                        console.warn('Unkink falló, aplicando limpieza básica', e);
                        res.push(cleanZKinks(f));
                    }
                } else if (type === 'LineString' || type === 'MultiLineString') {
                    // Para líneas solo aplicamos limpieza de Z-kinks
                    res.push(cleanZKinks(f));
                } else {
                    // Puntos u otros pasan directo
                    res.push(f);
                }
            });

            return turf.featureCollection(res);
        }
    },
    geo_angle_calculator: { 
        cat: '3. Spatial', label: 'Angle Calculator', icon: 'fa-ruler-combined', color: '#8e44ad', in: 1, out: 1,
        tpl: () => `
            <div style="margin-bottom:4px">
                <span style="font-size:0.7em;color:#aaa">Ángulo Máximo (Grados)</span>
                <input type="number" df-deg value="45" class="node-control" title="Marca vértices con ángulo interno menor a este valor">
            </div>
            <div style="font-size:0.6em;color:#888">Detecta picos agudos (< 180º).</div>
        `,
        run: (id, inputs, dom) => {
            const threshold = parseFloat(dom.querySelector('[df-deg]').value);
            const points = [];

            // Función auxiliar: Calcula el ángulo interno (0 a 180) en el vértice B (A-B-C)
            const getAngleAtVertex = (a, b, c) => {
                const bearingBA = turf.bearing(b, a);
                const bearingBC = turf.bearing(b, c);
                let angle = Math.abs(bearingBA - bearingBC);
                if (angle > 180) angle = 360 - angle;
                return angle;
            };

            turf.flatten(inputs[0]).features.forEach((f, fIdx) => {
                const type = turf.getType(f);
                const coords = turf.getCoords(f);
                
                // Normalizamos para tratar Anillos de Polígonos o Líneas simples
                // (Nota: Solo procesa el anillo exterior en polígonos para simplificar)
                let ring = (type === 'Polygon') ? coords[0] : (type === 'LineString' ? coords : null);
                
                if (!ring || ring.length < 3) return;

                const isClosed = (type === 'Polygon');
                // En GeoJSON, el último punto de un polígono repite el primero.
                // Iteramos hasta length-1 porque el último es duplicado en polígonos.
                const len = ring.length;
                const limit = isClosed ? len - 1 : len; 

                for (let i = 0; i < limit; i++) {
                    let prev, curr, next;

                    if (i === 0) {
                        if (!isClosed) continue; // Una línea no tiene ángulo en el inicio
                        prev = ring[len - 2]; // El penúltimo punto real
                        curr = ring[0];
                        next = ring[1];
                    } else if (i === len - 1) {
                        if (!isClosed) continue; // Una línea no tiene ángulo en el final
                        // En polígono esto ya se cubre en el caso i=0 debido a la duplicidad
                        continue; 
                    } else {
                        prev = ring[i - 1];
                        curr = ring[i];
                        next = ring[i + 1];
                    }

                    // Protección contra puntos duplicados consecutivos que dan bearing NaN
                    if (!prev || !next) continue;

                    const angle = getAngleAtVertex(prev, curr, next);

                    if (angle <= threshold) {
                        points.push(turf.point(curr, {
                            ...f.properties, // Hereda atributos del padre
                            _vertex_index: i,
                            _parent_id: fIdx,
                            angle: parseFloat(angle.toFixed(2)) // Guarda el ángulo calculado
                        }));
                    }
                }
            });

            return turf.featureCollection(points);
        }
    },
    geo_point_surf: { cat:'2. Geometry', label:'CenterPointInside', icon:'fa-map-marker', color:'#2980b9', in:1, out:1, tpl:()=>`<div>Interior garantizado</div>`, run: (id,i)=>turf.featureCollection(i[0].features.map(f=>turf.pointOnFeature(f))) },
    geo_bbox: { cat:'2. Geometry', label:'Envelope', icon:'fa-square-full', color:'#2980b9', in:1, out:1, tpl:()=>`<div>Caja Límite</div>`, run: (id,i)=>turf.featureCollection(i[0].features.map(f=>turf.bboxPolygon(turf.bbox(f)))) },
        
    geo_voronoi: { 
                cat:'2. Geometry', label:'Voronoi', icon:'fa-th-large', color:'#2980b9', in:1, out:1, 
                tpl:()=>`<div>Polígonos</div>`, 
                run: (id,i)=>{
                    if (!i[0] || !i[0].features) throw new Error("Sin datos");
                    
                    // 1. Limpieza de duplicados y Z (altitud)
                    const seen = new Set();
                    const cleanPoints = [];
                    i[0].features.forEach(f => {
                        if(turf.getType(f) === 'Point') {
                            // Usamos solo X,Y para la firma, ignorando Z si existe
                            const c = f.geometry.coordinates;
                            const key = c[0].toFixed(6) + ',' + c[1].toFixed(6);
                            if(!seen.has(key)) {
                                seen.add(key);
                                // Asegurar que es 2D puro
                                cleanPoints.push(turf.point([c[0], c[1]], f.properties));
                            }
                        }
                    });

                    if(cleanPoints.length === 0) throw new Error("No hay puntos válidos");
                    const fc = turf.featureCollection(cleanPoints);

                    // 2. Calcular BBox expandido (Evita errores de borde)
                    const bbox = turf.bbox(fc); 
                    const w = bbox[2] - bbox[0];
                    const h = bbox[3] - bbox[1];
                    const pad = Math.max(w, h) * 0.5 || 0.01; // 50% margen para seguridad
                    const expandedBbox = [bbox[0]-pad, bbox[1]-pad, bbox[2]+pad, bbox[3]+pad];

                    // 3. Generar
                    const result = turf.voronoi(fc, {bbox: expandedBbox});
                    
                    // 4. LIMPIEZA FINAL (CRÍTICO: Eliminar geometrías nulas)
                    if(result && result.features) {
                        result.features = result.features.filter(f => f && f.geometry && f.geometry.coordinates.length > 0);
                        
                        // Recuperar atributos (Turf voronoi pierde atributos, intentamos pegarlos por índice)
                        // Nota: Turf mantiene el orden, así que polygon[i] corresponde a point[i]
                        result.features.forEach((poly, idx) => {
                            if(poly && cleanPoints[idx]) {
                                poly.properties = cleanPoints[idx].properties;
                            }
                        });
                    }

                    return result;
                } 
            },
    geo_buffer: { 
        cat: '2. Geometry', label: 'Bufferer', icon: 'fa-bullseye', color: '#2980b9', in: 1, out: 1,
        tpl: () => `
            <div style="margin-bottom:4px">
                <span style="font-size:0.7em;color:#aaa">Radio / Unidad</span>
                <div style="display:flex;gap:5px">
                    <input type="number" df-dist value="100" class="node-control">
                    <select df-unit class="node-control" style="width:80px">
                        <option value="meters">m</option>
                        <option value="kilometers">km</option>
                    </select>
                </div>
            </div>
            <div style="margin-bottom:4px">
                <span style="font-size:0.7em;color:#aaa">Estilo Borde</span>
                <select df-cap class="node-control">
                    <option value="round">Redondo (Round)</option>
                    <option value="square" disabled>Cuadrado (No soportado)</option>
                </select>
            </div>
            <div>
                <span style="font-size:0.7em;color:#aaa">Resultado</span>
                <select df-dis class="node-control">
                    <option value="false">Individual (Solapados)</option>
                    <option value="true">Disuelto (Unido)</option>
                </select>
            </div>`,
        run: (id, i, d) => {
            const dist = parseFloat(d.querySelector('[df-dist]').value);
            const unit = d.querySelector('[df-unit]').value;
            const dissolve = d.querySelector('[df-dis]').value === 'true';
            
            // Calculamos buffer
            const buffered = turf.buffer(i[0], dist, { units: unit });
            
            // Aplicamos disolución si se solicita
            return dissolve ? turf.dissolve(buffered) : buffered;
        }
    },

    // --- 3. SPATIAL ANALYSIS ---
    sp_min_area_solver: { 
        cat: '3. Spatial', label: 'MinArea Solver', icon: 'fa-compress-alt', color: '#8e44ad', in: 1, out: 2,
        tpl: () => `
            <div style="margin-bottom:4px">
                <span style="font-size:0.7em;color:#aaa">Criterio de Área</span>
                <div style="display:flex;gap:5px">
                    <input type="number" df-val value="100" class="node-control">
                    <select df-unit class="node-control" style="width:80px">
                        <option value="1">m²</option>
                        <option value="10000">ha</option>
                        <option value="1000000">km²</option>
                    </select>
                </div>
            </div>
            <div>
                <span style="font-size:0.7em;color:#aaa">Modo de Acción</span>
                <select df-mode class="node-control">
                    <option value="delete">Solo Eliminar</option>
                    <option value="merge">Fusionar con vecino (Merge)</option>
                </select>
            </div>
            <div style="font-size:0.6em;color:#666;margin-top:2px">Out 1: Dataset Limpio | Out 2: Eliminados</div>`,
        run: (id, inputs, dom) => {
            const minVal = parseFloat(dom.querySelector('[df-val]').value);
            const multiplier = parseFloat(dom.querySelector('[df-unit]').value);
            const mode = dom.querySelector('[df-mode]').value;
            const thresholdSqM = minVal * multiplier;

            const kept = [];
            const slivers = [];
            const removed = []; // Los que salen por el output 2

            // 1. Clasificación inicial
            turf.flatten(inputs[0]).features.forEach(f => {
                const area = turf.area(f);
                if (area < thresholdSqM) {
                    slivers.push(f);
                } else {
                    kept.push(f);
                }
            });

            if (mode === 'delete') {
                // Modo simple: lo pequeño se va al output 2
                return { 
                    output_1: turf.featureCollection(kept), 
                    output_2: turf.featureCollection(slivers) 
                };
            }

            // 2. Modo Merge (Algoritmo de frontera compartida)
            // Nota: Esto es intensivo computacionalmente (O(N*M))
            const sliversToDelete = [];

            slivers.forEach(sliver => {
                let bestNeighborIdx = -1;
                let maxSharedLen = 0;
                
                // Convertimos el sliver a línea una vez para comparar
                const sliverLine = turf.polygonToLine(sliver);
                const sliverBbox = turf.bbox(sliver); // Pre-filtro espacial

                kept.forEach((neighbor, idx) => {
                    // Filtro rápido: Si las cajas no se tocan, saltar
                    const nBbox = turf.bbox(neighbor);
                    if (sliverBbox[2] < nBbox[0] || sliverBbox[0] > nBbox[2] || 
                        sliverBbox[3] < nBbox[1] || sliverBbox[1] > nBbox[3]) return;

                    try {
                        // Si se tocan espacialmente, calculamos longitud de borde compartido
                        if (turf.booleanIntersects(sliver, neighbor)) {
                            const neighborLine = turf.polygonToLine(neighbor);
                            const overlap = turf.lineOverlap(sliverLine, neighborLine);
                            const len = turf.length(overlap);
                            
                            if (len > maxSharedLen) {
                                maxSharedLen = len;
                                bestNeighborIdx = idx;
                            }
                        }
                    } catch(e) {}
                });

                if (bestNeighborIdx !== -1) {
                    // Fusionar con el mejor vecino encontrado
                    try {
                        const union = turf.union(kept[bestNeighborIdx], sliver);
                        // Actualizamos el vecino en la lista 'kept' para que crezca
                        // y pueda absorber otros slivers adyacentes
                        kept[bestNeighborIdx] = union;
                    } catch(e) {
                        // Si falla la unión geométrica, lo marcamos para eliminar
                        sliversToDelete.push(sliver);
                    }
                } else {
                    // No tiene vecino (es una isla), se elimina
                    sliversToDelete.push(sliver);
                }
            });

            return { 
                output_1: turf.featureCollection(kept), 
                output_2: turf.featureCollection(sliversToDelete) 
            };
        }
    },
    geo_snap: { 
        cat: '3. Spatial', label: 'Snapper', icon: 'fa-magnet', color: '#8e44ad', in: 2, out: 1,
        tpl: () => `
            <div style="margin-bottom:4px">
                <span style="font-size:0.7em;color:#aaa">Distancia de Atracción</span>
                <div style="display:flex;gap:5px">
                    <input type="number" df-dist value="1" class="node-control">
                    <select df-unit class="node-control" style="width:80px">
                        <option value="0.001">m</option>
                        <option value="0.0001">dm</option>
                        <option value="0.00001">cm</option>
                        <option value="0.000001">mm</option>
                    </select>
                </div>
            </div>
            <div style="font-size:0.6em;color:#888;margin-top:2px">
                Input 1 (Data) se mueve hacia Input 2 (Ancla).
            </div>`,
        run: (id, inputs, dom) => {
            const val = parseFloat(dom.querySelector('[df-dist]').value);
            const mult = parseFloat(dom.querySelector('[df-unit]').value);
            
            // Umbral en Kilómetros (unidad estándar de Turf para distancias pequeñas)
            const thresholdKm = val * mult;

            // Clonamos para no modificar el original por referencia
            const source = JSON.parse(JSON.stringify(inputs[0]));
            const anchor = inputs[1];

            if (!anchor || !anchor.features.length) return source;

            // Optimizacion: Convertimos el Ancla a puntos una sola vez
            const anchorPoints = turf.explode(anchor);

            // Iteramos sobre cada coordenada de la fuente (Input 1)
            // coordEach permite mutar las coordenadas 'in-place'
            turf.coordEach(source, (currentCoord) => {
                const currentPoint = turf.point(currentCoord);
                
                // Buscamos el punto más cercano en la capa de Ancla
                const nearest = turf.nearestPoint(currentPoint, anchorPoints);
                
                // Calculamos distancia real
                const distance = turf.distance(currentPoint, nearest, {units: 'kilometers'});

                // Si está dentro del rango, hacemos el Snap (sobrescribimos la coordenada)
                if (distance <= thresholdKm) {
                    currentCoord[0] = nearest.geometry.coordinates[0];
                    currentCoord[1] = nearest.geometry.coordinates[1];
                }
            });

            return source;
        }
    },
    attr_renamer: { 
        cat: '4. Attributes', label: 'Renamer', icon: 'fa-tag', color: '#27ae60', in: 1, out: 1,
        params: [
            {id: 'map', type: 'text', label: 'Mapeo (Old:New, A:B)', placeholder: 'viejo:nuevo, id:uid'}
        ],
        run: (id, inputs, vals) => {
            const mapping = vals.map.split(',').map(p => p.split(':').map(s => s.trim()));
            
            inputs[0].features.forEach(f => {
                mapping.forEach(([oldName, newName]) => {
                    if (f.properties[oldName] !== undefined && newName) {
                        f.properties[newName] = f.properties[oldName];
                        delete f.properties[oldName];
                    }
                });
            });
            return inputs[0];
        }
    },

    attr_keeper: { 
        cat: '4. Attributes', label: 'Keeper', icon: 'fa-check-square', color: '#27ae60', in: 1, out: 1,
        params: [
            {id: 'keep', type: 'text', label: 'Campos a mantener', placeholder: 'id, name, type'}
        ],
        run: (id, inputs, vals) => {
            const toKeep = new Set(vals.keep.split(',').map(s => s.trim()));
            
            inputs[0].features.forEach(f => {
                const newProps = {};
                Object.keys(f.properties).forEach(k => {
                    if (toKeep.has(k)) newProps[k] = f.properties[k];
                });
                f.properties = newProps;
            });
            return inputs[0];
        }
    },

    attr_creator: { 
        cat: '4. Attributes', label: 'Attr Creator', icon: 'fa-plus-square', color: '#27ae60', in: 1, out: 1,
        params: [
            {id: 'name', type: 'text', label: 'Nuevo Campo', def: 'new_field'},
            {id: 'val', type: 'text', label: 'Valor o Fórmula (=)', def: 'Constante'}
        ],
        run: (id, inputs, vals) => {
            const field = vals.name;
            const exprRaw = vals.val;
            const isFormula = exprRaw.startsWith('=');
            
            // Si es fórmula, preparamos la función una sola vez para rendimiento
            let formulaFn = null;
            if (isFormula) {
                try {
                    // Creamos una función que recibe 'f' (feature)
                    // Ej: =f.properties.height * 2  --> return f.properties.height * 2
                    formulaFn = new Function('f', 'return ' + exprRaw.substring(1));
                } catch(e) { console.warn("Error en fórmula Creator", e); }
            }

            inputs[0].features.forEach(f => {
                if (isFormula && formulaFn) {
                    try {
                        f.properties[field] = formulaFn(f);
                    } catch(e) { f.properties[field] = null; }
                } else {
                    f.properties[field] = exprRaw;
                }
            });
            return inputs[0];
        }
    },

    attr_counter: { 
        cat: '4. Attributes', label: 'Counter', icon: 'fa-sort-numeric-down', color: '#27ae60', in: 1, out: 1,
        params: [
            {id: 'field', type: 'text', label: 'Nombre Campo', def: '_id'},
            {id: 'start', type: 'number', label: 'Inicio', def: 1}
        ],
        run: (id, inputs, vals) => {
            let count = parseInt(vals.start);
            const fieldName = vals.field;
            
            inputs[0].features.forEach(f => {
                f.properties[fieldName] = count++;
            });
            return inputs[0];
        }
    },
    attr_sorter: { 
        cat: '4. Attributes', label: 'Sorter', icon: 'fa-sort-alpha-down', color: '#27ae60', in: 1, out: 1,
        tpl: () => `
            <div style="margin-bottom:4px">
                <span style="font-size:0.7em;color:#aaa">Campo a Ordenar</span>
                <input type="text" df-field class="node-control" placeholder="Ej: id">
            </div>
            <div>
                <span style="font-size:0.7em;color:#aaa">Dirección</span>
                <select df-dir class="node-control">
                    <option value="asc">Ascendente (A-Z, 0-9)</option>
                    <option value="desc">Descendente (Z-A, 9-0)</option>
                </select>
            </div>`,
        run: (id, inputs, dom) => {
            const field = dom.querySelector('[df-field]').value;
            const dir = dom.querySelector('[df-dir]').value;
            const features = [...inputs[0].features]; // Copia para sortear

            features.sort((a, b) => {
                const valA = a.properties[field];
                const valB = b.properties[field];

                if (valA === valB) return 0;
                
                // Detección automática de tipo (Número vs Texto)
                const isNum = typeof valA === 'number' && typeof valB === 'number';
                
                let comparison = 0;
                if (isNum) {
                    comparison = valA - valB;
                } else {
                    // Comparación segura de strings (nulls al final)
                    comparison = String(valA || '').localeCompare(String(valB || ''), undefined, {numeric: true});
                }

                return dir === 'asc' ? comparison : -comparison;
            });

            return turf.featureCollection(features);
        }
    },

    attr_string_formatter: { 
        cat: '4. Attributes', label: 'String Formatter', icon: 'fa-text-width', color: '#27ae60', in: 1, out: 1,
        tpl: () => `
            <div style="margin-bottom:4px">
                <span style="font-size:0.7em;color:#aaa">Campo Objetivo</span>
                <input type="text" df-field class="node-control" placeholder="Ej: name">
            </div>
            <div style="margin-bottom:4px">
                <span style="font-size:0.7em;color:#aaa">Operación</span>
                <select df-op class="node-control">
                    <option value="upper">Mayúsculas (UPPER)</option>
                    <option value="lower">Minúsculas (lower)</option>
                    <option value="capitalize">Capitalizar (Titulo)</option>
                    <option value="trim">Trim (Limpiar espacios)</option>
                    <option value="replace">Reemplazar (A -> B)</option>
                    <option value="concat">Concatenar (Suffix)</option>
                    <option value="pad">Rellenar (PadStart 001)</option>
                    <option value="template">Plantilla ({campo})</option>
                </select>
            </div>
            <div>
                <span style="font-size:0.7em;color:#aaa">Argumentos (Sep: | )</span>
                <input type="text" df-args class="node-control" placeholder="old|new ó 000">
            </div>
            <div style="font-size:0.6em;color:#666;margin-top:2px">
                Para Replace: "buscar|reemplazo"<br>
                Para Template: "ID_{id}_zona"
            </div>`,
        run: (id, inputs, dom) => {
            const field = dom.querySelector('[df-field]').value;
            const op = dom.querySelector('[df-op]').value;
            const argsRaw = dom.querySelector('[df-args]').value || '';
            
            // Parsear argumentos (separador pipe | para replace)
            const args = argsRaw.split('|'); 
            const arg1 = args[0];
            const arg2 = args[1] || '';

            inputs[0].features.forEach(f => {
                let val = f.properties[field];
                if (val === undefined || val === null) val = '';
                val = String(val);

                switch(op) {
                    case 'upper': val = val.toUpperCase(); break;
                    case 'lower': val = val.toLowerCase(); break;
                    case 'trim': val = val.trim(); break;
                    case 'capitalize': 
                        val = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase(); 
                        break;
                    case 'replace': 
                        // Reemplazo global simple
                        val = val.split(arg1).join(arg2); 
                        break;
                    case 'concat': 
                        val = val + arg1; 
                        break;
                    case 'pad':
                        // Arg1: Longitud total, Arg2: Carácter relleno (defecto '0')
                        const len = parseInt(arg1) || 3;
                        const char = arg2 || '0';
                        val = val.padStart(len, char);
                        break;
                    case 'template':
                        // Reemplaza {campo} por el valor de ese campo
                        // El argumento es la plantilla completa, ignorando el valor original del campo objetivo
                        let tpl = argsRaw; 
                        Object.keys(f.properties).forEach(k => {
                            const regex = new RegExp(`{${k}}`, 'g');
                            tpl = tpl.replace(regex, f.properties[k]);
                        });
                        val = tpl;
                        break;
                }
                f.properties[field] = val;
            });

            return inputs[0];
        }
    },
    attr_feature_merger: { 
        cat: '4. Attributes', label: 'Feature Merger', icon: 'fa-code-branch', color: '#27ae60', in: 2, out: 3,
        tpl: () => `
            <div style="margin-bottom:4px">
                <span style="font-size:0.7em;color:#aaa">Relación (Input1 : Input2)</span>
                <input type="text" df-map class="node-control" placeholder="tipo:TIPO, id:ID_REF">
                <div style="font-size:0.6em;color:#666;font-style:italic">Separar pares por comas.</div>
            </div>
            <div style="font-size:0.6em;color:#888;margin-top:4px">
                Out 1: Merged<br>Out 2: Not Merged (Input 1)<br>Out 3: Unused (Input 2)
            </div>`,
        run: (id, inputs, dom) => {
            const mapStr = dom.querySelector('[df-map]').value;
            const reqFeatures = inputs[0].features; // Requestor (Mantiene geometría)
            const supFeatures = inputs[1].features; // Supplier (Aporta atributos)

            // Parsear el mapeo "campo1:campo2, campoA:campoB"
            const joinPairs = mapStr.split(',').map(p => p.split(':').map(s => s.trim()));
            if (joinPairs.length === 0 || !joinPairs[0][0]) throw new Error("Define campos de unión");

            // Función auxiliar para generar Hash Keys
            const getKey = (props, fields) => fields.map(f => String(props[f] || 'null')).join('|_|');

            // 1. Indexar el Supplier (Input 2)
            const supMap = new Map();
            const supKeys = joinPairs.map(p => p[1]); // Lado derecho del par
            
            supFeatures.forEach((f, idx) => {
                const key = getKey(f.properties, supKeys);
                // Si hay duplicados en el supplier, nos quedamos con el primero (First Match)
                if (!supMap.has(key)) {
                    supMap.set(key, { props: f.properties, originalIdx: idx, used: false });
                }
            });

            const merged = [];
            const notMerged = [];

            // 2. Procesar Requestor (Input 1)
            const reqKeys = joinPairs.map(p => p[0]); // Lado izquierdo del par

            reqFeatures.forEach(f => {
                const key = getKey(f.properties, reqKeys);
                
                if (supMap.has(key)) {
                    // Match encontrado!
                    const supData = supMap.get(key);
                    supData.used = true; // Marcamos supplier como usado

                    // Clonamos feature para no mutar original
                    const newF = JSON.parse(JSON.stringify(f));
                    // Fusionamos atributos (Supplier sobrescribe a Requestor en caso de colisión)
                    newF.properties = { ...newF.properties, ...supData.props };
                    merged.push(newF);
                } else {
                    // No match
                    notMerged.push(f);
                }
            });

            // 3. Recolectar Unused Suppliers (Input 2 que sobraron)
            const unusedSup = supFeatures.filter((f, idx) => {
                // Como supMap solo guarda el primero de cada serie duplicada, 
                // necesitamos una forma de saber si este feature específico fue "tocado".
                // Una forma robusta es volver a generar su key y ver si esa key está marcada como usada en el mapa.
                const key = getKey(f.properties, supKeys);
                const mapEntry = supMap.get(key);
                // Si la entrada del mapa fue usada, consideramos todos los duplicados de esa clave como usados?
                // Generalmente en FeatureMerger 1:1, los duplicados del supplier que no se usaron son "Unused".
                // Pero para simplificar lógica visual: Si la clave se usó, el "concepto" se usó.
                // Aquí seremos estrictos: Solo devolvemos los que NO fueron la fuente de datos.
                
                return !mapEntry || !mapEntry.used;
            });

            return { 
                output_1: turf.featureCollection(merged), 
                output_2: turf.featureCollection(notMerged),
                output_3: turf.featureCollection(unusedSup)
            };
        }
    },
attr_area: { 
        cat: '4. Attributes', label: 'Area Calc', icon: 'fa-ruler-combined', color: '#27ae60', in: 1, out: 1,
        tpl: () => `
            <div style="margin-bottom:4px">
                <span style="font-size:0.7em;color:#aaa">Nombre del Campo</span>
                <input type="text" df-field class="node-control" value="_area" placeholder="_area">
            </div>`,
        run: (id, inputs, dom) => {
            const fieldName = dom.querySelector('[df-field]').value || '_area';
            
            inputs[0].features.forEach(f => {
                // Calcula área en metros cuadrados
                const area = turf.area(f);
                f.properties[fieldName] = parseFloat(area.toFixed(2));
            });

            return inputs[0];
        }
    },

    attr_length: { 
        cat: '4. Attributes', label: 'Length Calc', icon: 'fa-ruler-horizontal', color: '#27ae60', in: 1, out: 1,
        tpl: () => `
            <div style="margin-bottom:4px">
                <span style="font-size:0.7em;color:#aaa">Nombre del Campo</span>
                <input type="text" df-field class="node-control" value="_length" placeholder="_length">
            </div>`,
        run: (id, inputs, dom) => {
            const fieldName = dom.querySelector('[df-field]').value || '_length';
            
            inputs[0].features.forEach(f => {
                // Calcula longitud en kilómetros
                const length = turf.length(f, {units: 'kilometers'});
                f.properties[fieldName] = parseFloat(length.toFixed(4));
            });

            return inputs[0];
        }
    },
    attr_matcher: { 
        cat: '4. Attributes', label: 'Matcher', icon: 'fa-clone', color: '#27ae60', in: 1, out: 2,
        tpl: () => `
            <div style="margin-bottom:6px">
                <span style="font-size:0.7em;color:#aaa">Criterio de Coincidencia</span>
                <div style="display:flex; flex-direction:column; gap:4px; margin-top:2px">
                    <label style="font-size:0.8em; display:flex; align-items:center; color:#ddd">
                        <input type="checkbox" df-geo checked style="margin-right:6px"> Geometría
                    </label>
                    <label style="font-size:0.8em; display:flex; align-items:center; color:#ddd">
                        <input type="checkbox" df-attr style="margin-right:6px"> Atributos
                    </label>
                </div>
            </div>
            <div>
                <span style="font-size:0.7em;color:#aaa">Campos (Si Atributos = ON)</span>
                <input type="text" df-fields class="node-control" placeholder="Ej: id, type">
                <div style="font-size:0.6em;color:#666;font-style:italic">Vacío = Todos los campos.</div>
            </div>
            <div style="font-size:0.6em;color:#888;margin-top:4px">Out 1: Únicos | Out 2: Duplicados</div>`,
        run: (id, inputs, dom) => {
            const matchGeo = dom.querySelector('[df-geo]').checked;
            const matchAttr = dom.querySelector('[df-attr]').checked;
            const rawFields = dom.querySelector('[df-fields]').value;
            
            const uniques = [];
            const duplicates = [];
            const seenHashes = new Set();

            const targetFields = rawFields ? rawFields.split(',').map(s => s.trim()).filter(s => s!=='') : null;

            inputs[0].features.forEach(f => {
                let hashParts = [];

                // 1. Huella de Geometría
                if (matchGeo) {
                    // Usamos stringify de las coordenadas para comparación exacta
                    hashParts.push(JSON.stringify(f.geometry));
                }

                // 2. Huella de Atributos
                if (matchAttr) {
                    if (targetFields && targetFields.length > 0) {
                        // Concatenar solo campos específicos
                        const attrVal = targetFields.map(k => {
                            const val = f.properties[k];
                            return val !== undefined && val !== null ? val : 'null';
                        }).join('_|_');
                        hashParts.push(attrVal);
                    } else {
                        // Concatenar todo el objeto de propiedades (ordenado para consistencia)
                        // Para evitar problemas de orden de claves, ordenamos keys
                        const sortedProps = {};
                        Object.keys(f.properties || {}).sort().forEach(key => {
                            sortedProps[key] = f.properties[key];
                        });
                        hashParts.push(JSON.stringify(sortedProps));
                    }
                }

                // Si no se selecciona nada, asumimos que no hay criterio => todos son únicos (o error)
                if (hashParts.length === 0) {
                    uniques.push(f);
                    return;
                }

                const finalHash = hashParts.join('###');

                if (seenHashes.has(finalHash)) {
                    duplicates.push(f);
                } else {
                    seenHashes.add(finalHash);
                    uniques.push(f);
                }
            });

            return { 
                output_1: turf.featureCollection(uniques), 
                output_2: turf.featureCollection(duplicates) 
            };
        }
    },
    sp_spatial_filter: { 
        cat: '3. Spatial', label: 'Spatial Filter', icon: 'fa-filter', color: '#8e44ad', in: 2, out: 2,
        tpl: () => `
            <div style="margin-bottom:4px">
                <span style="font-size:0.7em;color:#aaa">Criterio (Input 1 vs Input 2)</span>
                <select df-mode class="node-control">
                    <option value="contains">Contiene a (Contains)</option>
                    <option value="within">Dentro de (Within)</option>
                    <option value="crosses">Cruza (Crosses)</option>
                    <option value="touches">Toca (Touches)</option>
                    <option value="equal">Igual (Equals)</option>
                </select>
            </div>
            <div style="font-size:0.6em;color:#888">Out 1: Passed (Cumple) | Out 2: Failed</div>`,
        run: (id, inputs, dom) => {
            const mode = dom.querySelector('[df-mode]').value;
            const source = inputs[0].features;
            const mask = inputs[1].features; // Input 2 es la máscara
            
            const passed = [];
            const failed = [];

            // Pre-procesamiento: Aplanar máscara para iteración simple
            // (En casos masivos se debería usar índice espacial RBush, aquí bucle simple)
            const flatMask = [];
            turf.flatten(inputs[1]).features.forEach(f => flatMask.push(f));

            source.forEach(f1 => {
                let match = false;
                
                // Comprobamos contra CUALQUIER elemento de la máscara (Lógica OR)
                for (const f2 of flatMask) {
                    try {
                        if (mode === 'contains' && turf.booleanContains(f1, f2)) match = true;
                        else if (mode === 'within' && turf.booleanWithin(f1, f2)) match = true;
                        else if (mode === 'crosses' && turf.booleanCrosses(f1, f2)) match = true;
                        else if (mode === 'touches' && turf.booleanTouches(f1, f2)) match = true;
                        else if (mode === 'equal' && turf.booleanEqual(f1, f2)) match = true;
                    } catch(e) {} // Ignorar errores de topología incompatible
                    
                    if (match) break; // Si ya cumple con uno, no hace falta seguir mirando
                }

                if (match) passed.push(f1);
                else failed.push(f1);
            });

            return { 
                output_1: turf.featureCollection(passed), 
                output_2: turf.featureCollection(failed) 
            };
        }
    },

    sp_nearest_neighbor: { 
        cat: '3. Spatial', label: 'Nearest Neighbor', icon: 'fa-shoe-prints', color: '#8e44ad', in: 2, out: 2,
        tpl: () => `
            <div style="margin-bottom:4px">
                <span style="font-size:0.7em;color:#aaa">Radio Máximo</span>
                <div style="display:flex;gap:5px">
                    <input type="number" df-dist placeholder="Infinito" class="node-control">
                    <select df-unit class="node-control" style="width:80px">
                        <option value="kilometers">km</option>
                        <option value="meters">m</option>
                    </select>
                </div>
            </div>
            <div style="margin-bottom:4px">
                <label style="font-size:0.8em;color:#ccc;display:flex;align-items:center">
                    <input type="checkbox" df-copy checked style="margin-right:5px"> Copiar Atributos
                </label>
            </div>
            <div style="font-size:0.6em;color:#888">Out 1: Con Vecino | Out 2: Sin Vecino</div>`,
        run: (id, inputs, dom) => {
            const distVal = dom.querySelector('[df-dist]').value;
            const maxDist = distVal ? parseFloat(distVal) : Infinity;
            const units = dom.querySelector('[df-unit]').value;
            const copyAttr = dom.querySelector('[df-copy]').checked;

            const matched = [];
            const unmatched = [];

            // Convertimos Input 2 (Candidatos) a puntos (Centroides) para usar nearestPoint
            // Esto permite que funcione con Polígonos y Líneas también
            const candidates = inputs[1].features.map((f, idx) => {
                const c = turf.centroid(f);
                c.properties = f.properties; // Mantenemos propiedades
                c.id = idx; // Guardamos ref
                return c;
            });
            const candidateFC = turf.featureCollection(candidates);

            inputs[0].features.forEach(f => {
                const center = turf.centroid(f);
                const nearest = turf.nearestPoint(center, candidateFC);
                
                // turf.nearestPoint devuelve la distancia en la propiedad 'distanceToPoint' (en km por defecto)
                // Convertimos esa distancia a la unidad seleccionada para comparar
                let dist = nearest.properties.distanceToPoint; 
                if (units === 'meters') dist = dist * 1000;

                if (dist <= maxDist) {
                    // Match encontrado
                    const res = JSON.parse(JSON.stringify(f)); // Copia profunda
                    
                    // Metadatos del vecino
                    res.properties._neighbor_dist = parseFloat(dist.toFixed(4));
                    
                    if (copyAttr) {
                        // Copiamos atributos del vecino (sin sobrescribir geometría)
                        Object.keys(nearest.properties).forEach(k => {
                            if(k !== 'distanceToPoint' && k !== 'featureIndex') {
                                res.properties['neighbor_' + k] = nearest.properties[k];
                            }
                        });
                    } else {
                        // Solo ID (o índice si no hay ID)
                        res.properties._neighbor_id = nearest.id; // ID interno asignado arriba
                    }
                    matched.push(res);
                } else {
                    unmatched.push(f);
                }
            });

            return { 
                output_1: turf.featureCollection(matched), 
                output_2: turf.featureCollection(unmatched) 
            };
        }
    },

    sp_intersector: { 
        cat: '3. Spatial', label: 'Intersector', icon: 'fa-times', color: '#8e44ad', in: 2, out: 2,
        tpl: () => `<div style="font-size:0.7em;color:#aaa">Calcula intersección. <br>Si son líneas, las corta.</div>
                    <div style="font-size:0.6em;color:#888;margin-top:2px">Out 1: Geometría (Líneas/Polys) | Out 2: Puntos</div>`,
        run: (id, inputs) => {
            const features1 = turf.flatten(inputs[0]).features;
            const features2 = turf.flatten(inputs[1]).features;
            
            const outGeom = [];
            const outPoints = [];

            // Detectamos si estamos trabajando con líneas para aplicar modo "Split"
            const isLineMode = features1.some(f=>turf.getType(f).includes('Line')) && features2.some(f=>turf.getType(f).includes('Line'));

            if (isLineMode) {
                // MODO LINEAS: Calcular puntos de corte y partir las líneas
                
                // 1. Calcular todos los puntos de intersección
                const intersections = turf.lineIntersect(inputs[0], inputs[1]);
                if (intersections && intersections.features) {
                    outPoints.push(...intersections.features);
                }

                // 2. Partir Input 1 usando los puntos de intersección
                features1.forEach(line => {
                    let splitResult = [line]; 
                    // Nota: lineSplit solo acepta un splitter a la vez. 
                    // Para hacerlo eficiente con múltiples puntos, usamos el FC de intersecciones.
                    // Si falla, devolvemos la línea original.
                    try {
                        const split = turf.lineSplit(line, intersections);
                        if (split && split.features.length > 0) splitResult = split.features;
                    } catch(e){}
                    
                    splitResult.forEach(s => {
                        s.properties = {...line.properties, _origin: 'input1'};
                        outGeom.push(s);
                    });
                });

                // 3. Partir Input 2 usando los mismos puntos
                features2.forEach(line => {
                    let splitResult = [line];
                    try {
                        const split = turf.lineSplit(line, intersections);
                        if (split && split.features.length > 0) splitResult = split.features;
                    } catch(e){}
                    
                    splitResult.forEach(s => {
                        s.properties = {...line.properties, _origin: 'input2'};
                        outGeom.push(s);
                    });
                });

            } else {
                // MODO POLÍGONOS (Intersección Booleana Clásica)
                features1.forEach(f1 => {
                    features2.forEach(f2 => {
                        try {
                            const intersection = turf.intersect(f1, f2);
                            if (intersection) {
                                // Combinar propiedades
                                intersection.properties = { ...f1.properties, ...f2.properties };
                                outGeom.push(intersection);
                            }
                        } catch (e) {}
                    });
                });
            }

            return { 
                output_1: turf.featureCollection(outGeom), 
                output_2: turf.featureCollection(outPoints) 
            };
        }
    },
    sp_clip: { 
        cat:'3. Spatial', label:'Clipper (Robust)', icon:'fa-crop', color:'#8e44ad', in:2, out:1, 
        tpl:()=>`<div>Data &#8745; Mask</div>`, 
        run: async (id,i)=>{ 
            if(!i[0] || !i[1] || !i[1].features.length) throw new Error("Faltan datos");
            if(!i[0].features || i[0].features.length===0) throw new Error("Data vacía");
            
            let maskCollection = turf.flatten(i[1]);
            let dissolved = turf.dissolve(maskCollection);
            let mask = dissolved.features[0];
            if (dissolved.features.length > 1) {
                const coords = dissolved.features.map(f => f.geometry.coordinates);
                mask = turf.multiPolygon(coords);
            }
            try { mask = turf.simplify(mask, {tolerance:0.00001, highQuality:true}); } catch(e){}
            try { mask = turf.cleanCoords(mask); } catch(e){}

            // Intentar usar Worker si está disponible (definido en index.html)
            const features = i[0].features;
            const CHUNK = 50; 
            try {
                if(typeof postWorkerTask === 'function') {
                    if(!window.geoWorker) createGeoWorker(); // Asumiendo fn global
                    const payload = { task: 'clip', features: { type: 'FeatureCollection', features }, mask, chunk: CHUNK };
                    const wres = await postWorkerTask(payload, 30000);
                    if(wres && (wres.status === 'ok' || wres.status === 'partial')){
                        return normalizeResult(wres.data || wres.result || wres);
                    }
                }
            } catch(e) { console.log("Worker clip fallback"); }

            // Fallback Main Thread
            const res = [];
            for(const f of features) {
                try {
                    if (!turf.booleanIntersects(f, mask)) continue;
                    const clipped = turf.intersect(f, mask);
                    if(clipped) { clipped.properties = f.properties; res.push(clipped); }
                } catch(e){}
            }
            return turf.featureCollection(res);
        } 
    },
    
    // --- 4. ATTRIBUTES (DATA) ---
    attr_test: { cat:'4. Attributes', label:'Tester', icon:'fa-balance-scale', color:'#27ae60', in:1, out:2, 
        tpl:()=>`<input class="node-control" df-l placeholder="Field"><select class="node-control" df-op><option value="==">=</option><option value=">">></option><option value="<"><</option><option value="like">Like</option></select><input class="node-control" df-r placeholder="Val">`, 
        run: (id,i,d)=>{
            const l=d.querySelector('[df-l]').value, op=d.querySelector('[df-op]').value, r=d.querySelector('[df-r]').value, p=[], f=[];
            i[0].features.forEach(feat=>{const val=feat.properties[l]; let pass=false;
                if(op==='like') pass=String(val).includes(r); else if(op==='>') pass=val>Number(r); else if(op==='<') pass=val<Number(r); else pass=val==r;
                if(pass)p.push(feat);else f.push(feat);
            }); return {output_1:turf.featureCollection(p), output_2:turf.featureCollection(f)}
        } 
    },

    // --- 5. UTILS / LOGIC ---
// JUNCTION: Ahora actúa como "Union" (acepta hasta 5 entradas y las fusiona)
    util_junction: { 
        cat: '5. Utils', label: 'Junction', icon: 'fa-circle', color: '#7f8c8d', 
        in: 5, // Múltiples entradas para permitir la fusión
        out: 1, 
        tpl: () => ``, // Se mantiene vacío para conservar el estilo minimalista
        run: (id, inputs) => {
            const allFeatures = [];
            
            // Recorremos todas las entradas conectadas
            inputs.forEach(layer => {
                if (layer && layer.features) {
                    allFeatures.push(...layer.features);
                }
            });

            return turf.featureCollection(allFeatures);
        } 
    },    util_holder: { cat:'5. Utils', label:'Inspector', icon:'fa-eye', color:'#7f8c8d', in:1, out:1, tpl:()=>`<div style="font-size:0.7em; color:#aaa">Passthrough</div>`, run: (id,i)=>i[0] },

    // --- 6. OUTPUTS (WRITERS) ---
    writer_geojson: { cat:'6. Writers', label:'GeoJSON DL', icon:'fa-file-code', color:'#c0392b', in:1, out:0, tpl:()=>`<div>Descargar</div>`, run: (id,i)=>{download(JSON.stringify(i[0]),'export.geojson','application/json'); return i[0]} },
    writer_csv: { cat:'6. Writers', label:'CSV DL', icon:'fa-file-csv', color:'#c0392b', in:1, out:0, tpl:()=>`<div>Descargar</div>`, run: (id,i)=>{download(toCSV(i[0]),'export.csv','text/csv'); return i[0]} },
    writer_kml: { cat:'6. Writers', label:'KML DL', icon:'fa-globe', color:'#c0392b', in:1, out:0, tpl:()=>`<div>Descargar</div>`, run: (id,i)=>{download(toKML(i[0]),'export.kml','application/vnd.google-earth.kml+xml'); return i[0]} },
    writer_wkt: { cat:'6. Writers', label:'WKT Console', icon:'fa-font', color:'#c0392b', in:1, out:0, tpl:()=>`<div>Ver en Log</div>`, run: (id,i)=>{i[0].features.forEach(f=>log(wellknown.stringify(f))); return i[0]} }
};
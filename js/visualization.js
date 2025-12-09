// =============================================
        // VISUALIZACIÓN & UI HELPERS
        // =============================================

        // Función principal de pintado en el mapa
        function showOnMap(id) {
            let meta = executionData[id];
            if(!meta || !meta.data) { showToast("Nodo sin datos procesados", "error"); return; }
            
            // Normalización de datos
            let data = meta.data;
            if(!data.type) data = data.output_1 || data.output_2 || data.output_3; // Soporte para nodos multi-salida
            if(!data || !data.features || data.features.length === 0) { showToast("Geometría vacía", "warn"); return; }

            // Limpieza de capa previa del mismo nodo
            if(mapLayers[id]) { 
                map.removeLayer(mapLayers[id]); 
                layerControl.removeLayer(mapLayers[id]);
                delete mapLayers[id];
            }

            const nodeName = editor.getNodeFromId(id).name;
            const tool = TOOL_REGISTRY[nodeName];
            
            // --- LOGICA DE ESTILOS (Soporte Inspector) ---
            // 1. Buscamos si hay un estilo forzado en el root del objeto (puesto por el Inspector)
            const customStyle = data._custom_style || null;
            
            // 2. Definimos el color base (Custom o Default del Tool)
            const baseColor = (customStyle && customStyle.color) ? customStyle.color : (tool.color || '#3388ff');
            
            const layerName = `<span style="color:${baseColor}">■</span> ${tool.label} (#${id})`;

            try {
                const layer = L.geoJSON(data, {
                    // Estilo para Polígonos y Líneas
                    style: function(feature) {
                        // Prioridad 1: Estilo global del Inspector
                        if (customStyle) return customStyle;
                        
                        // Prioridad 2: Estilo específico de la feature
                        if (feature.properties && feature.properties._custom_style) return feature.properties._custom_style;

                        // Prioridad 3: Defecto
                        return { 
                            color: baseColor, 
                            weight: 2, 
                            opacity: 0.8, 
                            fillColor: baseColor, 
                            fillOpacity: 0.2 
                        };
                    },
                    // Estilo para Puntos
                    pointToLayer: (feature, latlng) => {
                        // Chequeo de color específico por punto
                        let c = baseColor;
                        if(feature.properties && feature.properties.marker_color) c = feature.properties.marker_color;
                        
                        return L.circleMarker(latlng, { 
                            radius: 6, 
                            color: '#fff', 
                            weight: 1, 
                            fillColor: c, 
                            fillOpacity: 0.9 
                        });
                    },
                    // Popups
                    onEachFeature: function(feature, layer) {
                        if (feature.properties) {
                            let table = '<table style="font-size:10px">';
                            for (let k in feature.properties) {
                                if(k.startsWith('_')) continue; // Ocultar props internas
                                let val = feature.properties[k];
                                if(typeof val === 'number' && !Number.isInteger(val)) val = val.toFixed(4);
                                table += `<tr><td><b>${k}</b></td><td>${val}</td></tr>`;
                            }
                            table += '</table>';
                            layer.bindPopup(table);
                        }
                    }
                }).addTo(map);

                layerControl.addOverlay(layer, layerName);
                mapLayers[id] = layer;
                
                // Zoom automático a la capa
                const bounds = layer.getBounds();
                if(bounds.isValid()) map.fitBounds(bounds, {padding:[50,50], maxZoom: 16});
                
                switchTab('map');

            } catch(e) {
                console.error(e);
                showToast("Error renderizando mapa", "error");
            }
        }

        // Construye tabla de atributos
        function buildTable(data) {
            const container = document.getElementById('table-container');
            container.innerHTML = '';
            
            // Normalización
            if(!data.type) data = data.output_1 || data.output_2 || data.output_3;
            if(!data || !data.features || data.features.length === 0) { 
                container.innerHTML = '<div style="padding:20px;text-align:center;color:#aaa">Sin datos para visualizar.</div>'; 
                return; 
            }

            // Detectar headers (usamos la primera feature válida)
            const firstProps = data.features[0].properties || {};
            const headers = Object.keys(firstProps).filter(k => !k.startsWith('_')); // Filtramos internos
            
            let html = '<table class="attr-table"><thead><tr><th>#</th>';
            headers.forEach(h => html += `<th>${h}</th>`);
            html += '</tr></thead><tbody>';
            
            const limit = Math.min(data.features.length, 100); // Límite 100 para rendimiento
            
            for(let i=0; i<limit; i++) {
                html += `<tr><td>${i+1}</td>`;
                const props = data.features[i].properties || {};
                headers.forEach(h => {
                    let val = props[h];
                    if(val === undefined || val === null) val = '';
                    else if(typeof val === 'object') val = '[Obj]';
                    else if(typeof val === 'number' && !Number.isInteger(val)) val = val.toFixed(4);
                    
                    html += `<td title="${val}">${val}</td>`;
                });
                html += '</tr>';
            }
            html += '</tbody></table>';
            
            if(data.features.length > limit) {
                html += `<div style="padding:8px;text-align:center;font-size:0.8em;color:#888;background:#1e1e1e">
                            ⚠️ Mostrando primeros ${limit} de ${data.features.length} registros. Descarga CSV para ver todo.
                         </div>`;
            }
            container.innerHTML = html;
        }

        // Actualizar badges (Semáforo de estado)
        function updateBadges() {
            Object.keys(executionData).forEach(id => {
                const meta = executionData[id];
                const badge = document.getElementById('b-'+id);
                if(!badge) return;

                let count = 0;
                // Intentamos adivinar la estructura
                if(meta.data && meta.data.features) count = meta.data.features.length;
                else if(meta.data && meta.data.output_1) count = meta.data.output_1.features.length;

                badge.innerText = count > 1000 ? (count/1000).toFixed(1)+'k' : count;
                badge.style.display = 'flex';
                
                // Lógica de color (Verde = Reciente, Naranja = Antiguo)
                badge.className = 'count-badge'; 
                if (meta.timestamp && currentRunTimestamp && meta.timestamp >= currentRunTimestamp) {
                    badge.classList.add('badge-green');
                } else {
                    badge.classList.add('badge-orange');
                }
            });
        }

        // =============================================
        // HELPERS UI & ARCHIVOS
        // =============================================
        function toggleSidebar() { 
            const s = document.getElementById('sidebar'); 
            s.classList.toggle('open'); 
            const ov = document.getElementById('sidebar-overlay');
            if(ov) ov.style.display = s.classList.contains('open')?'block':'none'; 
        }

        function togglePanelHeight() { 
            const p = document.getElementById('bottom-panel'); 
            const isMin = p.offsetHeight < 100;
            p.style.height = isMin ? '45vh' : '36px'; 
            setTimeout(()=>map.invalidateSize(), 350); 
        }

        function switchTab(t) {
            // Gestión de clases active en botones
            const evt = arguments[1] || window.event;
            document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
            if(evt && evt.target) {
                const btn = evt.target.closest('button');
                if(btn) btn.classList.add('active');
            }

            // Gestión de visibilidad de paneles
            ['map','logs','table-container'].forEach(x => { 
                const el = document.getElementById(x); 
                if(el) el.style.display='none'; 
            });
            
            const showId = (t==='table') ? 'table-container' : t;
            const toShow = document.getElementById(showId);
            if(toShow) toShow.style.display = 'block';

            // Auto-expandir panel si está cerrado
            const p = document.getElementById('bottom-panel');
            if(p.offsetHeight < 100) togglePanelHeight();

            if(t==='map') setTimeout(()=>map.invalidateSize(), 300);
        }

        function log(m, t) { 
            const l = document.getElementById('logs');
            if(!l) return; 
            const ts = new Date().toLocaleTimeString();
            const color = t==='err'?'#e74c3c':(t==='success'?'#2ecc71':(t==='warn'?'#f1c40f':'#bbb'));
            l.innerHTML += `<div style="color:${color};margin-bottom:4px;font-family:monospace;font-size:0.9em">
                                <span style="opacity:0.5;margin-right:5px">[${ts}]</span>${m}
                            </div>`; 
            l.scrollTop = l.scrollHeight; 
        }

        function showToast(m, type) { 
            const t = document.getElementById('toast');
            if(!t) return console.log(m);
            const msgEl = document.getElementById('toast-msg');
            if(msgEl) msgEl.innerText = m;
            
            t.className = 'visible'; 
            t.style.borderLeft = `4px solid ${type==='error'?'#e74c3c':(type==='warn'?'#f1c40f':'#2ecc71')}`;
            setTimeout(()=>t.className='', 3000); 
        }
        
        // Carga de Archivos Local (Para nodos File Reader)
        // NOTA: Para el GeoTIFF Reader, la lógica va dentro del nodo run(), no aquí.
        async function loadFile(input, id) {
            const file = input.files[0];
            if (!file) return;
            const lbl = document.getElementById('lbl-' + id); // Asegúrate de tener un <span id="lbl-NODEID"> en tu tpl
            if(lbl) lbl.innerText = "Leyendo...";
            
            try {
                // Truco para el GeoTIFF: Si es .tif, solo notificamos visualmente, 
                // el nodo run() se encargará de leer el binario.
                if(file.name.match(/\.tif|\.tiff$/i)) {
                    if(lbl) {
                        lbl.innerText = `${file.name}`;
                        lbl.style.color = "#2ecc71";
                    }
                    return; // Salimos, no parseamos geojson aquí
                }

                // Para Vectoriales normales (GeoJSON, KML, GPKG...)
                let geojson = null;
                const buffer = await file.arrayBuffer();
                
                if (file.name.match(/\.zip$/i)) {
                    const result = await shp(buffer);
                    geojson = Array.isArray(result) ? turf.featureCollection(result.flatMap(r=>r.features)) : result;
                } else if (file.name.match(/\.json$|\.geojson$/i)) {
                    const text = new TextDecoder("utf-8").decode(buffer);
                    geojson = JSON.parse(text);
                } else if (file.name.match(/\.kml$/i)) {
                    const text = new TextDecoder("utf-8").decode(buffer);
                    geojson = toGeoJSON.kml(new DOMParser().parseFromString(text,'text/xml'));
                }
                // ... añadir más parsers si es necesario (GPKG, Parquet) ...
                
                if(!geojson) throw new Error("Formato no soportado en vista previa");

                geojson = ensureFC(geojson);
                
                // Guardamos en el input oculto para que el nodo run() lo recoja
                // Asegúrate que tu nodo tiene: <input type="hidden" df-data id="d-NODEID">
                const hiddenInput = document.getElementById('d-' + id);
                if(hiddenInput) hiddenInput.value = JSON.stringify(geojson);

                if(lbl) {
                    lbl.innerText = `${file.name} (${geojson.features.length} fts)`;
                    lbl.style.color = "#2ecc71";
                }

            } catch (e) {
                console.warn(e);
                if(lbl) {
                    lbl.innerText = "Error / Pendiente"; // Algunos formatos complejos fallan en preview
                    lbl.style.color = "#e67e22";
                }
            }
        }

        // Helpers de Descarga
        function download(c,n,t){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([c],{type:t})); a.download=n; a.click(); }
        
        function toCSV(g){ 
            if(!g || !g.features || g.features.length===0) return "";
            const props = new Set();
            g.features.forEach(f=>Object.keys(f.properties||{}).forEach(k=> !k.startsWith('_') && props.add(k)));
            const h=Array.from(props);
            
            // CSV Scaping
            const escape = v => {
                if(v === null || v === undefined) return '';
                let s = String(v);
                if(s.includes('"')) s = s.replace(/"/g, '""');
                if(s.includes(',') || s.includes('\n') || s.includes('"')) return `"${s}"`;
                return s;
            };
            
            const rows = g.features.map(f => h.map(k => escape(f.properties?f.properties[k]:'')).join(','));
            return h.join(',') + '\n' + rows.join('\n');
        }

        function clearCanvas(){ 
            if(!confirm("¿Borrar todo el flujo? Se perderán los datos no guardados.")) return;
            editor.clear(); 
            SafeStorage.clear('jetl_flow_optimized'); 
            
            // Limpiar Mapa
            Object.values(mapLayers).forEach(l => { map.removeLayer(l); layerControl.removeLayer(l); });
            mapLayers = {}; 
            executionData = {};
            
            log("Canvas reseteado.", "warn");
        }

        // Helper pequeño para asegurar FeatureCollection
        function ensureFC(geo) {
            if (!geo) return turf.featureCollection([]);
            if (geo.type === 'FeatureCollection') return geo;
            if (geo.type === 'Feature') return turf.featureCollection([geo]);
            if (Array.isArray(geo)) return turf.featureCollection(geo);
            return turf.featureCollection([]);
        }
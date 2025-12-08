
        // =============================================
        // VISUALIZACIÓN
        // =============================================
        function showOnMap(id) {
            let meta = executionData[id];
            if(!meta || !meta.data) { showToast("Nodo sin datos procesados", "error"); return; }
            let data = meta.data;
            
            if(!data.type) data = data.output_1 || data.output_2 || data.output_3;
            if(!data || !data.features || data.features.length === 0) { showToast("Geometría vacía", "error"); return; }

            if(mapLayers[id]) { map.removeLayer(mapLayers[id]); layerControl.removeLayer(mapLayers[id]); }

            const nodeName = editor.getNodeFromId(id).name;
            const tool = TOOL_REGISTRY[nodeName];
            const layerName = `<span style="color:${tool.color}">■</span> ${tool.label} (#${id})`;
            
            const layer = L.geoJSON(data, {
                style: { color: tool.color, weight: 2, opacity: 0.8, fillOpacity: 0.2 },
                pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 6, color: '#fff', weight:1, fillColor: tool.color, fillOpacity: 0.9 })
            }).addTo(map);

            layerControl.addOverlay(layer, layerName);
            mapLayers[id] = layer;
            
            try { map.fitBounds(layer.getBounds(), {padding:[50,50], maxZoom: 16}); } catch(e){}
            switchTab('map');
        }

        function buildTable(data) {
            const container = document.getElementById('table-container');
            container.innerHTML = '';
            if(!data.type) data = data.output_1 || data.output_2 || data.output_3;
            if(!data || !data.features || data.features.length === 0) { container.innerHTML = '<div style="padding:20px;text-align:center">Sin datos.</div>'; return; }

            const props = data.features[0].properties || {};
            const headers = Object.keys(props);
            
            let html = '<table class="attr-table"><thead><tr><th>#</th>';
            headers.forEach(h => html += `<th>${h}</th>`);
            html += '</tr></thead><tbody>';
            
            const limit = Math.min(data.features.length, 200);
            for(let i=0; i<limit; i++) {
                html += `<tr><td>${i+1}</td>`;
                headers.forEach(h => {
                    let val = data.features[i].properties[h];
                    if(typeof val === 'object') val = '[Obj]';
                    html += `<td title="${val}">${val!==undefined?val:''}</td>`
                });
                html += '</tr>';
            }
            html += '</tbody></table>';
            if(data.features.length > 200) html += `<div style="padding:10px;text-align:center;font-size:0.8rem;color:#888;background:#222">... Visualizando 200 de ${data.features.length} registros. Descarga el CSV para ver todo.</div>`;
            container.innerHTML = html;
        }

        // Función para actualizar los badges según el Timestamp
        function updateBadges() {
            Object.keys(executionData).forEach(id => {
                const meta = executionData[id];
                const badge = document.getElementById('b-'+id);
                if(!badge) return;

                let count = 0;
                const d = meta.data;
                if(d.features) count = d.features.length;
                else if(d.output_1) count = d.output_1.features.length + (d.output_2?.features.length||0);
                
                badge.innerText = count;
                badge.style.display = 'inline-block';
                
                // Lógica Semáforo
                badge.className = 'count-badge'; // reset
                if (meta._runId === currentRunTimestamp) {
                    badge.classList.add('badge-green'); // Calculado AHORA
                } else {
                    badge.classList.add('badge-orange'); // Calculado ANTES (Stale)
                }
            });
        }

        // =============================================
        // HELPERS GENÉRICOS
        // =============================================
        function toggleSidebar() { const s = document.getElementById('sidebar'); s.classList.toggle('open'); document.getElementById('sidebar-overlay').style.display = s.classList.contains('open')?'block':'none'; }
        function togglePanelHeight() { 
            const p = document.getElementById('bottom-panel'); 
            const isMin = p.offsetHeight < 100;
            p.style.height = isMin ? '45vh' : '36px'; 
            setTimeout(()=>map.invalidateSize(), 350); 
        }
        function switchTab(t) {
            const evt = arguments[1] || window.event;
            document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
            try{ if(evt && evt.currentTarget) evt.currentTarget.classList.add('active'); else if(evt && evt.target) evt.target.closest('button').classList.add('active'); }catch(e){}
            ['map','logs','table-container'].forEach(x=>{ const el=document.getElementById(x); if(el) el.style.display='none'; });
            const showId = (t==='table') ? 'table-container' : t;
            const toShow = document.getElementById(showId);
            if(toShow) toShow.style.display = 'block';
            if(document.getElementById('bottom-panel').offsetHeight < 100) togglePanelHeight();
            if(t==='map') setTimeout(()=>map.invalidateSize(), 300);
        }

        function log(m, t) { 
            const l = document.getElementById('logs'); 
            const ts = new Date().toLocaleTimeString();
            l.innerHTML += `<div style="color:${t==='err'?'#e74c3c':(t==='success'?'#2ecc71':'#bbb')};margin-bottom:4px"><span style="opacity:0.5">[${ts}]</span> ${m}</div>`; 
            l.scrollTop = l.scrollHeight; 
        }
        function showToast(m, type) { 
            const t=document.getElementById('toast'); 
            document.getElementById('toast-msg').innerText=m; 
            t.className = 'visible'; 
            t.style.borderLeft = `4px solid ${type==='error'?'#e74c3c':'#2ecc71'}`;
            setTimeout(()=>t.className='', 3000); 
        }
        
        async function loadFile(input, id) {
            const file = input.files[0];
            if (!file) return;
            const lbl = document.getElementById('lbl-' + id);
            lbl.innerText = "Leyendo...";
            
            try {
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
                } else if (file.name.match(/\.gpkg$/i)) {
                    try {
                        let geoFeatures = [];
                        if(window.GeoPackageAPI && window.GeoPackageAPI.open) {
                            const gp = await window.GeoPackageAPI.open(buffer);
                            const tables = gp.getFeatureTables ? gp.getFeatureTables() : (gp.getTables ? gp.getTables() : []);
                            for(const t of tables){ try{ if(gp.getGeoJSONFeatures) { const gj = gp.getGeoJSONFeatures(t); if(gj && gj.features) geoFeatures.push(...gj.features); } }catch(e){} }
                        } else if(window.GeoPackage && window.GeoPackage.open) {
                            const gp = await window.GeoPackage.open(buffer);
                            const tables = gp.getFeatureTables ? gp.getFeatureTables() : (gp.getTables ? gp.getTables() : []);
                            for(const t of tables){ try{ if(gp.getGeoJSONFeatures) { const gj = gp.getGeoJSONFeatures(t); if(gj && gj.features) geoFeatures.push(...gj.features); } }catch(e){} }
                        }
                        if(geoFeatures.length === 0) throw new Error('No features found in GPKG');
                        geojson = turf.featureCollection(geoFeatures);
                    } catch(e){ throw new Error('GPKG: ' + e.message); }
                } else if (file.name.match(/\.parquet$/i)) {
                    try {
                        if(!window.parquet || !window.parquet.ParquetReader) throw new Error('parquetjs-lite missing');
                        const reader = await parquet.ParquetReader.openBuffer(buffer);
                        const cursor = reader.getCursor();
                        const features = [];
                        let record = null;
                        while((record = await cursor.next())){
                            if(record.geometry){ try{ const g = typeof record.geometry === 'string' ? wellknown(record.geometry) : record.geometry; features.push(turf.feature(g, record)); continue; }catch(e){} }
                            if((record.lon!==undefined && record.lat!==undefined) || (record.longitude!==undefined && record.latitude!==undefined)){
                                const lon = record.lon!==undefined?record.lon:record.longitude; const lat = record.lat!==undefined?record.lat:record.latitude;
                                features.push(turf.point([Number(lon), Number(lat)], record));
                            }
                        }
                        if(features.length===0) throw new Error('No geo columns in parquet');
                        geojson = turf.featureCollection(features);
                    } catch(e){ throw new Error('Parquet: ' + e.message); }
                } else {
                    throw new Error("Formato no soportado");
                }

                geojson = ensureFC(geojson);
                document.getElementById('d-' + id).value = JSON.stringify(geojson);
                lbl.innerText = `${file.name} (${geojson.features.length} feats)`;
                lbl.style.color = "#2ecc71";
            } catch (e) {
                console.error(e);
                lbl.innerText = "Error lectura";
                lbl.style.color = "#e74c3c";
                alert("Error: " + e.message);
            }
        }

        function download(c,n,t){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([c],{type:t})); a.download=n; a.click(); }
        function toCSV(g){ 
            if(!g || !g.features || g.features.length===0) return "";
            const props = new Set();
            g.features.forEach(f=>Object.keys(f.properties||{}).forEach(k=>props.add(k)));
            const h=Array.from(props);
            const escape = v => {
                if(v === null || v === undefined) return '';
                if(typeof v === 'object') v = JSON.stringify(v);
                v = String(v);
                if(v.includes('"')) v = v.replace(/"/g, '""');
                if(v.includes(',') || v.includes('\n') || v.includes('"')) return '"'+v+'"';
                return v;
            };
            const rows = g.features.map(f => h.map(k => escape(f.properties?f.properties[k]:'')).join(','));
            return h.join(',') + '\n' + rows.join('\n');
        }
        function toKML(g){ return '<?xml version="1.0" encoding="UTF-8"?><kml><Document>'+g.features.map(f=>`<Placemark><name>${f.properties.id||f.properties.name||''}</name><description>${JSON.stringify(f.properties)}</description>${tokmlgeo(f.geometry)}</Placemark>`).join('')+'</Document></kml>'; }
        function tokmlgeo(g){ 
            if(!g) return '';
            const c = g.coordinates;
            if(g.type==='Point') return `<Point><coordinates>${c.join(',')}</coordinates></Point>`;
            if(g.type==='LineString') return `<LineString><coordinates>${c.map(p=>p.join(',')).join(' ')}</coordinates></LineString>`;
            if(g.type==='Polygon') return `<Polygon><outerBoundaryIs><LinearRing><coordinates>${c[0].map(p=>p.join(',')).join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
            return '';
        }
        function clearCanvas(){ 
            if(!confirm("¿Borrar todo?")) return;
            editor.clear(); 
            SafeStorage.clear('jetl_flow_optimized'); 
            map.eachLayer(l => { if(!!l.toGeoJSON) { map.removeLayer(l); layerControl.removeLayer(l); } });
            mapLayers = {}; executionData = {};
            log("Canvas limpio.");
        }

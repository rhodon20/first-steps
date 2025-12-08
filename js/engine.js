

        // =============================================
        // 3. ENGINE & EVENTS
        // =============================================
        let editor, map, mapLayers={}, executionData={};

        function normalizeResult(res){
            if(!res) return null;
            if(res.type === 'Feature') return turf.featureCollection([res]);
            if(res.type === 'FeatureCollection') return res;
            if(Array.isArray(res) && res.length && res[0].type) return turf.featureCollection(res);
            const keys = Object.keys(res||{});
            if(keys.some(k=>k && k.startsWith && k.startsWith('output_'))) return res;
            if(res && res.geometry) return turf.featureCollection([turf.feature(res.geometry, res.properties||{})]);
            return res;
        }

        function resolvePort(parentRes, parentPort){
            if(!parentRes) return null;
            if(parentRes.type === 'FeatureCollection' || parentRes.type === 'Feature') return normalizeResult(parentRes);
            if(typeof parentRes === 'object'){
                if(parentPort && parentRes[parentPort]) return normalizeResult(parentRes[parentPort]);
                if(parentRes.output_1) return normalizeResult(parentRes.output_1);
                if(parentRes.output) return normalizeResult(parentRes.output);
            }
            return null;
        }

        // WORKER SETUP
        let geoWorker = null;
        function createGeoWorker(){
            try{
                const code = `importScripts('https://unpkg.com/@turf/turf@6/turf.min.js');importScripts('https://unpkg.com/jsts/dist/jsts.min.js');importScripts('https://unpkg.com/rbush@3.0.1/rbush.min.js');self.onmessage = async function(e){const msg=e.data; if(!msg||!msg.task)return; if(msg.task==='clip'){try{const features=msg.features;const mask=msg.mask;if(!features||!features.features||!mask)throw new Error('Invalid payload');const res=[];const bbox=turf.bbox(mask);const maskPolyBbox=turf.bboxPolygon(bbox);const CHUNK=msg.chunk||50;const reader=new jsts.io.GeoJSONReader();const writer=new jsts.io.GeoJSONWriter();function jstsIntersectFeature(a,b){try{const ga=reader.read(a.geometry||a);const gb=reader.read(b.geometry||b);const inter=ga.intersection(gb);if(!inter) return null; if(typeof inter.isEmpty==='function' && inter.isEmpty()) return null;const gj=writer.write(inter);if(!gj) return null; return turf.feature(gj,a.properties||{});}catch(e){return null;}}
const tree = new rbush();const items = features.features.map((f,idx)=>{const bb=turf.bbox(f);return {minX:bb[0],minY:bb[1],maxX:bb[2],maxY:bb[3],__idx:idx};});tree.load(items);
const candItems = tree.search({minX:bbox[0],minY:bbox[1],maxX:bbox[2],maxY:bbox[3]});
const candidateIndices = candItems.map(it=>it.__idx);
const startMs = Date.now();const candidateCount = candidateIndices.length;let processedCount = 0;
for(let ci=0; ci<candidateIndices.length; ci+=CHUNK){const sliceIdx = candidateIndices.slice(ci,ci+CHUNK);for(const idx of sliceIdx){const f = features.features[idx];try{const fBbox=turf.bbox(f);const fbPoly=turf.bboxPolygon(fBbox);if(!turf.booleanIntersects(fbPoly,maskPolyBbox)&&!turf.booleanContains(maskPolyBbox,fbPoly)&&!turf.booleanContains(fbPoly,maskPolyBbox)) continue;const type=turf.getType(f);if(type==='Polygon'||type==='MultiPolygon'){let clipped=null;try{clipped=jstsIntersectFeature(f,mask);}catch(e){clipped=null;}if(!clipped){try{clipped=turf.intersect(f,mask);}catch(err){clipped=null;}}if(clipped){clipped.properties=f.properties||{};res.push(clipped);processedCount++;} }else if(type.includes('Point')){try{if(turf.booleanPointInPolygon(f,mask)){res.push(f);processedCount++;}}catch(_){} } }catch(_){} }await new Promise(r=>setTimeout(r,0));}
const durationMs = Date.now() - startMs;self.postMessage({taskId:msg.taskId,status:'ok',data:turf.featureCollection(res),stats:{processedCount:processedCount,candidateCount:candidateCount,durationMs:durationMs}});}catch(err){self.postMessage({taskId:msg.taskId,status:'err',message:err&&err.message?err.message:String(err),stats:{processedCount:0,candidateCount:0,durationMs:0}});} }};`;
                const blob = new Blob([code], {type:'application/javascript'});
                geoWorker = new Worker(URL.createObjectURL(blob));
            }catch(e){ console.warn('Worker init failed:', e); geoWorker = null; }
        }

        function postWorkerTask(payload, timeoutMs=30000){
            return new Promise((resolve,reject)=>{
                if(!geoWorker) return reject(new Error('No worker'));
                const taskId = 'task_'+Date.now()+'_'+Math.random().toString(36).slice(2);
                payload.taskId = taskId;
                let cleared = false;
                const onMsg = function(e){ const d = e.data || {}; if(d.taskId !== taskId) return; if(cleared) return; cleared = true; clearTimeout(timer); geoWorker.removeEventListener('message', onMsg); if(d.status==='ok' || d.status==='partial') return resolve(d); return reject(new Error(d.message||'Worker error')); };
                const timer = setTimeout(()=>{ if(cleared) return; cleared = true; geoWorker.removeEventListener('message', onMsg); reject(new Error('Worker timeout')); }, timeoutMs);
                geoWorker.addEventListener('message', onMsg);
                geoWorker.postMessage(payload);
            });
        }

        window.onload = function() {
            // MAPA
            map = L.map('map', { renderer: L.canvas() }).setView([40.416, -3.703], 6);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OSM contributors' }).addTo(map);
            layerControl = L.control.layers(null, {}, {position: 'topright', collapsed: true}).addTo(map);

            // DRAWFLOW
            editor = new Drawflow(document.getElementById("drawflow"));
            editor.reroute = true;
            editor.reroute_fix_curvature = true;
            editor.start();

            // Auto-Save / Restore
            const saved = SafeStorage.load('jetl_flow_optimized');
            if(saved) try { editor.import(JSON.parse(saved)); } catch(e){ console.error(e); }

            ['nodeCreated','nodeRemoved','connectionCreated','connectionRemoved'].forEach(ev => {
                editor.on(ev, ()=>SafeStorage.save('jetl_flow_optimized', JSON.stringify(editor.export())));
            });
            
            // Evento Click
            editor.on('click', (e)=>{
                const el = e.target.closest('.drawflow-node');
                if(el) {
                    const id = el.id.replace('node-','');
                    currentNodeId = id;
                    document.querySelectorAll('.drawflow-node').forEach(n=>n.classList.remove('selected'));
                    el.classList.add('selected');
                    // Mostrar datos si existen
                    if(executionData[id] && executionData[id].data) {
                        buildTable(executionData[id].data);
                    }
                } else {
                    document.querySelectorAll('.drawflow-node').forEach(n=>n.classList.remove('selected'));
                    currentNodeId = null;
                }
            });

            renderSidebar('');
            document.getElementById('sys-status').style.background = '#2ecc71';
            createGeoWorker();
            initQuickSearch();
        };

        // --- SIDEBAR MEJORADA ---
        function renderSidebar(filter) {
            const container = document.getElementById('sidebar-content');
            container.innerHTML = '';
            const cats = {};
            Object.entries(TOOL_REGISTRY).forEach(([k,tool])=>{
                if(filter && !tool.label.toLowerCase().includes(filter.toLowerCase())) return;
                if(!cats[tool.cat]) cats[tool.cat] = [];
                cats[tool.cat].push({k,...tool});
            });

            const sortedCats = Object.keys(cats).sort();

            sortedCats.forEach(c => {
                const group = document.createElement('div');
                group.className = 'cat-group';
                
                const title = document.createElement('div');
                title.className = 'cat-title';
                title.innerHTML = `<span>${c}</span> <i class="fas fa-chevron-down"></i>`;
                
                const itemsDiv = document.createElement('div');
                itemsDiv.className = 'cat-items';
                
                if(filter && filter.length > 0) {
                    itemsDiv.classList.add('open');
                    title.classList.add('active');
                }

                title.onclick = () => {
                    itemsDiv.classList.toggle('open');
                    title.classList.toggle('active');
                };

                cats[c].forEach(t => {
                    itemsDiv.innerHTML += `<div class="node-item" draggable="true" ondragstart="drag(event)" data-k="${t.k}" onclick="addNodeClick('${t.k}')">
                        <i class="fas ${t.icon}" style="color:${t.color}"></i> ${t.label}
                    </div>`;
                });

                group.appendChild(title);
                group.appendChild(itemsDiv);
                container.appendChild(group);
            });
        }
        function filterTools(val) { renderSidebar(val); }

        // --- QUICK SEARCH ---
        let qsMousePos = {x:0, y:0};

        function initQuickSearch() {
            const qs = document.getElementById('quick-search');
            const input = document.getElementById('qs-input');
            const results = document.getElementById('qs-results');
            const workspace = document.getElementById('workspace');

            workspace.addEventListener('mousemove', (e) => {
                if(qs.style.display !== 'block') {
                    qsMousePos = {x: e.clientX, y: e.clientY};
                }
            });

            document.addEventListener('keydown', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
                
                if (e.key.length === 1 && e.key.match(/[a-z0-9]/i)) {
                    if (qs.style.display !== 'block') {
                        qs.style.display = 'block';
                        qs.style.top = Math.min(qsMousePos.y, window.innerHeight - 300) + 'px';
                        qs.style.left = Math.min(qsMousePos.x, window.innerWidth - 300) + 'px';
                        input.value = '';
                        input.focus();
                    }
                }
                
                if (e.key === 'Escape') closeQS();
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const sel = results.querySelector('.selected');
                    if(sel) { addNode(sel.dataset.k, parseInt(qs.style.left), parseInt(qs.style.top)); closeQS(); }
                } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const current = results.querySelector('.selected');
                    const items = Array.from(results.querySelectorAll('.qs-item'));
                    let idx = items.indexOf(current);
                    if(idx === -1 && items.length > 0) idx = 0;
                    else if(e.key === 'ArrowDown') idx = Math.min(idx + 1, items.length - 1);
                    else idx = Math.max(idx - 1, 0);
                    
                    items.forEach(i=>i.classList.remove('selected'));
                    if(items[idx]) { items[idx].classList.add('selected'); items[idx].scrollIntoView({block:'nearest'}); }
                }
            });

            input.addEventListener('keyup', (e) => {
                if(['ArrowUp','ArrowDown','Enter'].includes(e.key)) return;
                const val = input.value.toLowerCase();
                results.innerHTML = '';
                const matches = Object.entries(TOOL_REGISTRY).filter(([k,t]) => t.label.toLowerCase().includes(val) || t.cat.toLowerCase().includes(val));
                
                matches.slice(0, 10).forEach(([k, t], i) => {
                    const item = document.createElement('div');
                    item.className = 'qs-item' + (i===0?' selected':'');
                    item.dataset.k = k;
                    item.innerHTML = `<i class="fas ${t.icon}" style="color:${t.color}"></i> ${t.label} <span style="font-size:0.7em;opacity:0.5;margin-left:auto">${t.cat}</span>`;
                    item.onclick = () => { addNode(k, parseInt(qs.style.left), parseInt(qs.style.top)); closeQS(); };
                    results.appendChild(item);
                });
            });

            function closeQS() { qs.style.display = 'none'; input.value = ''; document.activeElement.blur(); }
            document.addEventListener('click', (e) => { if(qs.style.display==='block' && !qs.contains(e.target)) closeQS(); });
        }

        // --- DRAWFLOW NODE LOGIC ---
        function drag(e){ e.dataTransfer.setData("node", e.target.dataset.k); }
        function drop(e){ e.preventDefault(); const k=e.dataTransfer.getData("node"); if(k) addNode(k, e.clientX, e.clientY); }
        function allowDrop(e){ e.preventDefault(); }
        
        function addNodeClick(k) {
            const rect = document.getElementById('drawflow').getBoundingClientRect();
            addNode(k, rect.width/2 + rect.left, rect.height/2 + rect.top);
            if(window.innerWidth < 768) toggleSidebar();
        }

        function addNode(k, x, y) {
            const t = TOOL_REGISTRY[k];
            let pos = {x:100, y:100};
            if(x && y) { 
                 // Cálculo manual de coordenadas para evitar error posFromWindow
                pos.x = x * (editor.precanvas.clientWidth / (editor.precanvas.clientWidth * editor.zoom)) - (editor.precanvas.getBoundingClientRect().x * (editor.precanvas.clientWidth / (editor.precanvas.clientWidth * editor.zoom)));
                pos.y = y * (editor.precanvas.clientHeight / (editor.precanvas.clientHeight * editor.zoom)) - (editor.precanvas.getBoundingClientRect().y * (editor.precanvas.clientHeight / (editor.precanvas.clientHeight * editor.zoom)));
            }

            const isJunc = k === 'util_junction';
            const html = isJunc ? `<div class="junction-point"></div>` :
                `<div class="node-head" style="border-bottom:3px solid ${t.color}">
                    <div style="display:flex;align-items:center;">
                        <span class="count-badge" id="b-NODEID">0</span>
                        <span><i class="fas ${t.icon}"></i> ${t.label}</span>
                    </div>
                    <div class="node-actions">
                        <i class="fas fa-play-circle node-btn" title="Ejecutar hasta aquí" onclick="event.stopPropagation(); runEnginePartial('NODEID')"></i>
                        <i class="fas fa-eye node-btn eye-btn" id="eye-NODEID" title="Ver en Mapa" onclick="event.stopPropagation(); showOnMap('NODEID')"></i>
                        <i class="fas fa-times" style="cursor:pointer;opacity:0.6;margin-left:4px" onclick="editor.removeNodeId('node-NODEID')"></i>
                    </div>
                </div>
                <div class="node-body">${t.tpl('NODEID')}</div>`;
            
            const id = editor.addNode(k, t.in, t.out, pos.x, pos.y, isJunc?'junction':'', {}, html);
            const el = document.getElementById('node-'+id);
            if(el) el.innerHTML = el.innerHTML.replace(/NODEID/g, id);
        }

        // =============================================
        // ENGINE RECURSIVO & PARTIAL EXECUTION
        // =============================================
        async function runEngine() {
            // "Run All": Ejecución total con nueva marca de tiempo
            const loader = document.getElementById('loader');
            loader.style.display = 'flex';
            log("--- INICIANDO EJECUCIÓN TOTAL ---");
            
            currentRunTimestamp = Date.now(); // Nueva ejecución
            
            // UI Reset
            document.querySelectorAll('.count-badge').forEach(b=>b.style.display='none');
            document.querySelectorAll('.eye-btn').forEach(b=>b.classList.remove('active'));
            
            await new Promise(r=>setTimeout(r,50));

            const exportData = editor.export().drawflow.Home.data;
            const nodes = Object.values(exportData);
            const roots = nodes.filter(n => TOOL_REGISTRY[n.name].in === 0);

            if(roots.length === 0) { log("Error: Añade un Reader", "err"); loader.style.display='none'; return; }

            try {
                for(const r of roots) await processNode(r.id, exportData);
                log("--- FIN EXITOSO ---");
                showToast("Proceso completado", "success");
                updateBadges(); // Actualizar colores al final
            } catch(e) {
                log("FATAL: " + e.message, "err");
                showToast("Error en ejecución", "error");
            }
            loader.style.display = 'none';
        }

        // Nueva función: Ejecución Parcial ("Pull" approach)
        async function runEnginePartial(targetId) {
            const loader = document.getElementById('loader');
            loader.style.display = 'flex';
            log(`--- Ejecución Parcial hasta nodo #${targetId} ---`);
            
            currentRunTimestamp = Date.now(); // Nueva marca de tiempo para lo que se calcule ahora

            try {
                const exportData = editor.export().drawflow.Home.data;
                await processNode(targetId, exportData);
                
                log("--- Parcial Completado ---");
                showToast("Nodo actualizado", "success");
                
                updateBadges(); // Actualizar colores (Verde lo nuevo, Naranja lo viejo)
                
                // Mostrar resultados del nodo objetivo automáticamente
                if(executionData[targetId] && executionData[targetId].data) {
                    const res = executionData[targetId].data;
                     if(TOOL_REGISTRY[editor.getNodeFromId(targetId).name].out === 0) {
                        // Es writer, no hacemos nada especial visualmente mas que log
                     } else {
                        showOnMap(targetId);
                        buildTable(res);
                     }
                }

            } catch(e) {
                log("Error Parcial: " + e.message, "err");
                showToast("Error en ejecución parcial", "error");
            }
            loader.style.display = 'none';
        }
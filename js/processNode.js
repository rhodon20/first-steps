
        async function processNode(id, allNodes) {
            // 1. Check if already processed IN THIS RUN (Memoization strict for current run)
            if(executionData[id] && executionData[id]._runId === currentRunTimestamp) {
                return executionData[id].data;
            }

            const nodeData = allNodes[id];
            const tool = TOOL_REGISTRY[nodeData.name];
            const dom = document.getElementById('node-'+id);

            // Inputs Recursivos (Recursive Pull)
            const inputs = [];
            for(let i=1; i <= tool.in; i++) {
                try {
                    const key = 'input_'+i;
                    const inputSlot = nodeData.inputs && nodeData.inputs[key];
                    if(!inputSlot || !inputSlot.connections || inputSlot.connections.length === 0) { inputs.push(null); continue; }
                    const conns = inputSlot.connections;
                    
                    // Aquí está la magia del Pull: llamamos recursivamente al padre
                    const parentId = conns[0].node;
                    const parentPort = conns[0].input;
                    
                    const parentRes = await processNode(parentId, allNodes); // RECURSION
                    const resolved = resolvePort(parentRes, parentPort);
                    inputs.push(resolved);
                } catch(e) { inputs.push(null); }
            }

            if(dom) dom.style.opacity = '0.6';
            document.getElementById('loader-msg').innerText = `Ejecutando ${tool.label}...`;
            await new Promise(r=>setTimeout(r,10));

            let result = null;
            try {
                const safeInputs = inputs.map(i => i ? JSON.parse(JSON.stringify(i)) : null);
                if(tool.in > 0) {
                    const anyValid = safeInputs.some(s => s && s.features && s.features.length>=0);
                    if(!anyValid) throw new Error("Input vacío/inválido");
                }
                result = await tool.run(id, safeInputs, dom);
                result = normalizeResult(result);
            } catch(e) {
                log(`[${tool.label}] ERROR: ${e.message}`, "err");
                if(dom) { dom.style.boxShadow = "0 0 0 2px #c0392b"; dom.style.opacity = '1'; }
                throw e; 
            }

            if(dom) dom.style.opacity = '1';
            
            // GUARDAR RESULTADO + TIMESTAMP
            executionData[id] = {
                data: result,
                _runId: currentRunTimestamp
            };

            // Propagar hacia abajo para Run All (mantenemos lógica mixta)
             for(let i=1; i <= tool.out; i++) {
                if(nodeData.outputs['output_'+i]) {
                    const outputs = nodeData.outputs['output_'+i].connections;
                    // Solo iteramos, la recursión de processNode se encarga del cálculo
                }
             }
             
            return result;
        }

JETL Sunrise (Jav. ETL)

Un motor ETL geoespacial visual, serverless y de código abierto que se ejecuta completamente en tu navegador.

"Esta aplicación surge de la curiosidad por extender conocimientos en desarrollo web y geoespacial. Como usuario profesional de FME, y notando la falta de alternativas Open Source visuales y ligeras, decidí diseñar una app sencilla, sin instalación, que replique la metodología de 'Visual Programming' de los Workspaces de FME."

¿Qué es JETL?

JETL (Jav. Extract, Transform, Load) es una herramienta de procesamiento de datos espaciales que no requiere instalación, servidores ni configuraciones complejas. Funciona como un único archivo HTML que orquesta librerías potentes como Turf.js y Leaflet bajo una interfaz de flujo de nodos (basada en Drawflow).

- Es ideal para:

- Prototipado rápido de flujos espaciales.

- Conversión de formatos (SHP, KML, GeoJSON) al vuelo.

- Análisis espacial ligero sin abrir un SIG de escritorio pesado.

- Entorno educativo para entender geoprocesos.

Características Principales
- 100% Client-Side: Todo el procesamiento ocurre en la memoria de tu navegador. Tus datos no salen de tu PC.

- Sin Instalación: Simplemente abre el archivo index.html en Chrome, Firefox o Edge.

- Interfaz Visual (Flow-based): Arrastra, suelta y conecta nodos al estilo FME o ModelBuilder.

- Persistencia: El flujo de trabajo se guarda automáticamente en el LocalStorage.

Visualización Integrada:

- Mapa interactivo (Leaflet) con soporte de capas oscuras.

- Tabla de atributos para inspección de datos.

- Consola de logs en tiempo real.

🛠️ Capacidades y Transformadores
El sistema cuenta con más de 40 transformadores categorizados para cubrir las necesidades típicas de un flujo ETL:

1. Inputs (Extract)
- File Reader: Soporte para .geojson, .json, .kml y .zip (Shapefiles comprimidos).

- OSM Reader: Descarga datos reales de OpenStreetMap (edificios, carreteras, parques) usando Overpass API.

- Generators: Grillas (Hex/Cuadrada), Puntos aleatorios, WKT manual.

2. Geometría (Spatial Transform)
- Manipulación: Buffers, Centroides, Envolventes (Convex/Concave Hull), Voronoi.

- Topología: Simplificación, Suavizado (Bezier), Densificación, Limpieza de coordenadas.

- Conversión: Línea a Polígono, Polígono a Línea, Multipart a Singlepart (Explode).

3. Análisis Espacial
- Relaciones: Intersect, Contains, Disjoint, Within.

- Procesos: Clipping (Recorte), Erase (Diferencia), Unión (Dissolve/Merge).

- Clustering: K-Means y DBSCAN.

- Interpolación: Isolíneas y TIN Grids.

4. Atributos (Alfanumérico)
- Calculadora: Expresiones JavaScript personalizadas para crear o modificar campos.

- Gestión: Renombrar, Eliminar, Mantener, Mapear valores, Concatenar, Split.

- Estadísticas: Cálculo de Área y Longitud geodésica.

5. Outputs (Load)
- Descarga de resultados en GeoJSON, KML o CSV.

Instalación y Uso
No hay npm install. No hay pip install.

- Descarga: Clona este repositorio o descarga el archivo index.html.

- Ejecuta: Haz doble clic en index.html para abrirlo en tu navegador favorito.

- Crea:

  - Arrastra un nodo Reader (ej. OSM Reader).

  - Arrastra un nodo de Geometría (ej. Buffer).

  - Conecta la salida del Reader a la entrada del Buffer.

  - Pulsa el botón RUN (verde) en la barra superior.

  - Inspecciona: Haz clic en el nodo procesado para ver la tabla de datos y pulsa "Ver en Mapa".

Tecnologías Utilizadas
Este proyecto es posible gracias a estas increíbles librerías Open Source:

- Turf.js: El motor de análisis geoespacial.

- Drawflow: Para la interfaz de nodos y conexiones.

- Leaflet: Para la visualización de mapas.

- shpjs: Para la lectura de Shapefiles binarios.

- osmtogeojson: Conversión de datos OSM.

- Proj4js: Reproyección de coordenadas.

Estado del Proyecto y Limitaciones
- Estado: Experimental / Alpha.

- Rendimiento: Al ejecutarse en el navegador (JavaScript monohilo), el rendimiento depende de tu CPU y RAM. No se recomienda para datasets masivos (millones de puntos) sin esperar tiempos de carga, aunque el código incluye optimizaciones para evitar bloqueos totales.

- Persistencia: Los datos cargados (archivos) no se guardan entre sesiones, solo la estructura del flujo (nodos y conexiones).

Contribuciones

- ¡Las contribuciones son bienvenidas! Si tienes una idea para un nuevo "Transformer" o una mejora en la UI:

- Haz un Fork del repositorio.

- Crea una rama (git checkout -b feature/NuevoTransformer).

- Haz Commit de tus cambios.

- Abre un Pull Request.

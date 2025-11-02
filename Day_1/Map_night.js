        // --- CONFIGURACIÓN INICIAL ---
        const canvas = document.getElementById('mapCanvas');
        const context = canvas.getContext('2d');
        const mapContainer = document.getElementById('map-container');
        const timeDisplay = document.getElementById('currentTime');
        const updateButton = document.getElementById('updateButton');
        const projectionSelector = document.getElementById('projectionSelector');

        const sphere = ({type: "Sphere"});
        const graticule = d3.geoGraticule10();
        let projection = d3.geoNaturalEarth1(); // La proyección inicial
        let path = d3.geoPath(projection, context); // El path se actualizará con la proyección

        // --- LÓGICA DEL TERMINADOR (DÍA/NOCHE) ---

        const antipode = ([longitude, latitude]) => [longitude + 180, -latitude];

        function getSunPosition() {
            const now = new Date();
            const day = new Date(+now).setUTCHours(0, 0, 0, 0);
            const t = solar.century(now);
            const longitude = (day - now) / 864e5 * 360 - 180;
            return [longitude - solar.equationOfTime(t) / 4, solar.declination(t)];
        }

        function getNightCircle() {
            const sunPosition = getSunPosition();
            return d3.geoCircle()
                .radius(90)
                .center(antipode(sunPosition))
                ();
        }

        // --- MANEJO DE PROYECCIONES ---
        function getProjectionByName(name) {
            switch(name) {
                case "NaturalEarth1": return d3.geoNaturalEarth1();
                case "Mercator": return d3.geoMercator();
                case "Orthographic": return d3.geoOrthographic();
                case "ConicEqualArea": return d3.geoConicEqualArea(); 
                default: return d3.geoNaturalEarth1();
            }
        }

        function drawMap(land) {
            
            // 1. Lógica de Responsividad
            const width = mapContainer.clientWidth;
            
            path = d3.geoPath(projection, context);

            if (projection.center) { // La mayoría de las proyecciones tienen un centro
                 if (projection.rotate) { // Para geoOrthographic
                    // Mueve el centro de la proyección para seguir la posición del sol
                    const sunPos = getSunPosition();
                    projection.rotate([-sunPos[0], -sunPos[1], 0]);
                } else {
                    projection.fitWidth(width, sphere);
                }
            } else { // Para proyecciones sin 'center' ni 'fitWidth' (como d3.geoConicEqualArea() sin parámetros)
                projection.fitWidth(width, sphere);
            }

            // Calculamr la altura resultante para que no se deforme
            const [[x0, y0], [x1, y1]] = d3.geoPath(projection).bounds(sphere);
            const height = Math.ceil(y1 - y0);
            
            canvas.width = width;
            canvas.height = height;

            if (!projection.rotate) { // No centramos si la proyección se rota (orthographic)
                 projection.translate([width / 2, height / 2]);
            }
           

            // 2. Actualizar la hora en la UI
            const now = new Date();
            const utcTime = now.toUTCString().split(' ')[4];
            const mexicoTime = now.toLocaleString("es-MX", {
                timeZone: "America/Mexico_City",
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            timeDisplay.innerHTML = `<strong>UTC:</strong> ${utcTime} &nbsp;|&nbsp; <strong>Centro de México:</strong> ${mexicoTime}`;


            // 3. Dibujar el mapa en el Canvas
            
            context.clearRect(0, 0, width, height); // Borramos el canvas anterior

            // Dibujamos la retícula (líneas grises)
            context.beginPath();
            path(graticule);
            context.strokeStyle = "rgba(119,119,119,0.5)";
            context.lineWidth = 0.5;
            context.stroke();

            // Dibujamos la esfera (el borde del mundo)
            context.beginPath();
            path(sphere);
            context.strokeStyle = "#000";
            context.lineWidth = 1.5;
            context.stroke();
            
            // Dibujamos los continentes (land)
            context.beginPath();
            path(land);
            context.fillStyle = "#444"; // Color tierra
            context.fill();

            // Dibujamos el círculo de la noche
            const night = getNightCircle();
            context.beginPath();
            path(night);
            context.fillStyle = "rgba(0, 0, 50, 0.35)"; // Color noche
            context.fill();
        }

        // --- CARGA DE DATOS Y EJECUCIÓN ---

        async function initializeMap() {
            const worldUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json";
            
            try {
                const world = await d3.json(worldUrl);
                const land = topojson.feature(world, world.objects.land);

                const redraw = () => drawMap(land);

                // Event listener para el selector de proyecciones
                projectionSelector.addEventListener('change', (event) => {
                    projection = getProjectionByName(event.target.value);
                    // Para la proyección ortográfica, necesitamos que rote automáticamente
                    if (event.target.value === "Orthographic") {
                        // Guardamos el intervalo de rotación si existe
                        if (window.rotationInterval) clearInterval(window.rotationInterval);
                        // Y creamos uno nuevo que rota la vista
                        window.rotationInterval = setInterval(() => {
                           const sunPos = getSunPosition();
                           projection.rotate([-sunPos[0], -sunPos[1], 0]);
                           drawMap(land);
                        }, 1000); // 1 segundo para una rotación más fluida
                    } else {
                        // Si no es ortográfica, paramos la rotación si estaba activa
                        if (window.rotationInterval) clearInterval(window.rotationInterval);
                        // Restablecemos el centro si la proyección lo permite y lo necesita
                        if (projection.center) projection.center([0,0]); 
                    }
                    redraw(); // Redibujamos con la nueva proyección
                });


                redraw();
                setInterval(redraw, 60000);
                window.addEventListener('resize', redraw);
                updateButton.addEventListener('click', redraw);

            } catch (error) {
                console.error("Error al cargar los datos del mapa:", error);
                mapContainer.innerHTML = "Error al cargar el mapa. Revisa la consola.";
            }
        }

        initializeMap();
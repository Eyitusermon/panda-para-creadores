const fs = require('fs');
const path = require('path');

const categoriesData = [
  {
    category: 'Videojuegos & Gaming',
    icon: '🎮',
    topics: [
      {
        title: 'Preferencias de Plataformas de Videojuegos',
        desc: 'Tu experiencia con consolas, PC y plataformas gaming modernas.',
        questions: [
          { p: '¿En qué plataforma juegas con mayor frecuencia?', ops: ['PC Gaming', 'PlayStation 5 / 4', 'Xbox Series / One', 'Dispositivo Móvil / Tablet'] },
          { p: '¿Cuántas horas a la semana dedicas a jugar videojuegos?', ops: ['Menos de 5 horas', 'Entre 5 y 15 horas', 'Entre 15 y 30 horas', 'Más de 30 horas'] },
          { p: '¿Qué género de videojuegos prefieres habitualmente?', ops: ['Arcade y Crash Games', 'Shooters / Battle Royale (FPS)', 'RPG y Mundo Abierto', 'Estrategia y Simulación'] },
          { p: '¿Compras pases de batalla o microtransacciones estéticas?', ops: ['Con regularidad cada mes', 'Solo en ofertas especiales', 'Rara vez', 'Nunca compro micropagos'] },
          { p: '¿Sueles jugar en modo multijugador online o individual?', ops: ['Casi siempre multijugador con amigos', 'Multijugador con emparejamiento aleatorio', 'Prefiero el modo historia / solitario', 'Ambos por igual según el juego'] }
        ]
      },
      {
        title: 'Juegos de Azar y Juegos Arcade en Línea',
        desc: 'Opinión sobre dinámicas de Crash, Plinko y slots digitales.',
        questions: [
          { p: '¿Qué juego estilo casino te resulta más entretenido?', ops: ['Plinko de rebotes rápidos', 'Crash Rocket / Aviator', 'Cyber Mines / Buscaminas', 'Golden Slots clásicas'] },
          { p: '¿Qué factor valoras más al probar un juego arcade?', ops: ['Multiplicadores altos y emoción', 'Diseño visual y animaciones', 'Control manual de retiro rápido', 'Baja volatilidad y premios frecuentes'] },
          { p: '¿Prefieres partidas cortas y ágiles o sesiones largas?', ops: ['Partidas ultrarrápidas de segundos', 'Sesiones medianas de 10 a 20 minutos', 'Sesiones extendidas de relax', 'Depende de mi balance disponible'] },
          { p: '¿Utilizas la función de autoretiro o retiro manual?', ops: ['Siempre autoretiro programado', 'Casi siempre manual para mayor control', 'Alterno entre ambos', 'Nunca utilizo autoretiro'] },
          { p: '¿Te gustan las mecánicas con multiplicadores progresivos?', ops: ['Me encantan, son las más divertidas', 'Me gustan con riesgo moderado', 'Prefiero multiplicadores fijos', 'Me resultan indiferentes'] }
        ]
      },
      {
        title: 'Accesorios y Periféricos Gaming',
        desc: 'Equipamiento, pantallas y comodidad para largas sesiones.',
        questions: [
          { p: '¿Qué periférico consideras el más crucial para jugar?', ops: ['Ratón / Mouse de alta precisión', 'Auriculares con audio espacial 7.1', 'Monitor con alta tasa de refresco (144Hz+)', 'Mando / Control ergonómico'] },
          { p: '¿Prefieres periféricos inalámbricos o con cable?', ops: ['Totalmente inalámbricos por comodidad', 'Con cable por latencia ultra baja', 'Inalámbricos solo auriculares', 'Indiferente mientras funcionen bien'] },
          { p: '¿Tienes iluminación RGB en tu zona de juego?', ops: ['Sí, sincronizada en todo el setup', 'Solo en teclado o ratón', 'No tengo pero me gustaría', 'No me gusta la iluminación RGB'] },
          { p: '¿Usas silla ergonómica de oficina o silla gamer?', ops: ['Silla gamer deportiva', 'Silla ergonómica de oficina', 'Silla estándar convencional', 'Juego desde el sofá o cama'] },
          { p: '¿Con qué frecuencia renuevas tus periféricos?', ops: ['Cada año para estar actualizado', 'Cada 2 a 3 años', 'Solo cuando se dañan', 'Rara vez los renuevo'] }
        ]
      },
      {
        title: 'Juegos Móviles y Hábitos en Smartphones',
        desc: 'El auge del gaming en dispositivos iOS y Android.',
        questions: [
          { p: '¿Juegas en tu teléfono móvil habitualmente?', ops: ['Todos los días en ratos libres', 'Varios días a la semana', 'Solo en viajes o traslados', 'Casi nunca juego en el móvil'] },
          { p: '¿Qué sistema operativo tiene tu dispositivo principal?', ops: ['Android (Samsung, Xiaomi, etc.)', 'iOS (iPhone / iPad)', 'Uso ambos activamente', 'Otro sistema operativo'] },
          { p: '¿Te molestan los anuncios publicitarios en juegos móviles?', ops: ['Sí, arruinan la experiencia', 'Los tolero si dan recompensas', 'Pago para eliminarlos siempre', 'No me molestan en absoluto'] },
          { p: '¿Utilizas controles táctiles o mandos Bluetooth externos?', ops: ['Controles táctiles en pantalla', 'Mando gamepad por Bluetooth', 'Gatillos mecánicos para móvil', 'Solo juegos de un solo toque'] },
          { p: '¿Descargas juegos por recomendaciones de amigos o redes?', ops: ['Recomendaciones de amigos', 'Publicidad en TikTok / YouTube', 'Explorando la tienda de apps', 'Reseñas de creadores especializados'] }
        ]
      },
      {
        title: 'Comunidades de Jugadores y Esports',
        desc: 'Torneos profesionales, creadores de contenido y Discord.',
        questions: [
          { p: '¿Sigues transmisiones de Esports o torneos profesionales?', ops: ['Sí, sigo ligas enteras en vivo', 'Solo eventos mundiales destacados', 'Ocasionalmente resúmenes en YouTube', 'No sigo competiciones de Esports'] },
          { p: '¿Qué plataforma usas para ver transmisiones en directo?', ops: ['Twitch', 'YouTube Live', 'Kick', 'No suelo ver streams'] },
          { p: '¿Perteneces a comunidades activas en Discord de juegos?', ops: ['Sí, modero o participo a diario', 'Sí, pero solo para leer noticias', 'Tengo cuenta pero poco uso', 'No utilizo Discord'] },
          { p: '¿Has participado en torneos comunitarios o amateurs?', ops: ['Sí, con regularidad con mi equipo', 'En un par de ocasiones', 'Me gustaría pero aún no lo he hecho', 'No me interesa competir'] },
          { p: '¿Te motivan las tablas de clasificación y rankings mundiales?', ops: ['Mucho, juego para estar en el top', 'Me gusta comparar mi nivel con otros', 'Solo compito contra mi récord personal', 'No le presto atención a los rankings'] }
        ]
      },
      {
        title: 'Juegos Retro y Nostalgia',
        desc: 'La era dorada de los 8-bit, 16-bit y salones recreativos.',
        questions: [
          { p: '¿Te atraen los juegos con estética pixel-art o retro?', ops: ['Me encantan, tienen personalidad única', 'Me gustan si la jugabilidad es moderna', 'Prefiero gráficos hiperrealistas 3D', 'Me resultan anticuados'] },
          { p: '¿Llegaste a jugar en máquinas recreativas de fichas (Arcades)?', ops: ['Sí, pasé muchas tardes en salones arcade', 'Solo ocasionalmente de niño', 'Solo en emuladores o versiones modernas', 'Nunca he jugado en máquinas físicas'] },
          { p: '¿Cuál era tu consola favorita de generaciones pasadas?', ops: ['Super Nintendo / Sega Genesis', 'PlayStation 1 o 2 / Nintendo 64', 'Game Boy / Nintendo DS portátil', 'Empecé a jugar en épocas recientes'] },
          { p: '¿Comprarías una remasterización de tu juego clásico favorito?', ops: ['Sin dudarlo en el día de lanzamiento', 'Esperaría a ver opiniones y precio', 'Solo si incluye contenido nuevo', 'Prefiero jugar títulos 100% nuevos'] },
          { p: '¿Qué música de videojuegos recuerdas con más cariño?', ops: ['Chiptune 8/16-bits pegadizo', 'Bandas sonoras orquestales épicas', 'Música synthwave / futurista', 'Rock o metal enérgico'] }
        ]
      },
      {
        title: 'Realidad Virtual y Futuro del Gaming',
        desc: 'Inmersión con visores VR y mundos tridimensionales.',
        questions: [
          { p: '¿Has probado visores de Realidad Virtual (Meta Quest, PSVR)?', ops: ['Sí, tengo un visor en casa', 'Lo he probado en ferias o con amigos', 'Aún no lo he probado pero tengo curiosidad', 'No me llama la atención'] },
          { p: '¿Experimentas mareos o cinetosis en juegos de realidad virtual?', ops: ['Nunca me mareo en VR', 'Solo en giros muy bruscos o carreras', 'Sí, me cuesta acostumbrarme', 'No he probado lo suficiente'] },
          { p: '¿Crees que la VR reemplazará a las pantallas tradicionales?', ops: ['Sí, a largo plazo dominará el ocio', 'Convivirán como alternativas distintas', 'Solo será para nichos muy específicos', 'No creo que sustituya a monitores y TV'] },
          { p: '¿Qué experiencia en VR te gustaría probar más?', ops: ['Juegos de aventura y simulación', 'Casinos y salas de juegos sociales 3D', 'Conciertos y eventos en vivo', 'Recorridos virtuales de viajes'] },
          { p: '¿Cuánto pagarías por un visor de gama alta independiente?', ops: ['Menos de $300 USD', 'Entre $300 y $600 USD', 'Hasta $1,000 USD si es de élite', 'No planeo comprar visores VR'] }
        ]
      },
      {
        title: 'Servicios de Suscripción para Jugadores',
        desc: 'Game Pass, PlayStation Plus y bibliotecas digitales.',
        questions: [
          { p: '¿Cuentas con alguna suscripción activa tipo Game Pass o PS Plus?', ops: ['Sí, Xbox Game Pass Ultimate', 'Sí, PlayStation Plus Extra / Premium', 'Sí, más de una suscripción activa', 'No tengo ninguna suscripción gamer'] },
          { p: '¿Prefieres comprar juegos en propiedad o pagar mensualidad?', ops: ['Pagar suscripción con catálogo amplio', 'Comprar en digital para tener biblioteca', 'Comprar en formato físico coleccionable', 'Solo juego títulos Free to Play'] },
          { p: '¿Utilizas el juego en la nube (Cloud Gaming / xCloud)?', ops: ['A menudo desde teléfono o PC modesto', 'Solo para probar títulos sin descargarlos', 'Lo he probado pero prefiero instalar local', 'Nunca he jugado en la nube'] },
          { p: '¿Consideras justo el precio actual de los lanzamientos AAA ($70)?', ops: ['Muy elevado, espero siempre a rebajas', 'Aceptable si el juego ofrece +50 horas', 'Solo lo pago para mis 1 o 2 sagas favoritas', 'Prefiero el modelo gratuito con pases'] },
          { p: '¿Aprovechas los juegos gratis de plataformas como Epic Games?', ops: ['Reclamo religiosamente cada semana', 'Solo cuando regalan títulos muy conocidos', 'Tengo la cuenta pero olvido reclamar', 'No utilizo esas plataformas'] }
        ]
      },
      {
        title: 'Narrativa y Doblaje en Videojuegos',
        desc: 'Historias conmovedoras, cinemáticas y localización.',
        questions: [
          { p: '¿Qué importancia le das a la historia de un juego?', ops: ['Fundamental, busco tramas cinematográficas', 'Importante, pero la jugabilidad manda', 'Solo si no corta el ritmo de juego', 'Casi nula, suelo saltarme los diálogos'] },
          { p: '¿En qué idioma prefieres jugar títulos narrativos?', ops: ['Doblaje en Español Latino', 'Doblaje en Español de España', 'Audio original en inglés con subtítulos', 'Me da igual mientras esté subtitulado'] },
          { p: '¿Te gustan los juegos con finales múltiples según decisiones?', ops: ['Me fascinan, los rejuego para ver todos', 'Me gustan para una sola partida única', 'Prefiero un final canónico bien cerrado', 'Me da pereza repetir decisiones'] },
          { p: '¿Has llegado a emocionarte o llorar con el final de un juego?', ops: ['Sí, con historias muy emotivas', 'Alguna vez se me ha puesto la piel de gallina', 'No tanto como llorar, pero me ha impactado', 'Nunca me ha ocurrido'] },
          { p: '¿Prefieres cinemáticas largas o narrativa en tiempo real?', ops: ['Narrativa integrada en la jugabilidad', 'Cinemáticas espectaculares estilo película', 'Mezcla equilibrada de ambas', 'Pocas cinemáticas y mucha acción'] }
        ]
      },
      {
        title: 'Sonido y Música en el Gaming',
        desc: 'Efectos sonoros, bandas sonoras y concentración auditiva.',
        questions: [
          { p: '¿Juegas habitualmente con auriculares o altavoces?', ops: ['Auriculares cerrados para inmersión total', 'Altavoces o barra de sonido', 'Altavoces del televisor o monitor', 'Altavoz del móvil a volumen bajo'] },
          { p: '¿Escuchas tu propia música mientras juegas?', ops: ['Sí, siempre con Spotify de fondo', 'Solo en partidas casuales o arcade', 'Nunca, priorizo la música del juego', 'A veces escucho podcasts'] },
          { p: '¿Te ayuda el sonido a anticipar eventos en el juego?', ops: ['Totalmente, escucho pasos y señales clave', 'Me ayuda pero juego por vista principalmente', 'No suelo prestarle tanta atención técnica', 'A veces juego con volumen silenciado'] },
          { p: '¿Qué tipo de efectos de sonido te resultan más gratificantes?', ops: ['Sonido metálico de monedas o diamantes ganados', 'Explosiones y disparos potentes con bajos', 'Música victoriosa de victoria / nivel superado', 'Efectos retro de campanillas y bonus'] },
          { p: '¿Comprarías o escucharías la banda sonora de un juego en Spotify?', ops: ['Sí, tengo varias playlists de OST de juegos', 'Solo de temas principales icónicos', 'Rara vez fuera del juego', 'Nunca escucho música de videojuegos fuera'] }
        ]
      }
    ]
  },
  {
    category: 'Tecnología & Dispositivos',
    icon: '📱',
    topics: [
      {
        title: 'Smartphones y Renovación de Dispositivos',
        desc: 'Criterios de compra, cámaras, baterías y pantallas OLED.',
        questions: [
          { p: '¿Qué marca de smartphone utilizas actualmente?', ops: ['Apple iPhone', 'Samsung Galaxy', 'Xiaomi / Poco / Redmi', 'Motorola / Google Pixel / Otra'] },
          { p: '¿Cuál es el factor decisivo al comprar un teléfono nuevo?', ops: ['Duración de batería y carga rápida', 'Calidad de cámaras fotográficas', 'Rendimiento y fluidez del procesador', 'Precio ajustado y relación calidad/precio'] },
          { p: '¿Cada cuánto tiempo cambias de teléfono móvil?', ops: ['Cada año o 18 meses', 'Cada 2 a 3 años', 'Cada 4 años o cuando ya no funciona', 'Solo compro de segunda mano o reacondicionado'] },
          { p: '¿Prefieres pantallas grandes (+6.7") o compactas?', ops: ['Pantallas grandes para vídeos y juegos', 'Tamaño estándar equilibrado (6.1" a 6.4")', 'Dispositivos compactos manejables con una mano', 'Pantallas plegables tipo Fold o Flip'] },
          { p: '¿Utilizas fundas protectoras y vidrio templado?', ops: ['Sí, funda robusta y cristal desde el día 1', 'Solo funda delgada transparente', 'Solo cristal templado sin funda', 'Lo uso al descubierto sin protecciones'] }
        ]
      },
      {
        title: 'Inteligencia Artificial en el Día a Día',
        desc: 'Uso de chatbots, asistentes virtuales y automatización.',
        questions: [
          { p: '¿Con qué frecuencia utilizas herramientas de IA (ChatGPT, Gemini)?', ops: ['A diario para estudio o trabajo', 'Varias veces por semana', 'Solo para consultas curiosas esporádicas', 'Casi nunca utilizo IA generativa'] },
          { p: '¿Para qué tarea te resulta más útil la Inteligencia Artificial?', ops: ['Redacción y resumen de textos', 'Resolución de dudas y explicaciones de temas', 'Programación y código informático', 'Creatividad, ideas y entretenimiento'] },
          { p: '¿Confías plenamente en las respuestas generadas por IA?', ops: ['Confío pero siempre verifico datos clave', 'Confío bastante en tareas cotidianas', 'Tengo dudas frecuentes sobre la precisión', 'Desconfío de la mayoría de respuestas'] },
          { p: '¿Pagarías una suscripción mensual por una IA avanzada?', ops: ['Ya pago alguna versión Plus / Pro', 'Pagaría si aumentara mi productividad laboral', 'Solo utilizo versiones 100% gratuitas', 'No pagaría bajo ninguna circunstancia'] },
          { p: '¿Crees que la IA mejorará el futuro del empleo?', ops: ['Creará nuevas oportunidades y eficiencia', 'Eliminará empleos de forma preocupante', 'Transformará profesiones sin destruirlas', 'Aún es pronto para saber el impacto real'] }
        ]
      },
      {
        title: 'Ciberseguridad y Hábitos de Privacidad',
        desc: 'Contraseñas seguras, autenticación en dos pasos y VPNs.',
        questions: [
          { p: '¿Utilizas la autenticación en dos pasos (2FA) en tus cuentas?', ops: ['Sí, con app autenticadora (Google Auth)', 'Sí, mediante código por SMS / WhatsApp', 'Solo en el banco o monederos cripto', 'No la tengo activada en mis cuentas'] },
          { p: '¿Repites contraseñas entre distintos sitios web?', ops: ['Tengo contraseñas únicas con gestor', 'Uso variaciones de 2 o 3 contraseñas', 'Casi siempre la misma para no olvidarla', 'Uso inicio de sesión directo con Google/Apple'] },
          { p: '¿Has utilizado servicios de red privada virtual (VPN)?', ops: ['Sí, a diario para privacidad y navegación', 'Solo para acceder a catálogos extranjeros', 'Lo he probado en versión gratuita', 'Nunca he utilizado una VPN'] },
          { p: '¿Te preocupas por los permisos que conceden tus apps móviles?', ops: ['Reviso rigurosamente cámara, micrófono y GPS', 'Acepto lo básico pero rechazo rastreo', 'Suelo aceptar todo sin leer para continuar', 'No me fijo en los permisos solicitados'] },
          { p: '¿Has sufrido algún intento de estafa por phishing o SMS?', ops: ['Sí, pero lo identifiqué a tiempo', 'Sí, lamentablemente caí en una ocasión', 'He recibido mensajes sospechosos frecuentemente', 'Nunca he recibido intentos de estafa'] }
        ]
      },
      {
        title: 'Hogar Inteligente y Domótica',
        desc: 'Asistentes de voz, bombillas inteligentes y automatización.',
        questions: [
          { p: '¿Tienes algún asistente de voz en casa (Alexa, Google Nest)?', ops: ['Sí, altavoces inteligentes en varias habitaciones', 'Solo un altavoz en el salón o dormitorio', 'Solo el asistente integrado en mi teléfono', 'No uso ni quiero altavoces con micrófono'] },
          { p: '¿Qué dispositivo inteligente tienes o te gustaría tener?', ops: ['Bombillas e iluminación RGB programable', 'Cámaras de seguridad y timbres con vídeo', 'Enchufes inteligentes con monitor de consumo', 'Robot aspirador automático'] },
          { p: '¿Controlas electrodomésticos desde el smartphone?', ops: ['Sí, aire acondicionado, luces o TV', 'Solo para encender o apagar la televisión', 'No, prefiero controles manuales físicos', 'No tengo electrodomésticos conectados'] },
          { p: '¿Crees que la domótica ahorra energía eléctrica en el hogar?', ops: ['Sí, programando apagados y horarios clave', 'Ahorra comodidad más que dinero', 'Gasta más por los dispositivos siempre conectados', 'No he notado diferencias en la factura'] },
          { p: '¿Cuál es el mayor obstáculo para domotizar una casa?', ops: ['El precio elevado de los dispositivos', 'La complejidad de configuración', 'Preocupaciones por la privacidad', 'La falta de compatibilidad entre marcas'] }
        ]
      },
      {
        title: 'Computadoras Portátiles vs Sobremesa',
        desc: 'Elección de equipos para trabajo, estudio o entretenimiento.',
        questions: [
          { p: '¿Qué tipo de ordenador usas principalmente?', ops: ['Laptop / Portátil ligero', 'PC de escritorio o torre montada por piezas', 'MacBook / Mac Mini de Apple', 'Uso tableta como reemplazo de ordenador'] },
          { p: '¿Cuánto tiempo tiene tu ordenador actual?', ops: ['Menos de 1 año (casi nuevo)', 'Entre 1 y 3 años', 'Entre 3 y 6 años', 'Más de 6 años'] },
          { p: '¿Sueles trabajar o estudiar con un segundo monitor?', ops: ['Sí, doble o triple monitor indispensable', 'Tengo un monitor externo para el portátil', 'Solo con la pantalla única del equipo', 'Uso la televisión como pantalla secundaria'] },
          { p: '¿Cuál es la característica técnica que más revisas?', ops: ['Memoria RAM y almacenamiento SSD rápido', 'Tarjeta gráfica dedicada (GPU)', 'Potencia del procesador (CPU)', 'Peso, diseño y autonomía de batería'] },
          { p: '¿Has montado un ordenador por piezas alguna vez?', ops: ['Sí, yo mismo elegí y armé cada componente', 'He cambiado piezas sueltas (RAM, SSD)', 'Me lo armó un conocido o tienda', 'Nunca he abierto un ordenador'] }
        ]
      },
      {
        title: 'Almacenamiento en la Nube y Backups',
        desc: 'Google Drive, iCloud, OneDrive y discos externos.',
        questions: [
          { p: '¿Dónde guardas tus fotografías y documentos importantes?', ops: ['Google Fotos / Google Drive', 'iCloud de Apple', 'Disco duro externo / Memoria USB física', 'En la memoria interna del teléfono o PC'] },
          { p: '¿Pagas alguna cuota mensual por almacenamiento cloud extra?', ops: ['Sí, pago 100GB o 200GB (Google One / iCloud)', 'Sí, tengo 1TB o 2TB familiares', 'Solo aprovecho el espacio gratuito', 'Uso servicios gratuitos múltiples para ahorrar'] },
          { p: '¿Haces copias de seguridad de forma periódica?', ops: ['Copia automática diaria en la nube', 'Copia manual cada pocas semanas', 'Casi nunca hago copias de respaldo', 'Solo cuando voy a cambiar de dispositivo'] },
          { p: '¿Alguna vez has perdido fotos o datos por no tener backup?', ops: ['Sí, fue una experiencia muy frustrante', 'Casi pierdo datos pero pude recuperarlos', 'Nunca me ha ocurrido, soy muy precavido', 'No guardo información crítica'] },
          { p: '¿Prefieres tener copias físicas en discos o en servidores cloud?', ops: ['En la nube por accesibilidad en todo lugar', 'En discos físicos por control y privacidad', 'Estrategia 3-2-1: copia local y en nube', 'Donde sea más económico'] }
        ]
      },
      {
        title: 'Smartwatches y Pulseras de Actividad',
        desc: 'Monitoreo de salud, pasos, pulsaciones y notificaciones.',
        questions: [
          { p: '¿Llevas a diario algún reloj inteligente o pulsera smart?', ops: ['Apple Watch', 'Galaxy Watch / WearOS', 'Pulsera fitness básica (Xiaomi Band, etc.)', 'Prefiero relojes clásicos o no llevar nada'] },
          { p: '¿Qué función utilizas más en tu smartwatch?', ops: ['Contador de pasos y actividad física diaria', 'Lectura de notificaciones de WhatsApp / llamadas', 'Monitoreo de calidad de sueño', 'Control de música y alarmas silenciosas'] },
          { p: '¿Cuántos días suele durar la batería de tu reloj?', ops: ['1 día (debo cargarlo cada noche)', 'De 2 a 3 días', 'De 1 a 2 semanas', 'No utilizo reloj inteligente'] },
          { p: '¿Te ayuda el smartwatch a mantenerte más activo?', ops: ['Sí, cumplo metas diarias de pasos y calorías', 'Al principio sí, luego me acostumbré', 'Solo me sirve para mirar la hora y avisos', 'No me motiva para hacer más ejercicio'] },
          { p: '¿Pagarías con tu reloj mediante NFC en comercios?', ops: ['Pago casi todo con el reloj por comodidad', 'Solo cuando olvido la cartera o teléfono', 'No tengo configurado el pago por NFC', 'Prefiero pagar con tarjeta física o efectivo'] }
        ]
      },
      {
        title: 'Auriculares Inalámbricos y Cancelación de Ruido',
        desc: 'AirPods, buds y auriculares de diadema ANC.',
        questions: [
          { p: '¿Qué formato de auriculares prefieres para tu día a día?', ops: ['True Wireless de botón (AirPods, Galaxy Buds)', 'Auriculares de diadema cerrados sobre la oreja', 'Auriculares de cable clásicos', 'Auriculares de conducción ósea para deporte'] },
          { p: '¿Utilizas la función de Cancelación Activa de Ruido (ANC)?', ops: ['Imprescindible en transporte público y calle', 'La uso solo en aviones o viajes largos', 'Prefiero el modo transparencia o ambiente', 'Mis auriculares no tienen cancelación de ruido'] },
          { p: '¿Cuánto tiempo al día pasas con los auriculares puestos?', ops: ['Más de 4 horas (trabajo, gym, ocio)', 'Entre 1 y 3 horas al día', 'Menos de 1 hora al día', 'Solo los uso de manera muy puntual'] },
          { p: '¿Qué aspecto priorizas en unos auriculares inalámbricos?', ops: ['Calidad acústica y nitidez de graves', 'Comodidad y sujeción en la oreja', 'Duración de batería de la caja', 'Claridad de micrófono en llamadas'] },
          { p: '¿Has extraviado alguna vez un auricular suelto o la caja?', ops: ['Sí, he tenido que comprar reemplazo', 'Casi los pierdo pero aparecieron', 'Nunca los he perdido, soy muy ordenado', 'Solo uso auriculares con diadema o cable'] }
        ]
      },
      {
        title: 'Televisores y Entretenimiento en el Salón',
        desc: 'Tecnologías OLED, 4K, Smart TV y barras de sonido.',
        questions: [
          { p: '¿De cuántas pulgadas es la televisión principal de tu casa?', ops: ['Menos de 43 pulgadas', 'Entre 43 y 55 pulgadas', 'Entre 55 y 65 pulgadas', 'Más de 65 pulgadas o proyector'] },
          { p: '¿Qué sistema de Smart TV te parece más cómodo y fluido?', ops: ['Google TV / Android TV', 'LG webOS', 'Samsung Tizen OS', 'Dispositivo externo (Chromecast, Fire TV, Apple TV)'] },
          { p: '¿Utilizas barra de sonido o equipo de audio externo?', ops: ['Sí, barra de sonido con subwoofer', 'Sí, sistema envolvente 5.1 / Dolby Atmos', 'Solo los altavoces integrados de la TV', 'Uso auriculares conectados a la TV'] },
          { p: '¿Con qué frecuencia ves televisión tradicional por antena?', ops: ['Casi nunca, solo consumo plataformas de streaming', 'Solo para ver noticias o eventos deportivos en directo', 'Un par de horas a la semana', 'A diario sigo canales de televisión abierta'] },
          { p: '¿Juegas consolas en tu televisor principal?', ops: ['Sí, es mi pantalla principal para videojuegos', 'Solo juego títulos familiares o casuales', 'Prefiero jugar en monitor de escritorio', 'No tengo consolas conectadas a la TV'] }
        ]
      },
      {
        title: 'Movilidad Eléctrica y Tecnología Urbana',
        desc: 'Patinetes eléctricos, bicicletas a batería y coches EV.',
        questions: [
          { p: '¿Utilizas patinetes o bicicletas eléctricas en tu ciudad?', ops: ['Tengo patinete propio y lo uso a diario', 'Uso servicios de alquiler compartido por app', 'Solo bicicleta convencional sin motor', 'No utilizo vehículos de micromovilidad'] },
          { p: '¿Qué opinas de los coches eléctricos (Tesla, BYD, etc.)?', ops: ['Son el futuro indiscutible del transporte', 'Tecnología interesante pero aún con precio alto', 'Tienen problemas de autonomía e infraestructura', 'Prefiero motores híbridos o de combustión'] },
          { p: '¿Comprarías un vehículo 100% eléctrico en los próximos 3 años?', ops: ['Sí, mi próximo coche será eléctrico', 'Prefiero optar por un híbrido enchufable', 'Esperaré a que madure la red de cargadores', 'No planeo comprar vehículo eléctrico'] },
          { p: '¿Qué aplicación de mapas y navegación usas más?', ops: ['Google Maps', 'Waze por los avisos de tráfico en tiempo real', 'Apple Maps', 'Transporte público local (Moovit, etc.)'] },
          { p: '¿Qué beneficio consideras mayor en la movilidad eléctrica?', ops: ['Cero emisiones y reducción de contaminación', 'Ahorro en combustible frente a gasolina', 'Conducción silenciosa y suave', 'Acceso a zonas de bajas emisiones urbanas'] }
        ]
      }
    ]
  },
  {
    category: 'Criptomonedas & Finanzas Digitales',
    icon: '💎',
    topics: [
      {
        title: 'Uso de USDT y Stablecoins en el Día a Día',
        desc: 'Dólares digitales, transferencias TRC-20 y ahorro estable.',
        questions: [
          { p: '¿Utilizas la stablecoin USDT (Tether) habitualmente?', ops: ['Sí, para recargar, jugar y mover capital', 'Para proteger mis ahorros de la inflación', 'Ocasionalmente para pagos internacionales', 'No suelo utilizar USDT'] },
          { p: '¿Qué red blockchain prefieres para transferir USDT?', ops: ['Red Tron (TRC-20) por comisiones bajas y rapidez', 'Red Binance Smart Chain (BEP-20)', 'Red Polygon o Arbitrum (Capa 2)', 'Red Ethereum (ERC-20)'] },
          { p: '¿Qué porcentaje de tus inversiones mantienes en stablecoins?', ops: ['Más del 50% para tener liquidez segura', 'Entre el 20% y el 50%', 'Menos del 20%, prefiero activos volátiles', 'No mantengo saldo en criptoactivos'] },
          { p: '¿Qué ventaja valoras más de las monedas estables?', ops: ['Paridad 1:1 con el dólar estadounidense', 'Disponibilidad inmediata 24/7 sin bancos', 'Transferencias internacionales en minutos', 'Privacidad y control sobre mis fondos'] },
          { p: '¿Has comprado bienes o servicios pagando con cripto?', ops: ['Sí, en plataformas de ocio y tiendas online', 'Solo entre amigos o conocidos', 'Aún no, pero me gustaría intentarlo', 'Prefiero usar tarjeta bancaria tradicional'] }
        ]
      },
      {
        title: 'Exchanges y Billeteras Cripto',
        desc: 'Plataformas de intercambio, Binance, Bybit y wallets de autocustodia.',
        questions: [
          { p: '¿Qué plataforma de intercambio (Exchange) usas más?', ops: ['Binance', 'Bybit / OKX', 'Coinbase / Kraken', 'KuCoin / Bitget u otros'] },
          { p: '¿Dónde almacenas tus criptomonedas de mayor valor?', ops: ['En la cuenta del exchange por comodidad', 'En monederos software móviles (Trust Wallet, Exodus)', 'En hardware wallet fría (Ledger, Trezor)', 'No tengo criptomonedas actualmente'] },
          { p: '¿Has utilizado el comercio P2P (Persona a Persona) para comprar saldo?', ops: ['Sí, es mi método favorito para comprar y vender', 'Ocasionalmente con usuarios verificados', 'Prefiero comprar directamente con tarjeta bancaria', 'Nunca he utilizado plataformas P2P'] },
          { p: '¿Cuánto tiempo tardas en verificar una transacción en la blockchain?', ops: ['Reviso el explorador (Tronscan / Etherscan) al instante', 'Espero la notificación de la app del exchange', 'Solo compruebo cuando tarda más de 5 minutos', 'No sé consultar exploradores de bloques'] },
          { p: '¿Qué comisión consideras aceptable para un retiro de USDT?', ops: ['Menos de 1 USDT (típico de TRC-20/BEP-20)', 'Hasta 2 o 3 USDT', 'Hasta 10 USDT en caso de red Ethereum', 'Exijo retiros con 0 comisión'] }
        ]
      },
      {
        title: 'Bitcoin y Criptomonedas Principales',
        desc: 'Perspectivas sobre BTC, Ethereum y el mercado cripto.',
        questions: [
          { p: '¿Cuál es tu criptomoneda de mayor confianza a largo plazo?', ops: ['Bitcoin (BTC) como oro digital', 'Ethereum (ETH) por su ecosistema de contratos', 'Solana (SOL) por su velocidad y bajo coste', 'Prefiero mantener stablecoins (USDT/USDC)'] },
          { p: '¿Cuál es tu estrategia habitual en el mercado cripto?', ops: ['HODL (comprar y guardar a largo plazo)', 'Trading a corto y medio plazo', 'Generar rendimiento en juegos y promociones', 'Solo entro al mercado en momentos de euforia'] },
          { p: '¿Cómo conociste el ecosistema de las criptomonedas?', ops: ['Por amigos o familiares que ya invertían', 'Por creadores de contenido en YouTube / TikTok', 'Por noticias en medios de comunicación', 'A través de juegos y plataformas de recompensas'] },
          { p: '¿Crees que Bitcoin alcanzará nuevos máximos históricos?', ops: ['Sí, con total certeza en los próximos años', 'Probablemente sí, con periodos de corrección', 'Creo que se mantendrá en un rango lateral', 'Tengo dudas sobre su crecimiento futuro'] },
          { p: '¿Qué aplicación utilizas para seguir los precios de cripto?', ops: ['CoinMarketCap', 'CoinGecko', 'TradingView con gráficos avanzados', 'Directamente desde mi aplicación de exchange'] }
        ]
      },
      {
        title: 'Tarjetas Cripto y Pagos en Comercios',
        desc: 'Tarjetas de débito Visa/Mastercard vinculadas a saldo cripto.',
        questions: [
          { p: '¿Tienes alguna tarjeta que gaste saldo de criptomonedas?', ops: ['Sí, tarjeta de Binance / Bybit', 'Sí, tarjeta de otro proveedor Fintech', 'He solicitado una pero aún no la tengo', 'No tengo tarjeta vinculada a cripto'] },
          { p: '¿Qué incentivo te atrae más de las tarjetas de débito cripto?', ops: ['Cashback directo en cada compra', 'Facilidad de gastar ganancias sin pasar por banco', 'Conversión automática de USDT a moneda local', 'Sin comisiones por compras internacionales'] },
          { p: '¿Prefieres pagar con tarjeta física o añadirla a Apple/Google Pay?', ops: ['Siempre con el móvil (Apple Pay / Google Wallet)', 'Prefiero llevar la tarjeta física en la cartera', 'Uso tarjeta virtual exclusivamente online', 'Indiferente según la situación'] },
          { p: '¿En qué tipo de comercios gastarías más con tarjeta cripto?', ops: ['Supermercados y compras cotidianas', 'Viajes, vuelos y reservas de hotel', 'Electrónica y compras por Internet', 'Salidas a restaurantes y ocio nocturno'] },
          { p: '¿Te preocupa la fiscalidad al convertir criptomonedas a moneda fiat?', ops: ['Sí, llevo control estricto de todas las operaciones', 'Tengo nociones básicas pero busco asesoría', 'Me gustaría que fuera más sencillo y transparente', 'No opero con volúmenes que requieran declaración'] }
        ]
      },
      {
        title: 'Bancos Digitales (Neobancos) vs Banca Tradicional',
        desc: 'Revolut, N26, Wise y la transformación bancaria móvil.',
        questions: [
          { p: '¿Tienes cuenta en algún banco 100% digital (neobanco)?', ops: ['Sí, Revolut / Wise / N26', 'Sí, fintech local de mi país (Mercado Pago, Nubank, etc.)', 'Tengo cuenta en más de dos neobancos', 'Solo utilizo bancos tradicionales con sucursales'] },
          { p: '¿Qué ventaja aprecias más de los bancos exclusivamente digitales?', ops: ['Apertura de cuenta en 3 minutos sin papeles', 'Notificaciones al milisegundo de cada gasto', 'Cambio de divisas con bajas comisiones', 'Herramientas de ahorro en huchas automáticas'] },
          { p: '¿Pisarías una sucursal bancaria física hoy en día?', ops: ['Evito las sucursales a toda costa, todo por app', 'Solo si no queda más remedio para un trámite mayor', 'No me molesta ir si la atención es buena', 'Prefiero el trato personal en ventanilla'] },
          { p: '¿Confías en tener tus ahorros principales en un neobanco?', ops: ['Totalmente, cuentan con licencia bancaria oficial', 'Solo mantengo saldo para gastos del mes', 'Prefiero tener la mayor parte en banco tradicional', 'Divido mis fondos en 3 entidades distintas'] },
          { p: '¿Utilizas transferencias inmediatas (Bizum, Pix, transferencias SEPA instant)?', ops: ['A diario para compartir gastos con amigos', 'Varias veces por semana', 'Solo para pagos puntuales', 'Casi nunca utilizo pagos instantáneos'] }
        ]
      },
      {
        title: 'Finanzas Personales y Hábitos de Ahorro',
        desc: 'Presupuestos mensuales, control de gastos e inversión.',
        questions: [
          { p: '¿Llevas un registro de tus ingresos y gastos mensuales?', ops: ['Sí, en app especializada o plantilla de Excel', 'Llevo un cálculo mental aproximado', 'Solo reviso el extracto a fin de mes', 'No llevo control de mis gastos'] },
          { p: '¿Qué porcentaje de tus ingresos consigues ahorrar al mes?', ops: ['Más del 30% de mis ingresos', 'Entre el 10% y el 25%', 'Menos del 10%', 'Llego justo a fin de mes sin poder ahorrar'] },
          { p: '¿Dispones de un fondo de emergencia para imprevistos?', ops: ['Sí, equivalente a 3 a 6 meses de gastos', 'Tengo un pequeño fondo para urgencias', 'Estoy construyéndolo actualmente', 'No dispongo de fondo de emergencia'] },
          { p: '¿En qué instrumentos inviertes tus ahorros además de cripto?', ops: ['Fondos indexados / ETFs (S&P 500, MSCI)', 'Acciones individuales de empresas', 'Cuentas remuneradas o depósitos a plazo fijo', 'No tengo inversiones fuera del efectivo'] },
          { p: '¿A qué edad comenzaste a interesarte por la educación financiera?', ops: ['Antes de los 20 años', 'Entre los 20 y los 25 años', 'Después de los 25 años', 'Apenas estoy empezando a interesarme'] }
        ]
      },
      {
        title: 'Juegos de Casino Online y Gestión de Banca (Bankroll)',
        desc: 'Límites de juego responsable, presupuestos y control emocional.',
        questions: [
          { p: '¿Fijas un presupuesto máximo antes de comenzar a jugar?', ops: ['Siempre, y lo respeto estrictamente', 'Generalmente sí, con pequeñas excepciones', 'Juego según las ganancias que vaya obteniendo', 'No suelo fijar un límite cerrado'] },
          { p: '¿Qué porcentaje de tu saldo arriesgas en una sola jugada?', ops: ['Entre el 1% y el 3% (gestión muy conservadora)', 'Entre el 5% y el 10% de mi saldo', 'Más del 20% si me siento con suerte', 'Varío según la racha de partidas'] },
          { p: '¿Qué haces cuando alcanzas una ganancia importante?', ops: ['Retiro una buena parte y juego solo con el resto', 'Retiro la totalidad de mis ganancias de inmediato', 'Sigo jugando para intentar aumentarla más', 'Aumento el valor de mis apuestas'] },
          { p: '¿Qué herramientas de juego responsable consideras más útiles?', ops: ['Límites diarios de recarga configurables', 'Historial detallado de apuestas y balance', 'Alertas de tiempo de sesión en pantalla', 'Autoexclusión temporal voluntaria'] },
          { p: '¿Juegas para divertirte o como método de generar ingresos?', ops: ['Puramente por diversión y entretenimiento', 'Por diversión, pero con el objetivo de ganar premios', 'Como un pasatiempo emocionante en ratos libres', 'Para aprovechar bonos y promociones semanales'] }
        ]
      },
      {
        title: 'Microinversiones y Recompensas Digitales',
        desc: 'Cashback, programas de lealtad y puntos canjeables.',
        questions: [
          { p: '¿Participas en programas de recompensas o cashback semanal?', ops: ['Sí, busco siempre plataformas con buen retorno', 'Aprovecho los programas que ya vienen incluidos', 'Solo si no requieren pasos complicados', 'No le presto atención al cashback'] },
          { p: '¿Qué tipo de premio prefieres recibir en promociones?', ops: ['Diamantes o saldo real retirable', 'Giros gratis en slots de alta volatilidad', 'Puntos de experiencia para subir rango VIP', 'Cofres sorpresa con premios aleatorios'] },
          { p: '¿Completas encuestas o tareas remuneradas con frecuencia?', ops: ['Sí, me parece una excelente forma de sumar saldo', 'Solo cuando las encuestas son cortas y bien pagadas', 'Ocasionalmente si tengo tiempo libre', 'Esta es una de mis primeras veces'] },
          { p: '¿Qué opinas de recibir recompensas en Diamantes canjeables por USDT?', ops: ['Excelente, da flexibilidad de jugar o retirar', 'Muy bueno, la tasa 1:10 es fácil de calcular', 'Prefiero saldo directo en USDT en mi billetera', 'Me resulta indiferente el formato'] },
          { p: '¿Recomendarías una plataforma a tus amigos por un bono de referido?', ops: ['Sí, si el servicio es de calidad y ambos ganamos', 'Solo a amigos muy cercanos que ya juegan', 'Prefiero no compartir enlaces de referido', 'Depende del monto del bono de recompensa'] }
        ]
      },
      {
        title: 'Comercio Electrónico y Métodos de Pago Digital',
        desc: 'Pasarelas de pago, compras en línea y confianza.',
        questions: [
          { p: '¿Con qué frecuencia compras productos por Internet?', ops: ['Varias veces por semana (Amazon, AliExpress, etc.)', 'Una o dos veces al mes', 'Solo en fechas especiales (Black Friday, rebajas)', 'Casi nunca compro productos en línea'] },
          { p: '¿Qué método de pago te genera mayor tranquilidad online?', ops: ['PayPal con protección al comprador', 'Tarjeta virtual desechable de un solo uso', 'Billetera digital (Apple Pay / Google Pay)', 'Transferencia bancaria directa'] },
          { p: '¿Has abandonado un carrito de compras por falta de métodos de pago?', ops: ['Sí, si no veo mi método preferido me voy', 'Solo si la web me pide datos sospechosos', 'Intento adaptarme a los métodos disponibles', 'Casi nunca abandono por esa razón'] },
          { p: '¿Compras más desde el teléfono móvil o desde el ordenador?', ops: ['Más del 80% desde la app móvil', 'Desde el ordenador para comparar mejor', 'Miro en el móvil y compro desde el PC', 'Uso ambos de forma indistinta'] },
          { p: '¿Qué factor te convence más para comprar en una tienda online nueva?', ops: ['Opiniones y reseñas positivas de otros usuarios', 'Diseño profesional y pasarela de pago segura', 'Sellos de garantía y política de devoluciones claras', 'Precios considerablemente más bajos que la competencia'] }
        ]
      },
      {
        title: 'Préstamos, Crédito y Servicios Buy Now Pay Later (BNPL)',
        desc: 'Klarna, tarjetas de crédito y aplazamiento de pagos.',
        questions: [
          { p: '¿Has utilizado servicios de pago a plazos sin intereses (BNPL)?', ops: ['Sí, uso Klarna / Afterpay con frecuencia', 'Solo para compras grandes puntuales', 'Lo conozco pero prefiero pagar de una vez', 'Nunca he utilizado servicios de pago aplazado'] },
          { p: '¿Utilizas tarjeta de crédito o prefieres siempre tarjeta de débito?', ops: ['Siempre tarjeta de débito con dinero propio', 'Tarjeta de crédito pagando a fin de mes (sin intereses)', 'Tarjeta de crédito a plazos financiados', 'Solo uso efectivo o monederos digitales'] },
          { p: '¿Cuál es tu política frente a las deudas de consumo?', ops: ['Cero deudas, no compro nada que no pueda pagar ya', 'Deuda razonable solo para bienes duraderos', 'Uso crédito para aprovechar promociones y liquidez', 'He tenido que financiar compras imprevistas'] },
          { p: '¿Revisas tu historial crediticio con regularidad?', ops: ['Sí, consulto mi reporte de crédito al menos una vez al año', 'Solo cuando voy a solicitar un préstamo o hipoteca', 'Sé que existe pero nunca lo he solicitado', 'En mi país no es habitual revisarlo personalmente'] },
          { p: '¿Qué opinas de las comisiones por descubierto o mora bancaria?', ops: ['Abusivas, cambio de banco si me cobran una', 'Entiendo que cobren pero los montos son excesivos', 'Tengo alertas activadas para evitar caer en descubiertos', 'Nunca me han cobrado comisiones de ese tipo'] }
        ]
      }
    ]
  },
  {
    category: 'Streaming, Cine & Música',
    icon: '🎬',
    topics: [
      {
        title: 'Plataformas de Películas y Series en Streaming',
        desc: 'Netflix, Prime Video, HBO Max, Disney+ y catálogos.',
        questions: [
          { p: '¿A cuántas plataformas de vídeo estás suscrito actualmente?', ops: ['A 1 sola plataforma principal', 'A 2 o 3 plataformas combinadas', 'A más de 3 plataformas (o cuentas familiares)', 'No pago ninguna, uso cuentas compartidas o gratuitas'] },
          { p: '¿Cuál es tu plataforma de series favorita?', ops: ['Netflix por variedad de catálogo y novedades', 'Max (HBO) por calidad de producciones', 'Prime Video por precio y envíos incluidos', 'Disney+ por franquicias (Marvel, Star Wars)'] },
          { p: '¿Qué opinas de los planes con anuncios publicitarios?', ops: ['No los tolero, pago extra para no ver anuncios', 'Me parece bien si la suscripción es más económica', 'Tolerables si son anuncios muy cortos', 'Prefiero plataformas 100% gratuitas con anuncios'] },
          { p: '¿Con qué frecuencia ves películas o series?', ops: ['Todos los días por la noche', 'Los fines de semana principalmente', 'Un par de veces por semana', 'Casi nunca tengo tiempo para ver series'] },
          { p: '¿Sueles ver temporadas completas en maratón (binge-watching)?', ops: ['Sí, me termino una temporada en un fin de semana', 'Prefiero ver 1 o 2 capítulos al día con calma', 'Prefiero cuando estrenan un capítulo por semana', 'Casi nunca termino series largas'] }
        ]
      },
      {
        title: 'Música en Streaming y Podcasts',
        desc: 'Spotify, Apple Music, YouTube Music y programas de audio.',
        questions: [
          { p: '¿Qué plataforma utilizas para escuchar música habitualmente?', ops: ['Spotify', 'YouTube Music', 'Apple Music', 'Amazon Music u otra'] },
          { p: '¿Pagas suscripción Premium o usas la versión gratuita con anuncios?', ops: ['Suscripción individual Premium', 'Plan familiar compartido con amigos o familia', 'Plan de estudiante bonificado', 'Versión gratuita con anuncios'] },
          { p: '¿Escuchas podcasts o programas de radio digital?', ops: ['Sí, a diario mientras viajo o hago tareas', 'Varias veces por semana mis 2 o 3 favoritos', 'Solo entrevistas o episodios puntuales', 'No suelo escuchar podcasts'] },
          { p: '¿Qué género musical escuchas con mayor frecuencia?', ops: ['Música Urbana / Reggaetón / Trap', 'Pop / Pop Electrónico internacional', 'Rock / Indie / Metal', 'Electrónica / Techno / House'] },
          { p: '¿Esperas con emoción el resumen anual (Spotify Wrapped)?', ops: ['Sí, me encanta compartirlo en mis redes', 'Me gusta verlo por curiosidad personal', 'Lo miro pero no suelo publicarlo', 'Me da completamente igual'] }
        ]
      },
      {
        title: 'Experiencia en Cines vs Cine en Casa',
        desc: 'Salas IMAX, palomitas, estrenos y proyectores caseros.',
        questions: [
          { p: '¿Con qué frecuencia asistes a salas de cine comerciales?', ops: ['Al menos una vez al mes para grandes estrenos', 'Cada 2 o 3 meses solo para películas esperadas', 'Una o dos veces al año', 'Casi nunca voy al cine, espero al streaming'] },
          { p: '¿Qué formato de sala prefieres si está disponible?', ops: ['IMAX o pantalla gigante con sonido envolvente', 'Salas VIP con butacas reclinables y servicio', 'Sala tradicional 2D estándar', 'Salas con efectos 4DX de movimiento y aire'] },
          { p: '¿Compras palomitas y refrescos en el cine?', ops: ['Siempre, palomitas grandes y refresco son sagrados', 'Solo palomitas si voy acompañado', 'A veces llevo mis propios snacks discretamente', 'Casi nunca consumo comida durante la película'] },
          { p: '¿Prefieres ver películas en versión original subtitulada o doblada?', ops: ['Doblada a mi idioma materno', 'Versión original en inglés con subtítulos', 'Depende del género y los actores', 'Versión original sin subtítulos'] },
          { p: '¿Qué género cinematográfico disfrutas más en pantalla grande?', ops: ['Ciencia ficción y efectos especiales espectaculares', 'Acción y superhéroes', 'Terror y suspenso con audio inmersivo', 'Comedias y animación familiar'] }
        ]
      },
      {
        title: 'Vídeo en Formato Corto: TikTok, Reels y Shorts',
        desc: 'Consumo rápido de entretenimiento en vídeo vertical.',
        questions: [
          { p: '¿Qué plataforma de vídeo corto utilizas con más frecuencia?', ops: ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'No consumo vídeos en formato vertical'] },
          { p: '¿Cuánto tiempo al día estimas que pasas viendo vídeos cortos?', ops: ['Más de 2 horas al día', 'Entre 1 y 2 horas al día', 'Entre 20 y 45 minutos al día', 'Menos de 15 minutos de forma muy esporádica'] },
          { p: '¿Qué temática de vídeos cortos te aparece más en el feed?', ops: ['Humor, memes y situaciones cómicas', 'Videojuegos, jugadas épicas y trucos', 'Cocina, recetas fáciles y restaurantes', 'Tecnología, noticias y divulgación'] },
          { p: '¿Creas y publicas tus propios vídeos o solo eres espectador?', ops: ['Solo consumo contenido como espectador pasivo', 'He subido algún vídeo muy puntual para amigos', 'Publico con regularidad contenido propio', 'Tengo una cuenta con seguidores activa'] },
          { p: '¿Sientes que el formato corto afecta tu capacidad de concentración?', ops: ['Sí, a veces me cuesta ver películas largas sin mirar el móvil', 'Un poco, pero intento limitar el tiempo de uso', 'No he notado cambios en mi atención', 'No consumo suficiente para que me afecte'] }
        ]
      },
      {
        title: 'Transmisiones en Vivo y Creadores de Contenido',
        desc: 'Ibai, Auron, Speed, eventos como La Velada del Año.',
        questions: [
          { p: '¿Sigues transmisiones en vivo de creadores de contenido?', ops: ['Sí, sigo streamers a diario mientras ceno o trabajo', 'Solo eventos multitudinarios especiales (La Velada, etc.)', 'Miro clips destacados en redes en vez de directos', 'No sigo a ningún streamer ni canal en vivo'] },
          { p: '¿Qué tipo de transmisiones disfrutas más?', ops: ['Just Chatting, charlas y reacciones a temas', 'Gameplays de títulos competitivos o novedades', 'Eventos especiales y programas producidos', 'Retos en la calle y transmisiones IRL'] },
          { p: '¿Alguna vez te has suscrito de pago o donado a un streamer?', ops: ['Sí, uso mi suscripción gratuita de Amazon Prime', 'He pagado suscripciones con dinero real', 'He donado bits o propinas en directos', 'Nunca he pagado ni donado en transmisiones'] },
          { p: '¿Participas activamente en el chat durante los directos?', ops: ['Sí, comento y uso emoticonos con frecuencia', 'Solo en canales pequeños donde leen los mensajes', 'Tengo el chat oculto para ver la pantalla completa', 'Casi nunca escribo en los chats'] },
          { p: '¿Qué duración de directo consideras ideal?', ops: ['Directos de 2 a 3 horas muy dinámicos', 'Maratones de más de 5 horas de fondo', 'Prefiero resúmenes editados de 15 minutos en YouTube', 'Cualquier duración me sirve si el tema entretiene'] }
        ]
      },
      {
        title: 'Festivales de Música y Conciertos en Vivo',
        desc: 'Música en directo, festivales de verano y entradas.',
        questions: [
          { p: '¿Con qué frecuencia asistes a conciertos o festivales de música?', ops: ['A varios festivales cada año', 'Al menos a 1 o 2 conciertos importantes al año', 'Cada varios años para artistas muy especiales', 'Casi nunca voy a eventos musicales en vivo'] },
          { p: '¿Prefieres festivales multitudinarios o conciertos íntimos?', ops: ['Festivales con muchos escenarios y artistas variados', 'Conciertos individuales de mi artista favorito', 'Salas pequeñas con buena acústica y cercanía', 'Cualquiera mientras el ambiente sea divertido'] },
          { p: '¿Cuánto es lo máximo que has pagado por una entrada de concierto?', ops: ['Menos de $40 USD', 'Entre $40 y $100 USD', 'Entre $100 y $250 USD', 'Más de $250 USD para un tour histórico'] },
          { p: '¿Grabas con el teléfono durante el concierto o prefieres disfrutar?', ops: ['Grabo un par de canciones clave de recuerdo y guardo el móvil', 'Grabo bastante para compartirlo en Stories', 'Disfruto sin sacar el teléfono casi en todo el show', 'Me molesta la gente que graba con el brazo levantado'] },
          { p: '¿Qué género musical disfrutas más en directo?', ops: ['Música electrónica / DJ sets con visuales y luces', 'Rock / Indie con banda en vivo e instrumentos', 'Música urbana y trap con energía de masas', 'Pop comercial con gran coreografía y show'] }
        ]
      },
      {
        title: 'Coleccionismo Musical: Vinilos, CDs y Merchandising',
        desc: 'El renacer del vinilo físico y camisetas de bandas.',
        questions: [
          { p: '¿Tienes reproductor de vinilos (tocadiscos) en casa?', ops: ['Sí, colecciono vinilos y los escucho con frecuencia', 'Tengo tocadiscos pero más como objeto decorativo', 'No tengo pero me gustaría iniciar una colección', 'No tengo interés en formatos físicos analógicos'] },
          { p: '¿Comprarías el vinilo de un álbum que ya puedes escuchar gratis en Spotify?', ops: ['Sí, por el valor artístico de la portada y el objeto', 'Solo de mis 2 o 3 álbumes favoritos de la vida', 'Solo si es una edición especial limitada de coleccionista', 'No gastaría dinero en un formato que ya tengo en digital'] },
          { p: '¿Tienes camisetas o merchandising de artistas o grupos musicales?', ops: ['Sí, varias camisetas compradas en conciertos oficiales', 'Tengo alguna prenda casual', 'Tengo posters, tazas u otros accesorios', 'No tengo merchandising musical'] },
          { p: '¿Crees que el formato vinilo suena mejor que el audio digital en alta resolución?', ops: ['Tiene una calidez analógica inigualable', 'Suena diferente, pero el digital es más limpio y nítido', 'Es más un ritual nostálgico que una ventaja sonora real', 'No noto la diferencia acústica'] },
          { p: '¿Qué formato físico guardas con más nostalgia de tu infancia?', ops: ['Casetes de cinta magnética', 'Discos compactos (CDs) con sus libretos', 'Vinilos familiares antiguos', 'Crecí directamente en la era del MP3 y descargas'] }
        ]
      },
      {
        title: 'Anime y Animación Japonesa',
        desc: 'Shonen, Crunchyroll, manga y películas de anime.',
        questions: [
          { p: '¿Con qué frecuencia ves series o películas de anime?', ops: ['Sigo temporadas activas cada semana a ritmo japonés', 'Veo series populares completas de vez en cuando', 'Solo he visto clásicos históricos (Dragon Ball, Naruto, etc.)', 'No suelo ver animación japonesa'] },
          { p: '¿Qué plataforma utilizas para ver anime?', ops: ['Crunchyroll', 'Netflix / Prime Video con catálogo de anime', 'Sitios especializados en internet', 'No consumo anime'] },
          { p: '¿Prefieres el audio original en japonés con subtítulos o doblado?', ops: ['Original en japonés con subtítulos en español (Vostfr)', 'Doblado al español latino o castellano', 'Me da igual mientras la actuación de voz sea buena', 'No veo anime'] },
          { p: '¿Lees manga japonés o cómics además de ver anime?', ops: ['Sí, leo capítulos semanales de manga / manhwa', 'Ocasionalmente si la serie me deja intrigado', 'Solo he comprado tomos físicos coleccionables', 'No leo manga'] },
          { p: '¿Cuál es tu género de anime favorito?', ops: ['Shonen de acción y peleas (Jujutsu Kaisen, One Piece)', 'Seinen / Thriller psicológico (Death Note, Attack on Titan)', 'Isekai y fantasía de mundos paralelos', 'Slice of Life, comedia y romance escolar'] }
        ]
      },
      {
        title: 'Teatro, Musicales y Espectáculos en Vivo',
        desc: 'Comedias, musicales de Broadway y monólogos de humor.',
        questions: [
          { p: '¿Has asistido a obras de teatro o musicales en los últimos dos años?', ops: ['Sí, voy varias veces al año al teatro', 'He ido a 1 o 2 espectáculos importantes', 'Solo a monólogos de humoristas (Stand-up)', 'No suelo ir a funciones de teatro'] },
          { p: '¿Qué formato de espectáculo escénico prefieres?', ops: ['Musicales de gran producción (El Rey León, etc.)', 'Monólogos de comedia y stand-up para reír', 'Obras dramáticas o comedias teatrales de texto', 'Espectáculos de magia, circo o acrobacias'] },
          { p: '¿Qué valoras más en una función en vivo?', ops: ['El talento vocal y las actuaciones en directo', 'La escenografía, vestuario e iluminación', 'Un guion divertido y con ritmo', 'La conexión y cercanía con el público'] },
          { p: '¿Comprarías entradas con meses de anticipación para un gran musical?', ops: ['Sí, para asegurar los mejores asientos centrales', 'Solo con un par de semanas de margen', 'Prefiero decidir a última hora según planes', 'Solo si encuentro ofertas o descuentos'] },
          { p: '¿Te gustan las salas históricas y teatros clásicos?', ops: ['Me fascinan por su arquitectura y ambiente', 'Prefiero recintos modernos con butacas amplias', 'Me da igual el recinto mientras se vea bien', 'No le presto atención a la arquitectura de la sala'] }
        ]
      },
      {
        title: 'Cultura de Memes e Internet',
        desc: 'Humor digital, viralidad y tendencias en redes.',
        questions: [
          { p: '¿Compartes memes con amigos o familiares en tu día a día?', ops: ['Sí, envío memes a diario por WhatsApp o Instagram', 'Varias veces por semana en grupos de amigos', 'Solo cuando veo algo realmente gracioso', 'Casi nunca comparto contenido de humor'] },
          { p: '¿Cuál es tu formato de meme favorito?', ops: ['Imágenes estáticas con texto ingenioso', 'Vídeos cortos con audios virales o remezclados', 'Stickers personalizados en chats de mensajería', 'GIFs animados de reacciones'] },
          { p: '¿Cuánto tiempo crees que dura una tendencia o meme hoy en día?', ops: ['Apenas 1 o 2 semanas antes de cansar', 'Unos pocos días debido a la velocidad de TikTok', 'Algunos memes se convierten en clásicos duraderos', 'No me fijo en la vigencia de los memes'] },
          { p: '¿Utilizas stickers personalizados con tus propias fotos o las de amigos?', ops: ['Sí, tenemos packs de stickers internos en nuestro grupo', 'Uso stickers descargados de internet', 'Solo los emojis y reacciones estándar', 'No utilizo stickers en mis conversaciones'] },
          { p: '¿Entiendes el humor absurdo / gen-z de internet?', ops: ['Sí, me parece el humor más divertido actualmente', 'La mayoría de veces, aunque algunas cosas me desconciertan', 'Prefiero el humor tradicional con chistes estructurados', 'Casi nunca le encuentro sentido a los memes modernos'] }
        ]
      }
    ]
  },
  {
    category: 'Hábitos de Consumo & Compras',
    icon: '🛍️',
    topics: [
      {
        title: 'Marcas de Ropa y Moda Urbana',
        desc: 'Sneakers, streetwear, marcas deportivas y compras online.',
        questions: [
          { p: '¿Qué marca de zapatillas deportivas (sneakers) prefieres?', ops: ['Nike / Jordan', 'Adidas / Yeezy', 'New Balance / Asics', 'Puma / Vans / Converse'] },
          { p: '¿Con qué frecuencia compras prendas de vestir o calzado?', ops: ['Al menos una vez al mes', 'Cada temporada o cambio de estación', 'Solo cuando necesito reemplazar prendas viejas', 'En rebajas y periodos de descuentos'] },
          { p: '¿Compras ropa por internet o prefieres probarte en tienda física?', ops: ['Compro casi todo online por variedad y comodidad', 'Miro online pero me pruebo en tienda antes de comprar', 'Prefiero tiendas físicas para comprobar tallas y tela', 'Indiferente según la prenda'] },
          { p: '¿Te interesan las zapatillas de edición limitada o coleccionismo?', ops: ['Sí, participo en sorteos (SNKRS) y lanzamientos', 'Me gustan los modelos bonitos sin obsesión por reventa', 'Solo busco comodidad para el día a día', 'No entiendo el fenómeno del coleccionismo de zapatillas'] },
          { p: '¿Cuál es tu prioridad al elegir una prenda de ropa?', ops: ['Comodidad y tejido agradable', 'Estilo, diseño y que favorezca mi figura', 'Precio accesible y durabilidad', 'Reconocimiento de marca o tendencia actual'] }
        ]
      },
      {
        title: 'Supermercados y Alimentación Cotidiana',
        desc: 'Cestas de la compra, marcas blancas y productos frescos.',
        questions: [
          { p: '¿Sueles comprar productos de marca blanca (marca del distribuidor)?', ops: ['Casi siempre, tienen excelente calidad/precio', 'Para productos básicos sí, para marcas líderes en otros', 'Prefiero marcas tradicionales conocidas', 'No suelo fijarme en las marcas de supermercado'] },
          { p: '¿Haces la compra del supermercado en tienda física o por internet?', ops: ['Siempre en tienda física para elegir productos frescos', 'Pido online para entregas pesadas y frescos en tienda', 'Hago toda la compra mensual por app con entrega a domicilio', 'Compro día a día en tiendas de barrio'] },
          { p: '¿Llevas una lista cerrada de la compra antes de salir de casa?', ops: ['Sí, en el móvil o papel y la sigo rigurosamente', 'Llevo lista mental y suelo comprar algún capricho', 'No llevo lista, recorro los pasillos y decido', 'Solo compro lo que me falta en el momento'] },
          { p: '¿Aprovechas las tarjetas de fidelización de los supermercados?', ops: ['Sí, acumulo puntos, cupones y descuentos siempre', 'Solo la tarjeta del supermercado que más frecuento', 'Tengo tarjetas pero casi nunca uso los cupones', 'No me gusta dar mis datos en programas de puntos'] },
          { p: '¿Revisas la fecha de caducidad antes de meter el producto al carro?', ops: ['Siempre, buscando las fechas más lejanas posibles', 'Solo en lácteos, carnes y productos perecederos', 'Casi nunca la reviso en el supermercado', 'Solo cuando llego a casa antes de cocinar'] }
        ]
      },
      {
        title: 'Servicios de Entrega a Domicilio (Delivery)',
        desc: 'Uber Eats, Glovo, pedidos de comida y rapidez.',
        questions: [
          { p: '¿Con qué frecuencia pides comida a domicilio por apps?', ops: ['Varias veces por semana (2 o más)', 'Una vez por semana (típicamente fin de semana)', 'Una o dos veces al mes en ocasiones especiales', 'Casi nunca pido comida a domicilio'] },
          { p: '¿Qué tipo de comida pides más a domicilio?', ops: ['Hamburguesas gourmet y patatas fritas', 'Pizza artesanal o de cadena', 'Comida asiática (Sushi, Ramen, Wok)', 'Pollo frito o comida mexicana (Tacos, burritos)'] },
          { p: '¿Qué valoras más al pedir por una aplicación de delivery?', ops: ['Puntualidad y comida entregada caliente', 'Promociones 2x1 y gastos de envío gratis', 'Variedad de restaurantes locales en la zona', 'Seguimiento en tiempo real del repartidor en el mapa'] },
          { p: '¿Pagas alguna suscripción de envíos gratis (Glovo Prime, Uber One)?', ops: ['Sí, la amortizo con creces cada mes', 'La he probado en periodo gratuito', 'Prefiero no pagar cuotas mensuales fijas', 'No pido con suficiente frecuencia'] },
          { p: '¿Sueles dejar propina al repartidor a través de la aplicación?', ops: ['Sí, casi siempre dejo propina digital o en efectivo', 'Solo cuando el clima es malo (lluvia, frío) o son muy rápidos', 'Rara vez dejo propina', 'No acostumbro a dejar propina en delivery'] }
        ]
      },
      {
        title: 'Café y Hábitos de Consumo de Bebidas',
        desc: 'Cafeterías de especialidad, cápsulas Nespresso y café frío.',
        questions: [
          { p: '¿Tomas café habitualmente a lo largo del día?', ops: ['Sí, de 2 a 3 tazas al día indispensables', 'Una taza obligatoria por la mañana para despertar', 'Solo ocasionalmente en cafeterías con amigos', 'No tomo café, prefiero té u otras bebidas'] },
          { p: '¿Cómo preparas el café en tu hogar?', ops: ['Cafetera de cápsulas rápida (Nespresso, Dolce Gusto)', 'Cafetera italiana / moka clásica sobre fuego', 'Cafetera superautomática de grano recién molido', 'Café soluble instantáneo o prensa francesa'] },
          { p: '¿Te gusta el café de especialidad (Specialty Coffee)?', ops: ['Me encanta, aprecio los orígenes y notas de sabor', 'Lo he probado y me parece rico pero caro', 'Prefiero el café tradicional de cafetería de barrio', 'No noto la diferencia entre tipos de grano'] },
          { p: '¿Cómo tomas habitualmente el café?', ops: ['Solo / Espresso corto sin azúcar', 'Cortado o café con leche tradicional', 'Capuchino o café latte con espuma', 'Café helado (Iced Coffee) con jarabes o sabores'] },
          { p: '¿Cuánto consideras un precio justo por un buen café en cafetería?', ops: ['Entre $1.00 y $1.80 USD', 'Entre $2.00 y $3.50 USD', 'Hasta $5.00 USD si es un café de especialidad grande', 'Más de $2.50 USD me parece excesivo'] }
        ]
      },
      {
        title: 'Sostenibilidad y Hábitos Ecológicos',
        desc: 'Reciclaje, envases reutilizables y segunda mano.',
        questions: [
          { p: '¿Separas los residuos y basuras en casa para reciclar?', ops: ['Sí, rigurosamente plástico, papel, vidrio y orgánico', 'Separo papel y plástico principalmente', 'Solo cuando tengo contenedores cerca de casa', 'No suelo separar la basura en casa'] },
          { p: '¿Compras o vendes artículos de segunda mano (Vinted, Wallapop)?', ops: ['Sí, compro y vendo ropa o tecnología activamente', 'He vendido cosas que no uso para sacar dinero extra', 'Solo he comprado en alguna ocasión puntual', 'No suelo utilizar plataformas de segunda mano'] },
          { p: '¿Llevas tus propias bolsas reutilizables al supermercado?', ops: ['Siempre llevo bolsas de tela en el coche o mochila', 'Casi siempre, aunque a veces se me olvidan', 'Compro bolsas de plástico en la caja cuando voy', 'No suelo acordarme de llevarlas'] },
          { p: '¿Pagarías más por un producto si su envase es 100% biodegradable?', ops: ['Sí, apoyo a las marcas con compromiso ecológico real', 'Solo si la diferencia de precio es mínima', 'Prefiero el producto más económico independientemente del envase', 'Desconfío de las etiquetas ecológicas (greenwashing)'] },
          { p: '¿Utilizas botellas de agua o termos reutilizables de acero?', ops: ['Sí, llevo mi botella térmica a todas partes', 'Tengo una en casa o en el trabajo', 'Suelo comprar botellas de agua desechables', 'Uso vasos normales'] }
        ]
      },
      {
        title: 'Cuidado Personal, Perfumería y Belleza',
        desc: 'Rutinas faciales, perfumes de autor y aseo personal.',
        questions: [
          { p: '¿Tienes una rutina de cuidado facial (skincare) diaria?', ops: ['Sí, limpiador, sérum, hidratante y protector solar a diario', 'Solo crema hidratante y lavado básico', 'Solo me pongo protector solar en verano o playa', 'No sigo ninguna rutina de cuidado facial'] },
          { p: '¿Utilizas perfume o colonia con regularidad?', ops: ['Siempre antes de salir de casa, es mi seña de identidad', 'Solo para ocasiones especiales o citas', 'Uso desodorante corporal principalmente', 'Rara vez me aplico perfume'] },
          { p: '¿Dónde compras habitualmente tus productos de higiene y cosmética?', ops: ['Perfumerías especializadas (Sephora, Primor, etc.)', 'Directamente en el pasillo de cosmética del supermercado', 'Por internet en tiendas oficiales o farmacias online', 'En salones de peluquería o barberías'] },
          { p: '¿Cuántos frascos de perfume sueles tener abiertos a la vez?', ops: ['Tengo 1 solo perfume que es mi fragancia fija', 'Entre 2 y 4 para alternar según el clima o noche/día', 'Colecciono más de 5 fragancias distintas', 'No suelo comprar frascos de perfume'] },
          { p: '¿Con qué frecuencia vas a la peluquería o barbería?', ops: ['Cada 2 o 3 semanas para mantener el corte perfecto', 'Una vez al mes religiosamente', 'Cada 2 a 3 meses cuando el pelo ya está largo', 'Me corto el pelo yo mismo en casa'] }
        ]
      },
      {
        title: 'Mascotas y Cuidado Animal',
        desc: 'Perros, gatos, alimentación premium y accesorios.',
        questions: [
          { p: '¿Tienes alguna mascota en tu hogar actualmente?', ops: ['Sí, uno o más perros', 'Sí, uno o más gatos', 'Tengo tanto perros como gatos u otros animales', 'No tengo mascotas actualmente'] },
          { p: '¿Qué tipo de alimentación le das a tu mascota?', ops: ['Pienso / croquetas de gama premium veterinaria', 'Alimento seco estándar comercial', 'Comida húmeda combinada con pienso', 'Dieta natural (BARF) cocinada en casa'] },
          { p: '¿Cuánto gastas aproximadamente al mes en tu mascota?', ops: ['Menos de $30 USD', 'Entre $30 y $80 USD', 'Entre $80 y $150 USD incluyendo veterinario y juguetes', 'No tengo mascota'] },
          { p: '¿Le compras juguetes o accesorios con frecuencia?', ops: ['Sí, me encanta mimarle con juguetes y snacks nuevos', 'Solo cuando rompe los anteriores', 'Muy ocasionalmente en su cumpleaños o fechas clave', 'No compro accesorios con frecuencia'] },
          { p: '¿Llevarías a tu mascota contigo de vacaciones?', ops: ['Siempre que puedo busco hoteles y lugares pet-friendly', 'Prefiero dejarla con familiares de confianza', 'Uso residencias caninas / cuidadores profesionales', 'No tengo mascota'] }
        ]
      },
      {
        title: 'Hogar, Bricolaje y Decoración',
        desc: 'IKEA, muebles modulares, plantas y organización.',
        questions: [
          { p: '¿Compras muebles o artículos de decoración en IKEA?', ops: ['Sí, gran parte de mi hogar tiene muebles de IKEA', 'Solo accesorios, velas y artículos de organización', 'Prefiero tiendas de muebles clásicas o a medida', 'Casi nunca visito esas tiendas'] },
          { p: '¿Te consideras manitas para montar muebles y hacer arreglos?', ops: ['Me encanta montar muebles y hacer bricolaje en casa', 'Me defiendo bien siguiendo las instrucciones paso a paso', 'Lo intento pero suelo frustrarme con los tornillos', 'Prefiero pagar para que me monten e instalen todo'] },
          { p: '¿Tienes plantas vivas dentro de tu casa o terraza?', ops: ['Sí, tengo bastantes plantas y las cuido con mimo', 'Tengo 1 o 2 plantas fáciles que resisten bien', 'Prefiero plantas artificiales decorativas', 'Se me mueren todas las plantas vivas que intento tener'] },
          { p: '¿Qué estilo de decoración prefieres para tu vivienda?', ops: ['Estilo minimalista nórdico con tonos claros y madera', 'Estilo industrial con metal negro y ladrillo', 'Estilo moderno con iluminación LED indirecta', 'Estilo acogedor tradicional y rústico'] },
          { p: '¿Qué estancia de la casa consideras más importante que esté ordenada?', ops: ['El dormitorio para descansar con paz mental', 'El salón para recibir visitas y desconectar', 'La cocina y la zona de trabajo / escritorio', 'El baño'] }
        ]
      },
      {
        title: 'Libros, Lectura y Formatos Digitales',
        desc: 'Kindle, libros físicos en papel, audiolibros y novelas.',
        questions: [
          { p: '¿En qué formato prefieres leer habitualmente?', ops: ['Libro físico en papel por el tacto y olor', 'Lector electrónico de tinta electrónica (Kindle, Kobo)', 'En la pantalla del iPad, tablet o móvil', 'No suelo leer libros por falta de tiempo'] },
          { p: '¿Cuántos libros leíste aproximadamente en el último año?', ops: ['Más de 10 libros completos', 'Entre 4 y 10 libros', 'Entre 1 y 3 libros', 'No leí ningún libro completo'] },
          { p: '¿Has probado alguna vez los audiolibros (Audible, Storytel)?', ops: ['Sí, escucho audiolibros mientras conduzco o entreno', 'He probado alguno pero prefiero leer con mis ojos', 'Me gustaría probarlos pero aún no lo he hecho', 'No me llama la atención el formato de audio'] },
          { p: '¿Qué género literario te atrapa con mayor facilidad?', ops: ['Thriller, novela negra y misterio policíaco', 'Fantasía épica y ciencia ficción', 'Desarrollo personal, negocios y psicología', 'Novela histórica o biografías reales'] },
          { p: '¿Sueles comprar libros en librerías de barrio o por internet?', ops: ['Me encanta visitar librerías físicas y curiosear mesas', 'Compro por Amazon u otras tiendas online por rapidez', 'Consigo versiones digitales para mi lector', 'Suelo pedirlos prestados en bibliotecas o a amigos'] }
        ]
      },
      {
        title: 'Bebidas Energéticas y Refrescos',
        desc: 'Red Bull, Monster Energy, refrescos sin azúcar y té frío.',
        questions: [
          { p: '¿Consumes bebidas energéticas (Red Bull, Monster, etc.)?', ops: ['Sí, varias veces por semana para concentrarme o jugar', 'Ocasionalmente cuando tengo que estudiar o trabajar tarde', 'Solo los fines de semana o en fiestas', 'Casi nunca o nunca tomo bebidas energéticas'] },
          { p: '¿Qué marca de bebida energética prefieres?', ops: ['Monster Energy (especialmente las variedades Ultra sin azúcar)', 'Red Bull clásico o ediciones de sabores', 'Marcas para gamers (Ghost, G Fuel, Reign)', 'No suelo consumir estas marcas'] },
          { p: '¿Prefieres refrescos normales con azúcar o versiones Zero / Light?', ops: ['Siempre versiones Zero azúcar / Sin calorías', 'Versiones clásicas con azúcar de toda la vida', 'Prefiero agua con gas o tés fríos naturales', 'No consumo refrescos carbonatados'] },
          { p: '¿Cuál es tu refresco favorito de todos los tiempos?', ops: ['Coca-Cola (clásica o Zero)', 'Pepsi', 'Sprite / 7Up / Fanta de sabores frutales', 'Bebidas de té helado (Nestea, Lipton, Fuze)'] },
          { p: '¿Consideras que las bebidas energéticas cumplen lo que prometen?', ops: ['Sí, me dan un impulso de energía y concentración notable', 'Me despejan un rato pero luego siento bajón', 'Solo me gusta el sabor refrescante', 'No noto que me den energía'] }
        ]
      }
    ]
  },
  {
    category: 'Deportes & Vida Saludable',
    icon: '⚽',
    topics: [
      {
        title: 'Fútbol y Competiciones Internacionales',
        desc: 'Champions League, ligas locales, Mundiales y afición.',
        questions: [
          { p: '¿Con qué frecuencia ves partidos de fútbol en televisión o estadios?', ops: ['Todas las semanas veo los partidos de mi equipo favorito', 'Solo partidos grandes (Champions, clásicos, finales)', 'Solo durante el Mundial o torneos de selecciones', 'No suelo ver fútbol'] },
          { p: '¿Has acudido a un estadio de fútbol a ver un partido en vivo?', ops: ['Sí, voy al estadio varias veces por temporada', 'He ido en algunas ocasiones especiales', 'Solo a estadios pequeños de categorías locales', 'Nunca he estado en un estadio de fútbol'] },
          { p: '¿Qué competición consideras la más emocionante del mundo?', ops: ['La UEFA Champions League', 'La Copa Mundial de la FIFA de selecciones', 'Las ligas locales (LaLiga, Premier League, etc.)', 'La Copa Libertadores'] },
          { p: '¿Juegas al fútbol con amigos o en ligas aficionadas?', ops: ['Sí, juego fútbol 7 o fútbol sala cada semana', 'Solo partidillos ocasionales en verano o fiestas', 'Antes jugaba mucho pero ya no', 'No practico fútbol'] },
          { p: '¿Compras camisetas oficiales de tu equipo de fútbol?', ops: ['Sí, tengo varias de distintas temporadas', 'Solo cuando mi equipo gana un título histórico', 'Prefiero camisetas de entrenamiento o réplicas', 'No compro camisetas deportivas'] }
        ]
      },
      {
        title: 'Gimnasio y Entrenamiento de Fuerza',
        desc: 'Pesas, hipertrofia, mancuernas y rutinas de fitness.',
        questions: [
          { p: '¿Vas al gimnasio a entrenar con regularidad?', ops: ['Sí, entre 4 y 6 días por semana rigurosamente', 'Entre 2 y 3 días por semana', 'Estoy inscrito pero voy de forma intermitente', 'No voy al gimnasio, entreno en casa o no hago pesas'] },
          { p: '¿Cuál es tu objetivo principal en el entrenamiento físico?', ops: ['Ganar masa muscular e hipertrofia', 'Perder grasa corporal y tonificar', 'Mejorar fuerza, salud cardiovascular y energía', 'Despejar la mente y reducir el estrés diario'] },
          { p: '¿Tomas suplementos deportivos (proteína en polvo, creatina)?', ops: ['Sí, proteína de suero y creatina monohidrato a diario', 'Solo batidos de proteína después de entrenar', 'He tomado en el pasado pero ahora solo como comida real', 'No tomo ningún tipo de suplemento deportivo'] },
          { p: '¿Prefieres entrenar solo o con un compañero de entrenamiento?', ops: ['Solo con auriculares para concentrarme al 100%', 'Con un compañero para motivarnos y ayudarnos en series', 'En clases grupales dirigidas', 'Me da igual con tal de entrenar bien'] },
          { p: '¿Cuánto dura habitualmente tu sesión de gimnasio?', ops: ['Menos de 45 minutos (entrenamiento ágil e intenso)', 'Entre 60 y 75 minutos', 'Entre 90 y 120 minutos incluyendo cardio y estiramientos', 'No voy al gimnasio'] }
        ]
      },
      {
        title: 'Running y Carreras Populares',
        desc: 'Correr al aire libre, maratones, 10K y zapatillas de running.',
        questions: [
          { p: '¿Sueles salir a correr (running) de forma habitual?', ops: ['Sí, varios días por semana llueva o haga sol', 'Salgo a correr 1 o 2 veces por semana', 'Prefiero caminar a buen paso en vez de correr', 'No practico running'] },
          { p: '¿En qué superficie prefieres salir a correr?', ops: ['En parques o senderos de tierra al aire libre', 'Por el asfalto y aceras de la ciudad', 'En la cinta de correr del gimnasio', 'En pistas de atletismo de tartán'] },
          { p: '¿Has participado alguna vez en una carrera popular (5K, 10K, etc.)?', ops: ['Sí, he corrido medias maratones o maratones', 'He participado en carreras de 5K o 10K con amigos', 'Me gustaría apuntarme a una próximamente', 'No me interesa competir en carreras'] },
          { p: '¿Qué aplicación o reloj utilizas para registrar tus carreras?', ops: ['Strava para compartir con la comunidad', 'Garmin Connect / Apple Fitness', 'Nike Run Club u otra app en el móvil', 'No registro mis tiempos ni distancias'] },
          { p: '¿Qué es lo más difícil al iniciarse en el running?', ops: ['La constancia y crear el hábito las primeras semanas', 'El cansancio respiratorio y controlar las pulsaciones', 'El dolor en articulaciones o sobrecarga muscular', 'Salir en días de frío o mal tiempo'] }
        ]
      },
      {
        title: 'Pádel y Deportes de Raqueta',
        desc: 'El boom del pádel, palas, partidos con amigos y torneos.',
        questions: [
          { p: '¿Juegas al pádel con amigos o compañeros de trabajo?', ops: ['Sí, al menos una o dos partidas cada semana', 'Juego un par de veces al mes de forma casual', 'He jugado alguna vez pero no con frecuencia', 'Nunca he jugado al pádel'] },
          { p: '¿Tienes tu propia pala de pádel o la alquilas en la pista?', ops: ['Tengo mi propia pala de gama media o alta', 'Tengo una pala básica para jugar de vez en cuando', 'La alquilo en el club cada vez que voy a jugar', 'No juego al pádel'] },
          { p: '¿Prefieres jugar en el lado del revés o de la derecha?', ops: ['Juego en el revés para definir puntos y rematar', 'Juego en la derecha para defender y armar juego', 'Me adapto al lado que deje libre mi compañero', 'No conozco la diferencia técnica de posiciones'] },
          { p: '¿Qué tipo de pista de pádel prefieres?', ops: ['Pista techada o indoor sin viento ni sol molesto', 'Pista al aire libre con cristal panorámico', 'Pistas con césped rizado de última generación', 'Me resulta indiferente mientras esté bien cuidada'] },
          { p: '¿Qué te parece el auge y la popularidad actual del pádel?', ops: ['Un deporte divertidísimo y muy social para todas las edades', 'Muy entretenido aunque a veces cuesta encontrar pistas libres', 'Prefiero deportes individuales o el tenis tradicional', 'Me parece una moda pasajera'] }
        ]
      },
      {
        title: 'Nutrición, Dietas y Hábitos Alimenticios',
        desc: 'Comida sana, ayuno intermitente, macro y micro nutrientes.',
        questions: [
          { p: '¿Cuidas conscientemente la cantidad de proteína y calorías que comes?', ops: ['Sí, peso mi comida o calculo macros con una app (MyFitnessPal)', 'Tengo una idea aproximada de comer sano sin obsesión', 'Solo intento comer menos ultraprocesados y más verduras', 'No me fijo en calorías ni nutrientes'] },
          { p: '¿Has probado alguna vez el ayuno intermitente (16/8)?', ops: ['Sí, es mi estilo de vida habitual y me sienta genial', 'Lo he probado durante algunas semanas o meses', 'Lo conozco pero me cuesta saltarme el desayuno', 'Nunca he probado el ayuno voluntario'] },
          { p: '¿Cuántos litros de agua bebes aproximadamente al día?', ops: ['Más de 2.5 litros de agua al día', 'Entre 1.5 y 2 litros al día', 'Menos de 1 litro al día', 'Solo bebo agua cuando tengo mucha sed'] },
          { p: '¿Con qué frecuencia consumes comida rápida o ultraprocesados?', ops: ['Rara vez, menos de 1 vez cada 15 días', 'Una o dos veces por semana (comida trampa / cheat meal)', 'Casi a diario por comodidad o falta de tiempo', 'Solo en reuniones sociales con amigos'] },
          { p: '¿Tomas suplementos vitamínicos (vitamina D, omega 3, magnesio)?', ops: ['Sí, tomo suplementos diarios pautados', 'Solo en épocas de invierno o cansancio', 'Prefiero obtener todos los nutrientes de la comida', 'No tomo vitaminas ni suplementos'] }
        ]
      },
      {
        title: 'Baloncesto, NBA y Deporte de Canasta',
        desc: 'Partidos de la NBA, mates, triples y liga ACB/Euroliga.',
        questions: [
          { p: '¿Sigues la NBA o partidos de baloncesto profesional?', ops: ['Sí, trasnocho para ver partidos de la NBA en vivo', 'Veo los resúmenes de jugadas destacadas por la mañana', 'Solo veo los Playoffs y las Finales de la NBA', 'No suelo seguir el baloncesto'] },
          { p: '¿Quién consideras el mejor jugador de la historia del baloncesto?', ops: ['Michael Jordan', 'LeBron James', 'Kobe Bryant', 'Stephen Curry'] },
          { p: '¿Juegas al baloncesto en canchas urbanas o ligas locales?', ops: ['Sí, juego pick-up games en canchas de calle habitualmente', 'Juego de forma casual con amigos de vez en cuando', 'Jugaba en el colegio o instituto pero ya no', 'No practico baloncesto'] },
          { p: '¿Te gustan las zapatillas retro de baloncesto para vestir a diario?', ops: ['Sí, tengo modelos clásicos (Jordan 1, Dunk, Air Force 1)', 'Me gustan para ocasiones informales', 'Prefiero zapatillas más ligeras de running', 'No me gustan las zapatillas voluminosas de basket'] },
          { p: '¿Qué jugada te parece más espectacular en un partido?', ops: ['Un mate potente posterizando a un defensor', 'Un triple decisivo sobre la bocina para ganar (Buzzer Beater)', 'Un pase milimétrico sin mirar entre varios rivales', 'Un tapón salvaje en el tablero'] }
        ]
      },
      {
        title: 'Ciclismo, Bicicleta de Carretera y Montaña',
        desc: 'Rutas en bici, gravel, Tour de Francia y salidas en grupo.',
        questions: [
          { p: '¿Montas en bicicleta habitualmente los fines de semana?', ops: ['Sí, salgo en rutas largas de carretera o montaña (MTB)', 'Uso la bicicleta como medio de transporte urbano', 'Solo en paseos suaves y relajados de vez en cuando', 'No tengo bicicleta ni suelo montar'] },
          { p: '¿Qué modalidad de ciclismo te gusta más?', ops: ['Ciclismo de carretera con bicicleta ligera', 'Bicicleta de montaña (MTB) por caminos y trialeras', 'Gravel por pistas de tierra y caminos mixtos', 'Bicicleta urbana de paseo'] },
          { p: '¿Utilizas ropa técnica ciclista (maillot y culotte con badana)?', ops: ['Sí, vestimenta completa para evitar rozaduras en rutas largas', 'Solo culotte con badana para mayor comodidad en el sillín', 'Uso ropa deportiva normal sin prendas técnicas', 'No practico ciclismo'] },
          { p: '¿Has seguido grandes vueltas ciclistas por televisión (Tour, Vuelta)?', ops: ['Sí, sigo etapas completas de montaña con pasión', 'Pongo las etapas de fondo para las siestas de verano', 'Solo miro los últimos kilómetros al sprint', 'No veo ciclismo por televisión'] },
          { p: '¿Llevas casco obligatoriamente cada vez que subes a una bicicleta?', ops: ['Siempre, la seguridad en la cabeza no es negociable', 'Solo en carretera o cuando salgo a velocidades altas', 'En ciudad a veces no me lo pongo en trayectos cortos', 'No suelo montar en bicicleta'] }
        ]
      },
      {
        title: 'Deportes de Combate y Artes Marciales',
        desc: 'UFC, boxeo profesional, jiu-jitsu y veladas de contacto.',
        questions: [
          { p: '¿Sigues veladas de la UFC o combates de boxeo profesional?', ops: ['Sí, veo los eventos numerados de la UFC completos', 'Solo combates mediáticos destacados (Topuria, Canelo, etc.)', 'Miro clips de nocauts impresionantes al día siguiente', 'No sigo los deportes de contacto'] },
          { p: '¿Has practicado alguna vez artes marciales o deportes de lucha?', ops: ['Sí, entreno boxeo, kickboxing o muay thai', 'Sí, entreno artes marciales de agarre (BJJ, judo, lucha)', 'Hice kárate o taekwondo de niño', 'Nunca he practicado deportes de contacto'] },
          { p: '¿Qué te parece la disciplina física y mental que exigen estos deportes?', ops: ['Admirable, requiere un nivel de sacrificio y respeto absoluto', 'Muy exigente físicamente, excelente para la defensa personal', 'Me parece demasiado lesivo o violento para mi gusto', 'No me llama la atención'] },
          { p: '¿Qué finalización te parece más impresionante en un combate?', ops: ['Un nocaut fulminante limpio con un solo golpe', 'Una sumisión técnica compleja con palanca o estrangulación', 'Una guerra épica a los 5 asaltos que se decide a los puntos', 'Cualquiera que demuestre técnica superior'] },
          { p: '¿Comprarías un paquete Pay-Per-View (PPV) para ver una gran pelea?', ops: ['Sí, si el cartel de peleas es de altísimo nivel', 'Solo si nos juntamos varios amigos en casa para pagar entre todos', 'Prefiero verlo en diferido al día siguiente', 'No pagaría por eventos deportivos individuales'] }
        ]
      },
      {
        title: 'Calistenia y Entrenamiento con Peso Corporal',
        desc: 'Dominadas, fondos, parques de street workout y flexibilidad.',
        questions: [
          { p: '¿Practicas ejercicios de calistenia con tu propio peso corporal?', ops: ['Sí, entreno regularmente en barras de parque o casa', 'Combino calistenia con pesas en el gimnasio', 'Hago flexiones y fondos ocasionales en casa', 'No practico calistenia'] },
          { p: '¿Cuántas dominadas estrictas puedes hacer seguidas?', ops: ['Más de 15 dominadas perfectas', 'Entre 8 y 15 dominadas', 'Entre 1 y 7 dominadas', 'Todavía no puedo hacer una dominada completa'] },
          { p: '¿Tienes barra de dominadas instalada en casa?', ops: ['Sí, barra en el marco de la puerta o anclada a la pared', 'No, prefiero ir al parque de barras o al gimnasio', 'Tuve una en el pasado', 'No tengo barras en casa'] },
          { p: '¿Te gustaría dominar trucos estáticos como el Muscle-up o Front Lever?', ops: ['Sí, entreno específicamente para sacar esos movimientos', 'El Muscle-up me encantaría conseguirlo', 'Solo busco ponerme en forma sin hacer trucos complejos', 'No me interesa la calistenia'] },
          { p: '¿Qué ventaja consideras superior en el entrenamiento calisténico?', ops: ['Puedes entrenar gratis en cualquier parque del mundo', 'Desarrollo de fuerza funcional y control milimétrico del cuerpo', 'Menor riesgo de lesiones graves articulares', 'Cuerpo atlético y definido sin hipertrofia excesiva'] }
        ]
      },
      {
        title: 'Deportes de Invierno y Actividades de Aventura',
        desc: 'Esquí, snowboard, senderismo de montaña y escalada.',
        questions: [
          { p: '¿Has practicado esquí o snowboard en estaciones de nieve?', ops: ['Sí, subo a la nieve todos los inviernos sin falta', 'He ido en 2 o 3 ocasiones a probar', 'Nunca he probado pero tengo muchas ganas de ir', 'No me gustan el frío ni los deportes de nieve'] },
          { p: '¿Prefieres el esquí tradicional o la tabla de snowboard?', ops: ['Esquí tradicional de dos tablas', 'Tabla de snowboard por la sensación de surf en nieve', 'Me defiendo bien en ambas disciplinas', 'No he practicado ninguna'] },
          { p: '¿Haces senderismo o rutas de montaña en la naturaleza?', ops: ['Sí, me encanta desconectar haciendo trekkings los fines de semana', 'Hago rutas sencillas de vez en cuando en primavera u otoño', 'Prefiero el mar y la playa antes que la montaña', 'No me gusta caminar por la montaña'] },
          { p: '¿Has probado la escalada en rocódromo o roca natural?', ops: ['Sí, voy a rocódromos de bloque (boulder) con frecuencia', 'He probado la escalada con arnés alguna vez', 'Me da respeto o vértigo la altura', 'Nunca he escalado'] },
          { p: '¿Te atreverías a saltar en paracaídas o hacer puenting?', ops: ['Sin dudarlo, me apasiona la adrenalina extrema', 'En paracaídas sí con instructor, pero puenting no', 'Me lo pensaría mucho, me da bastante miedo', 'Bajo ningún concepto lo haría'] }
        ]
      }
    ]
  },
  {
    category: 'Estilo de Vida & Hábitos Diarios',
    icon: '☕',
    topics: [
      {
        title: 'Calidad del Sueño y Descanso Nocturno',
        desc: 'Horas de sueño, colchón, insomnio y rutinas nocturnas.',
        questions: [
          { p: '¿Cuántas horas duermes de media cada noche?', ops: ['Menos de 6 horas (suelo dormir poco)', 'Entre 6 y 7 horas', 'Entre 7 y 8 horas (lo recomendado)', 'Más de 8 horas plácidamente'] },
          { p: '¿Miras la pantalla del móvil en la cama antes de dormir?', ops: ['Siempre, me duermo con el móvil en la mano', 'Miro 10 o 15 minutos y lo dejo en la mesita', 'Intento evitar pantallas al menos 30 minutos antes', 'Dejo el móvil fuera del dormitorio'] },
          { p: '¿Te despiertas con sensación de energía y descanso?', ops: ['Casi siempre me levanto renovado y listo', 'Me cuesta arrancar los primeros 20 minutos', 'Suelo levantarme cansado y con sueño', 'Depende de los días de la semana'] },
          { p: '¿Utilizas antifaz para dormir o tapones para los oídos?', ops: ['Sí, antifaz o tapones son indispensables para mi descanso', 'Solo cuando viajo o duermo en hoteles', 'Oscuridad total con persianas bajadas sin accesorios', 'No necesito nada especial para dormir'] },
          { p: '¿Invertirías en un colchón o almohada de gama alta ergonómica?', ops: ['Es la mejor inversión para la salud de la espalda', 'Tengo un buen colchón que compré hace pocos años', 'Uso un colchón estándar que venía con el piso', 'No le presto tanta atención al colchón'] }
        ]
      },
      {
        title: 'Teletrabajo vs Trabajo Presencial en Oficina',
        desc: 'Productividad remota, desplazamientos y conciliación.',
        questions: [
          { p: '¿Cuál es tu modalidad de trabajo o estudio habitual?', ops: ['100% en remoto desde casa', 'Modelo híbrido (2 o 3 días en casa y el resto en oficina)', '100% presencial en el lugar de trabajo', 'Actualmente estoy desempleado o estudiando presencial'] },
          { p: '¿Qué ventaja valoras más de trabajar desde casa?', ops: ['Ahorro de tiempo y dinero en desplazamientos', 'Mayor flexibilidad horaria y conciliación familiar', 'Trabajar en ropa cómoda sin estrés de oficina', 'Comer comida casera sana todos los días'] },
          { p: '¿Sientes que eres más productivo en casa o en la oficina?', ops: ['Mucho más productivo en casa sin interrupciones', 'Más productivo en la oficina con equipo cerca', 'Similar en ambos entornos', 'En casa a veces me distraigo con facilidad'] },
          { p: '¿Cuánto tiempo tardas en desplazarte a tu trabajo diario?', ops: ['Menos de 15 minutos o no me desplazo', 'Entre 15 y 30 minutos por trayecto', 'Entre 30 y 60 minutos por trayecto', 'Más de 1 hora de ida y otra de vuelta'] },
          { p: '¿Aceptarías un trabajo con salario menor a cambio de ser 100% remoto?', ops: ['Sí, la libertad geográfica y el tiempo valen más', 'Solo si la diferencia de sueldo es pequeña (menos del 10%)', 'No, prefiero maximizar mis ingresos aunque sea presencial', 'Prefiero el ambiente social de la oficina'] }
        ]
      },
      {
        title: 'Gestión del Tiempo y Productividad Personal',
        desc: 'Método Pomodoro, listas de tareas, agendas y Notion.',
        questions: [
          { p: '¿Utilizas alguna aplicación para gestionar tus tareas y notas?', ops: ['Notion / Obsidian para organizar toda mi vida', 'Google Calendar / Apple Calendar principalmente', 'App sencilla de listas (Todoist, Recordatorios, Keep)', 'Prefiero libreta y bolígrafo de papel'] },
          { p: '¿Has utilizado la técnica Pomodoro (25 min de foco y 5 de descanso)?', ops: ['Sí, es mi método favorito para sesiones de estudio o trabajo', 'La he probado pero a veces interrumpe mi estado de flujo', 'La conozco pero me cuesta ser constante', 'Nunca he probado esa técnica'] },
          { p: '¿Tiendes a procrastinar tareas importantes y dejarlas para el final?', ops: ['A menudo lo dejo todo para la fecha límite', 'A veces procrastino tareas tediosas pero cumplo', 'Rara vez, soy muy organizado y me anticipo', 'Solo cuando estoy muy cansado o desmotivado'] },
          { p: '¿Silencias las notificaciones del móvil durante tus horas de trabajo?', ops: ['Sí, modo No Molestar o Enfoque activado siempre', 'Solo silencio llamadas y dejo mensajes importantes', 'No silencio el móvil, miro cada aviso que llega', 'Tengo el móvil en silencio permanente las 24 horas'] },
          { p: '¿Sientes que tienes suficiente tiempo libre para tus aficiones?', ops: ['Sí, consigo equilibrar obligaciones y ocio', 'Me gustaría tener un par de horas más libres al día', 'Apenas me queda tiempo libre entre semana', 'Tengo bastante tiempo libre actualmente'] }
        ]
      },
      {
        title: 'Viajes, Escapadas y Vacaciones',
        desc: 'Destinos de playa o montaña, vuelos baratos y hoteles.',
        questions: [
          { p: '¿Qué tipo de viaje prefieres para tus vacaciones principales?', ops: ['Viaje internacional a un país con cultura muy distinta', 'Escapada de sol, playa y relax sin prisas', 'Ruta de turismo cultural por ciudades históricas', 'Aventura en la naturaleza y paisajes salvajes'] },
          { p: '¿Con qué antelación sueles planificar tus viajes?', ops: ['Con varios meses de antelación para conseguir buenos precios', 'Con 3 o 4 semanas de margen', 'Suelo decidir y reservar a última hora en ofertas', 'Soy muy espontáneo, viajo casi sin plan'] },
          { p: '¿Prefieres alojarte en hoteles o en apartamentos vacacionales (Airbnb)?', ops: ['Hoteles por el servicio, limpieza y desayuno incluido', 'Apartamentos completos por tener cocina y más espacio', 'Hostales juveniles para conocer a otros viajeros', 'Casas rurales tranquilas'] },
          { p: '¿Qué herramienta utilizas para buscar vuelos y alojamientos?', ops: ['Skyscanner / Google Flights para vuelos baratos', 'Booking.com para hoteles y alojamientos', 'Airbnb para estancias largas', 'Directamente en las webs de las aerolíneas'] },
          { p: '¿Sueles viajar solo, en pareja o con grupo de amigos?', ops: ['En pareja', 'Con amigos para pasarlo bien', 'Con mi familia', 'He viajado solo y me parece una experiencia fantástica'] }
        ]
      },
      {
        title: 'Redes Sociales y Tiempo de Pantalla',
        desc: 'Instagram, X (Twitter), desconexión digital y salud mental.',
        questions: [
          { p: '¿Cuál es la red social en la que pasas más tiempo al día?', ops: ['Instagram', 'TikTok', 'X (Twitter)', 'Reddit / YouTube'] },
          { p: '¿Revisas el tiempo de pantalla diario en los ajustes de tu teléfono?', ops: ['Sí, lo miro todas las semanas y me sorprende la cifra', 'Ocasionalmente por curiosidad', 'Prefiero no mirarlo para no asustarme', 'No sé dónde se consulta esa métrica'] },
          { p: '¿Has hecho alguna vez un detox digital (días sin redes sociales)?', ops: ['Sí, y la sensación de paz mental fue increíble', 'He borrado apps durante un fin de semana', 'Me gustaría hacerlo pero dependo del móvil para trabajar', 'Nunca he intentado desconectarme'] },
          { p: '¿Te genera ansiedad o FOMO (miedo a perderse algo) no mirar el móvil?', ops: ['A veces siento la necesidad compulsiva de refrescar el feed', 'Solo si estoy esperando un mensaje importante', 'Para nada, puedo pasar horas sin tocar el teléfono', 'Rara vez me genera inquietud'] },
          { p: '¿Sueles publicar historias o publicaciones de tu vida privada?', ops: ['Publico historias de mis viajes y planes con frecuencia', 'Solo subo contenido muy seleccionado en ocasiones especiales', 'Tengo cuenta pero casi nunca publico fotos mías', 'Solo consumo contenido ajeno de forma anónima'] }
        ]
      },
      {
        title: 'Lectura de Noticias y Actualidad Informativa',
        desc: 'Prensa digital, boletines (newsletters) y verificación.',
        questions: [
          { p: '¿Dónde te informas principalmente de las noticias del mundo?', ops: ['Redes sociales (X / Twitter, Reddit)', 'Diarios digitales de noticias y periódicos online', 'Canales de YouTube y podcasts de análisis', 'Televisión tradicional o radio'] },
          { p: '¿Qué nivel de confianza tienes en los medios de comunicación masivos?', ops: ['Poca confianza, contrarresto varias fuentes independientes', 'Confianza moderada según el medio y la firma', 'Bastante confianza en periódicos de prestigio reconocido', 'Desconfío casi por completo de las noticias'] },
          { p: '¿Estás suscrito a boletines de noticias (newsletters) por email?', ops: ['Sí, leo newsletters especializadas todas las mañanas', 'Estoy suscrito a un par pero no siempre las abro', 'Prefiero leer noticias en feeds o agregadores', 'No utilizo newsletters por correo'] },
          { p: '¿Intentas verificar una noticia llamativa antes de reenviarla?', ops: ['Siempre busco en Google si es real antes de compartir', 'Solo si me parece demasiado exagerada o sospechosa', 'A veces comparto titulares llamativos sin profundizar', 'No suelo compartir noticias'] },
          { p: '¿Qué sección de noticias te interesa más consultar?', ops: ['Tecnología, ciencia e innovación digital', 'Economía, mercados financieros y negocios', 'Actualidad política internacional', 'Deportes y entretenimiento'] }
        ]
      },
      {
        title: 'Cuidado de la Salud Mental y Manejo del Estrés',
        desc: 'Meditación, paseos en la naturaleza, terapia y descanso.',
        questions: [
          { p: '¿Qué actividad te ayuda más a desconectar y reducir el estrés?', ops: ['Hacer deporte intenso o ir al gimnasio', 'Jugar a videojuegos o ver una buena serie', 'Salir a caminar al aire libre o escuchar música', 'Dormir una siesta o leer un libro tranquilo'] },
          { p: '¿Has practicado meditación guiada o mindfulness alguna vez?', ops: ['Sí, utilizo apps (Headspace, Calm) con regularidad', 'Lo he probado en algunas ocasiones', 'Me cuesta calmar la mente y quedarme quieto', 'Nunca he probado la meditación'] },
          { p: '¿Qué opinas de acudir a terapia psicológica para el bienestar personal?', ops: ['Fundamental, todo el mundo debería tener acceso a terapia', 'Muy positivo en momentos de cambios o crisis vitales', 'Útil si tienes un problema grave sin resolver', 'Prefiero gestionar mis problemas de forma personal'] },
          { p: '¿Sientes que el ritmo de vida actual es demasiado acelerado?', ops: ['Totalmente, la sociedad vive con exceso de prisa y sobreestimulación', 'A veces es exigente pero se puede encontrar equilibrio', 'A mí me gusta el ritmo dinámico y activo', 'Depende de la etapa en la que te encuentres'] },
          { p: '¿Te permites tener días enteros de descanso sin sentirte culpable?', ops: ['Sí, descansar es productivo para recargar energía', 'A veces siento ligera culpa si no hago algo útil', 'Me cuesta muchísimo estar parado sin hacer tareas', 'Disfruto al 100% de los días de relax'] }
        ]
      },
      {
        title: 'Idiomas y Aprendizaje Continuo',
        desc: 'Duolingo, inglés profesional, cursos online y fluidez.',
        questions: [
          { p: '¿Cuántos idiomas hablas o estudias actualmente?', ops: ['Español nativo e Inglés fluido (bilingüe)', 'Español nativo e Inglés intermedio en mejora', 'Tres o más idiomas distintos', 'Solo mi lengua materna'] },
          { p: '¿Has utilizado aplicaciones como Duolingo para aprender idiomas?', ops: ['Sí, mantengo mi racha activa a diario', 'La he probado durante un tiempo', 'Prefiero academias presenciales o profesores particulares', 'Prefiero aprender viendo series y leyendo en versión original'] },
          { p: '¿Qué habilidad de un nuevo idioma te cuesta más dominar?', ops: ['Hablar con fluidez y soltura en una conversación real', 'Entender el acento nativo rápido en audios', 'La gramática y conjugaciones complejas', 'Aprender y retener vocabulario nuevo'] },
          { p: '¿Haces cursos online para mejorar tus conocimientos profesionales?', ops: ['Sí, con frecuencia en plataformas como Udemy, Coursera, etc.', 'He completado algún curso puntual para mi currículum', 'Aprendo de forma autodidacta con tutoriales de YouTube', 'Casi nunca hago cursos por internet'] },
          { p: '¿Qué idioma te gustaría aprender si tuvieras tiempo libre garantizado?', ops: ['Japonés por su cultura, anime y caligrafía', 'Alemán o Francés por oportunidades laborales en Europa', 'Chino mandarín por su peso global en el comercio', 'Italiano o Portugués por su belleza y cercanía'] }
        ]
      },
      {
        title: 'Cocina Casera y Gastronomía en el Hogar',
        desc: 'Air fryer, cocinar a diario, recetas de YouTube e ingredientes.',
        questions: [
          { p: '¿Cocinas tus propias comidas habitualmente en casa?', ops: ['Sí, cocino casi todos los días desde cero', 'Cocino cosas sencillas y rápidas entre semana', 'Cocino principalmente los fines de semana', 'Casi no cocino, dependo de delivery o comida preparada'] },
          { p: '¿Tienes una freidora de aire (Air Fryer) en tu cocina?', ops: ['Sí, es el electrodoméstico que más utilizo en mi día a día', 'Tengo una pero no la uso tanto como pensaba', 'No tengo pero tengo muchas ganas de comprar una', 'Prefiero el horno convencional o sartenes de toda la vida'] },
          { p: '¿Dónde buscas inspiración para nuevas recetas?', ops: ['En vídeos de TikTok e Instagram Reels rápidos', 'En canales de cocina de YouTube detallados', 'En recetarios clásicos o recetas de mi familia', 'Improviso con lo que tengo en la nevera'] },
          { p: '¿Practicas el batch cooking (cocinar el domingo para toda la semana)?', ops: ['Sí, me ahorra muchísimo tiempo de lunes a viernes', 'Preparo comida para 2 o 3 días como máximo', 'Prefiero cocinar raciones frescas en el momento', 'No planifico las comidas de la semana'] },
          { p: '¿Qué tipo de cocina internacional disfrutas más preparar en casa?', ops: ['Comida italiana (pasta fresca, salsas caseras, pizzas)', 'Comida mexicana (fajitas, tacos con guacamole fresco)', 'Comida asiática (arroz frito, fideos salteados, curris)', 'Comida tradicional casera de mi país'] }
        ]
      },
      {
        title: 'Relaciones Sociales y Vida con Amigos',
        desc: 'Planes de fin de semana, quedadas, llamadas y comunidad.',
        questions: [
          { p: '¿Con qué frecuencia te reúnes en persona con tu grupo de amigos?', ops: ['Todas las semanas al menos una o dos veces', 'Cada dos o tres semanas', 'Una vez al mes o en ocasiones señaladas', 'Menos de una vez al mes por distancia o rutinas'] },
          { p: '¿Cuál es tu plan preferido para un fin de semana con amigos?', ops: ['Cena en restaurante rico y tomar algo en buen ambiente', 'Juntarnos en casa de alguien para jugar a juegos de mesa o consola', 'Plan al aire libre, barbacoa o excursión de día', 'Ir de fiesta o a conciertos nocturnos'] },
          { p: '¿Prefieres un círculo pequeño de amigos íntimos o muchos conocidos?', ops: ['Un grupo muy reducido de 3 a 5 amigos leales de toda la vida', 'Varios grupos distintos según el ambiente (ocio, deporte, trabajo)', 'Me gusta tener una red social amplia y conocer gente nueva', 'Soy una persona bastante solitaria'] },
          { p: '¿Cómo mantienes el contacto con tus amigos en el día a día?', ops: ['A través de un grupo activo de WhatsApp con memes y audios', 'Por mensajes privados en Instagram o TikTok', 'Nos llamamos por teléfono o Discord con frecuencia', 'Solo hablamos cuando vamos a quedar físicamente'] },
          { p: '¿Te cuesta hacer nuevos amigos en la edad adulta?', ops: ['Sí, con el trabajo y la rutina es más difícil conectar', 'A través de aficiones compartidas (gimnasio, juegos) surge natural', 'No tengo problemas para entablar conversación con desconocidos', 'No suelo buscar nuevas amistades activamente'] }
        ]
      }
    ]
  }
,
{
  "category": "Gastronomía & Restaurantes",
  "icon": "🍕",
  "topics": [
    {
      "title": "Comida Rápida y Cadenas de Hamburguesas",
      "desc": "McDonalds, Burger King, Five Guys y smash burgers.",
      "questions": [
        {
          "p": "¿Qué cadena de comida rápida prefieres para una hamburguesa?",
          "ops": [
            "McDonalds por las patatas y hamburguesas clásicas",
            "Burger King por el sabor a la parrilla",
            "Cadenas de Smash Burgers gourmet",
            "Wendy / Carl Jr / Five Guys"
          ]
        },
        {
          "p": "¿Prefieres hamburguesa clásica gruesa o smash burger crujiente?",
          "ops": [
            "Smash burger fina con bordes caramelizados",
            "Hamburguesa gruesa al punto jugosa",
            "Hamburguesa de pollo frito crujiente",
            "Hamburguesa vegetal / vegetariana"
          ]
        },
        {
          "p": "¿Qué salsa es imprescindible en tus patatas fritas?",
          "ops": [
            "Ketchup clásico de tomate",
            "Mayonesa o alioli cremoso",
            "Salsa barbacoa ahumada (BBQ)",
            "Salsa de queso cheddar fundido"
          ]
        },
        {
          "p": "¿Pides por el autoservicio (Auto-King / McAuto) o en sala?",
          "ops": [
            "Por el autoservicio desde el coche para llevar",
            "En los quioscos táctiles de la sala para comer allí",
            "Pido a domicilio por aplicación",
            "Para llevar en mostrador"
          ]
        },
        {
          "p": "¿Pruebas las ediciones especiales y promociones temporales?",
          "ops": [
            "Sí, siempre pruebo la hamburguesa especial de temporada",
            "Solo si tiene ingredientes que me llamen mucho",
            "Prefiero pedir siempre mi menú favorito de siempre",
            "Rara vez me fijo en las promociones"
          ]
        }
      ]
    },
    {
      "title": "Pizzas: Masa, Ingredientes y Tradición",
      "desc": "Pizza napolitana, masa fina, bordes rellenos y pepperoni.",
      "questions": [
        {
          "p": "¿Qué estilo de masa de pizza te gusta más?",
          "ops": [
            "Masa napolitana fina con borde inflado y alveolado",
            "Masa fina y crujiente estilo romana",
            "Masa gruesa y esponjosa estilo Chicago / Deep Dish",
            "Masa con borde relleno de queso"
          ]
        },
        {
          "p": "¿Cuál es tu pizza favorita de todos los tiempos?",
          "ops": [
            "Pepperoni clásico con mozzarella y orégano",
            "Pizza Barbacoa con carne picada y bacon",
            "Cuatro Quesos (Quattro Formaggi) cremosa",
            "Margarita tradicional con albahaca fresca"
          ]
        },
        {
          "p": "¿Piña en la pizza (Pizza Hawaiana): a favor o en contra?",
          "ops": [
            "Totalmente a favor, el contraste dulce-salado es genial",
            "En contra, la fruta caliente no pertenece a la pizza",
            "Me da igual, la como si la ponen pero no la pido",
            "Nunca la he probado"
          ]
        },
        {
          "p": "¿Comes la pizza con las manos o con cubiertos?",
          "ops": [
            "Siempre con las manos doblando la porción",
            "Con cuchillo y tenedor para no mancharme",
            "Empiezo con cubiertos y termino con las manos",
            "Depende de si estoy en casa o en un restaurante elegante"
          ]
        },
        {
          "p": "¿Te comes los bordes de la pizza o los dejas en el plato?",
          "ops": [
            "Me los como siempre, especialmente con salsa o aceite picante",
            "Solo si la masa está tierna y recién horneada",
            "Suelo dejar los bordes para no llenarme tanto",
            "Solo si vienen rellenos de queso"
          ]
        }
      ]
    },
    {
      "title": "Sushi y Cocina Japonesa",
      "desc": "Nigiris, makis, salmón, atún rojo y restaurantes buffet libre.",
      "questions": [
        {
          "p": "¿Con qué frecuencia comes sushi o comida japonesa?",
          "ops": [
            "Al menos 2 o 3 veces al mes",
            "Una vez al mes como premio especial",
            "Solo en ocasiones muy puntuales con amigos",
            "No me gusta el pescado crudo ni el sushi"
          ]
        },
        {
          "p": "¿Qué tipo de pieza de sushi es tu favorita?",
          "ops": [
            "Nigiris de salmón flameado con salsas",
            "Makis y rolls tempurizados crujientes",
            "Sashimi puro de atún rojo o salmón fresco",
            "Gunkans o temakis especiales"
          ]
        },
        {
          "p": "¿Sabes comer con palillos japoneses con soltura?",
          "ops": [
            "Sí, los domino perfectamente sin esfuerzo",
            "Me defiendo bien aunque a veces se me resbala alguna pieza",
            "Pido adaptador o tenedor cuando puedo",
            "Como las piezas de sushi con las manos como en Japón tradicional"
          ]
        },
        {
          "p": "¿Le pones wasabi y jengibre al sushi?",
          "ops": [
            "Disuelvo wasabi en la soja para darle toque picante",
            "Me encanta el jengibre encurtido entre pieza y pieza",
            "Solo salsa de soja suave sin wasabi",
            "Prefiero salsas dulces como teriyaki o anguila"
          ]
        },
        {
          "p": "¿Prefieres restaurantes buffet a la carta con tablet o restaurante tradicional?",
          "ops": [
            "Buffet a la carta con pedidos infinitos por tablet",
            "Restaurante tradicional con menú degustación cuidado",
            "Locales de cinta giratoria (Kaitenzushi)",
            "Pido bandejas de sushi para comer en casa"
          ]
        }
      ]
    },
    {
      "title": "Tacos, Comida Mexicana y Especias",
      "desc": "Tacos al pastor, birria, guacamole casero y salsas picantes.",
      "questions": [
        {
          "p": "¿Cuál es tu platillo mexicano favorito?",
          "ops": [
            "Tacos al pastor con piña y cilantro",
            "Tacos de birria con queso y consomé para dipear",
            "Burritos grandes y quesadillas",
            "Nachos con guacamole, queso fundido y frijoles"
          ]
        },
        {
          "p": "¿Qué tolerancia tienes al picante en las comidas?",
          "ops": [
            "Alta, me encantan las salsas muy picantes (Habanero, Jalapeño)",
            "Media, disfruto el picante suave que realce el sabor",
            "Baja, el picante fuerte me arruina la comida",
            "Cero, no tolero el picante en absoluto"
          ]
        },
        {
          "p": "¿Prefieres tortillas de maíz o tortillas de trigo?",
          "ops": [
            "Tortillas de maíz nixtamalizado tradicionales",
            "Tortillas de harina de trigo suaves",
            "Totopos crujientes de maíz",
            "Me gustan ambas por igual"
          ]
        },
        {
          "p": "¿Cómo prefieres el guacamole?",
          "ops": [
            "Casero en molcajete con trozos de aguacate, tomate, cebolla y lima",
            "Totalmente triturado y cremoso sin grumos",
            "Con toque de cilantro y chile jalapeño picado",
            "Comprado ya preparado en tarrina por rapidez"
          ]
        },
        {
          "p": "¿Qué bebida acompaña mejor a una buena comida mexicana?",
          "ops": [
            "Cerveza mexicana bien fría con lima (Corona, Modelo)",
            "Margarita con sal en el borde",
            "Aguas frescas naturales (Horchata, Jamaica)",
            "Refrescos clásicos de cola"
          ]
        }
      ]
    },
    {
      "title": "Postres, Helados y Dulces",
      "desc": "Tarta de queso, chocolate, heladerías artesanales y tiramisú.",
      "questions": [
        {
          "p": "¿Pides postre habitualmente cuando sales a comer a un restaurante?",
          "ops": [
            "Siempre, dejo hueco obligatorio para el dulce",
            "Solo si la carta tiene tarta de queso fluida o chocolate",
            "Solo para compartir entre varios comensales",
            "Casi nunca pido postre, prefiero terminar con café"
          ]
        },
        {
          "p": "¿Cuál es tu sabor de helado predilecto?",
          "ops": [
            "Pistacho cremoso o avellana tostada",
            "Chocolate negro intenso o con cookies",
            "Vainilla Bourbon o dulce de leche",
            "Sabores frutales refrescantes (Limón, mango, fresa)"
          ]
        },
        {
          "p": "¿Prefieres el helado en tarrina o en cucurucho de barquillo?",
          "ops": [
            "Cucurucho de galleta crujiente siempre",
            "En tarrina con cuchara para no gotear",
            "En tarrina con galleta encima",
            "En copa grande con nata y sirope"
          ]
        },
        {
          "p": "¿Qué tarta te parece la reina de la repostería?",
          "ops": [
            "Tarta de queso horneada cremosa estilo Donostia",
            "Tarta de chocolate con capas y trufa",
            "Tarta de zanahoria (Carrot cake) con frosting de queso",
            "Tiramisú italiano tradicional con mascarpone"
          ]
        },
        {
          "p": "¿Eres más de chocolate negro puro, con leche o blanco?",
          "ops": [
            "Chocolate negro (+70% de cacao) intenso",
            "Chocolate con leche dulce y cremoso",
            "Chocolate blanco mantecoso",
            "Cualquiera mientras lleve avellanas o almendras"
          ]
        }
      ]
    },
    {
      "title": "Tapas, Raciones y Gastronomía Española",
      "desc": "Tortilla de patatas, jamón ibérico, croquetas y bravas.",
      "questions": [
        {
          "p": "¿Tortilla de patatas: con cebolla o sin cebolla?",
          "ops": [
            "Con cebolla siempre, le da jugosidad y dulzor",
            "Sin cebolla, solo patata, huevo y sal",
            "Me como cualquiera mientras esté poco cuajada",
            "Prefiero la tortilla muy cuajada y firme"
          ]
        },
        {
          "p": "¿Cómo te gusta la tortilla de patatas por dentro?",
          "ops": [
            "Muy jugosa y líquida (estilo Betanzos)",
            "En su punto medio cremoso pero que no se desparrame",
            "Bien cuajada y compacta para cortar en dados",
            "Rellena de jamón y queso"
          ]
        },
        {
          "p": "¿Cuál es tu ración imprescindible de tapas con amigos?",
          "ops": [
            "Croquetas cremosas caseras (de jamón o boletus)",
            "Patatas bravas con salsa picante auténtica",
            "Jamón ibérico de bellota con pan con tomate",
            "Calamares a la romana o rabas"
          ]
        },
        {
          "p": "¿Qué bebida pides habitualmente para el aperitivo?",
          "ops": [
            "Cerveza caña bien tirada con espuma",
            "Vermut rojo con hielo y rodaja de naranja",
            "Vino tinto o blanco fresco",
            "Refresco o agua con gas"
          ]
        },
        {
          "p": "¿Prefieres el tapeo de pie de barra en barra o mesa sentado?",
          "ops": [
            "Ir de bar en bar probando la tapa estrella de cada uno",
            "Sentados tranquilamente en terraza al sol",
            "Mesa en salón interior con sobremesa larga",
            "Cualquiera mientras haya buen ambiente y comida rica"
          ]
        }
      ]
    },
    {
      "title": "Desayunos y Brunches de Fin de Semana",
      "desc": "Huevos benedict, tostadas de aguacate, tortitas y zumo.",
      "questions": [
        {
          "p": "¿Qué sueles desayunar habitualmente entre semana?",
          "ops": [
            "Café solo o con leche y nada más (desayuno rápido)",
            "Tostada con aceite de oliva virgen extra y tomate / pavo",
            "Cereales, avena o yogur con frutos secos",
            "Huevos revueltos o tortilla con fruta"
          ]
        },
        {
          "p": "¿Te gustan los brunches de fin de semana?",
          "ops": [
            "Me encantan, es mi plan favorito de sábado o domingo",
            "He ido en algunas ocasiones y se come de lujo",
            "Me parece una moda cara para lo que sirven",
            "Prefiero el almuerzo tradicional a mediodía"
          ]
        },
        {
          "p": "¿Prefieres desayuno dulce o desayuno salado?",
          "ops": [
            "Salado (tostadas, huevos, queso, jamón)",
            "Dulce (croissants, tortitas, gofres con sirope)",
            "Combinación de ambos (primero salado y luego dulce)",
            "Solo líquidos (café, té o zumo)"
          ]
        },
        {
          "p": "¿Qué plato de brunch no puede faltar en tu mesa?",
          "ops": [
            "Huevos Benedictine con salsa holandesa sobre pan brioche",
            "Tostada de pan de masa madre con aguacate y huevo poché",
            "Pancakes esponjosos con sirope de arce y frutos rojos",
            "Açai bowl frío con granola crujiente"
          ]
        },
        {
          "p": "¿Zumo de naranja recién exprimido o zumo envasado?",
          "ops": [
            "Exprimido natural en el momento, no hay comparación",
            "Zumo envasado 100% fruta refrigerado por rapidez",
            "Prefiero batidos verdes (smoothies) de frutas y verduras",
            "No suelo tomar zumos en el desayuno"
          ]
        }
      ]
    },
    {
      "title": "Barbacoas, Asados y Carnes a la Brasa",
      "desc": "Chuletones, costillares BBQ, carbón y parrilladas familiares.",
      "questions": [
        {
          "p": "¿Cuál es tu punto favorito de cocción de la carne roja?",
          "ops": [
            "Poco hecho (sangrante y muy tierno)",
            "Al punto (rosado en el centro y sellado por fuera)",
            "Al punto más (casi hecho pero jugoso)",
            "Muy hecho (bien cocido sin zonas rojas)"
          ]
        },
        {
          "p": "¿Prefieres barbacoa de carbón tradicional o de gas?",
          "ops": [
            "De carbón o leña por el inconfundible aroma a humo",
            "De gas por rapidez de encendido y limpieza fácil",
            "Parrilla eléctrica o plancha en cocina",
            "Cualquiera mientras la carne sea de calidad"
          ]
        },
        {
          "p": "¿Qué corte de carne disfrutas más en un asado?",
          "ops": [
            "Chuletón madurado / Ribeye grueso",
            "Costillas de cerdo marinadas en salsa barbacoa",
            "Chorizo criollo, morcilla y panceta crujiente",
            "Picaña o entraña a fuego lento"
          ]
        },
        {
          "p": "¿Sueles ser el encargado de la parrilla en reuniones con amigos?",
          "ops": [
            "Sí, soy el maestro asador oficial de mi grupo",
            "Ayudo con el fuego y los platos",
            "Prefiero ocuparme de las ensaladas, bebidas o postre",
            "Solo me siento a disfrutar de la comida lista"
          ]
        },
        {
          "p": "¿Qué guarnición no puede faltar con un buen asado?",
          "ops": [
            "Patatas asadas en papel de aluminio con mantequilla",
            "Ensalada fresca mixta para desengrasar",
            "Pimientos asados a la brasa",
            "Pan rústico crujiente con chimichurri"
          ]
        }
      ]
    },
    {
      "title": "Cervezas Artesanales e Industriales",
      "desc": "IPAs aromáticas, lagers rubias, cervezas tostadas y catas.",
      "questions": [
        {
          "p": "¿Qué tipo de cerveza prefieres habitualmente?",
          "ops": [
            "Lager rubia tradicional ligera y muy fría",
            "IPA (India Pale Ale) aromática y lupulada",
            "Cerveza tostada o de trigo (tipo belga / alemana)",
            "Stout o cerveza negra con notas de café y cacao"
          ]
        },
        {
          "p": "¿Consumes cerveza artesanal (Craft Beer)?",
          "ops": [
            "Sí, busco marcas locales y nuevos lotes en latas de diseño",
            "Me gusta probarlas cuando voy a cervecerías especializadas",
            "Prefiero las marcas comerciales de toda la vida",
            "No tomo cerveza"
          ]
        },
        {
          "p": "¿Bebes la cerveza directamente del botellín o en vaso de cristal?",
          "ops": [
            "En copa o vaso de cristal fino bien tirada",
            "Directamente del botellín bien frío",
            "En jarra congelada en verano",
            "En lata directamente"
          ]
        },
        {
          "p": "¿Qué opinas de la cerveza 0,0% sin alcohol?",
          "ops": [
            "Han mejorado muchísimo y son una gran opción para cuidarse",
            "Las tomo cuando tengo que conducir",
            "Prefiero tomar agua antes que cerveza sin alcohol",
            "No tomo cerveza"
          ]
        },
        {
          "p": "¿Cuál es el mejor momento para una cerveza bien fría?",
          "ops": [
            "Al salir de trabajar con compañeros (Afterwork)",
            "El fin de semana al mediodía con el aperitivo al sol",
            "Viendo un partido de fútbol emocionante",
            "Por la noche cenando con amigos"
          ]
        }
      ]
    },
    {
      "title": "Vino, Enología y Bodegas",
      "desc": "Tintos crianza, blancos frescos, uvas y catas de vino.",
      "questions": [
        {
          "p": "¿Qué tipo de vino sueles pedir con más frecuencia?",
          "ops": [
            "Vino tinto con cuerpo (Ribera del Duero, Rioja, Malbec)",
            "Vino blanco fresco y afrutado (Albariño, Rueda, Verdejo)",
            "Vino rosado o espumoso (Cava, Champagne, Prosecco)",
            "No suelo beber vino"
          ]
        },
        {
          "p": "¿Con qué frecuencia tomas una copa de vino?",
          "ops": [
            "En comidas o cenas de fin de semana con buena comida",
            "Casi a diario con la comida principal",
            "Solo en celebraciones especiales o brindis",
            "Muy rara vez"
          ]
        },
        {
          "p": "¿Has visitado alguna vez una bodega con cata guiada de vinos?",
          "ops": [
            "Sí, he hecho enoturismo y me pareció una experiencia genial",
            "Me gustaría visitar alguna bodega próximamente",
            "Solo he asistido a catas en restaurantes o eventos",
            "No he visitado bodegas"
          ]
        },
        {
          "p": "¿Cuánto sueles gastar en una botella de vino para casa?",
          "ops": [
            "Entre $5 y $10 USD para consumo habitual",
            "Entre $10 y $20 USD para una cena especial",
            "Más de $25 USD buscando añadas o bodegas de autor",
            "Casi nunca compro botellas de vino"
          ]
        },
        {
          "p": "¿Te fijas en la Denominación de Origen al elegir un vino en el supermercado?",
          "ops": [
            "Siempre, tengo mis regiones y variedades de uva favoritas",
            "Miro el diseño de la etiqueta y el rango de precio",
            "Pido consejo a amigos o dependientes de la tienda",
            "Cojo la botella que esté en oferta"
          ]
        }
      ]
    }
  ]
},
{
  "category": "Viajes, Destinos & Turismo",
  "icon": "✈️",
  "topics": [
    {
      "title": "Aerolíneas de Bajo Coste vs Aerolíneas Tradicionales",
      "desc": "Ryanair, equipaje de mano, embarque prioritario y vuelos.",
      "questions": [
        {
          "p": "¿Sueles viajar con aerolíneas Low Cost (Ryanair, Vueling, EasyJet)?",
          "ops": [
            "Sí, casi siempre para encontrar los billetes más baratos",
            "Solo para vuelos cortos de menos de 2 horas",
            "Prefiero aerolíneas tradicionales con más servicios incluidos",
            "Evito las low cost por la incomodidad y políticas de maletas"
          ]
        },
        {
          "p": "¿Pagas por añadir equipaje de mano en cabina o viajas solo con mochila?",
          "ops": [
            "Viajo solo con una mochila bajo el asiento para no pagar extras",
            "Pago siempre por la maleta de cabina de 10 kg",
            "Facturo maleta grande en bodega para llevar todo cómodo",
            "Depende de la duración del viaje"
          ]
        },
        {
          "p": "¿Pagas por elegir asiento en el avión?",
          "ops": [
            "No, dejo que el sistema me asigne asiento aleatorio gratis",
            "Pago para asegurar ventanilla o salida de emergencia",
            "Solo si viajo acompañado para ir sentados juntos",
            "Solo en vuelos intercontinentales largos"
          ]
        },
        {
          "p": "¿Qué es lo que más te molesta en un aeropuerto?",
          "ops": [
            "Las colas interminables en los controles de seguridad",
            "Los retrasos imprevistos y cancelaciones de vuelos",
            "Los precios desorbitados del agua y comida en terminales",
            "La gente que se agolpa en la puerta antes de su turno de embarque"
          ]
        },
        {
          "p": "¿Con cuánta antelación llegas al aeropuerto antes del despegue?",
          "ops": [
            "Con 2 horas para vuelos nacionales / europeos",
            "Con más de 3 horas para vuelos internacionales largos",
            "Con el tiempo justo (1 hora o menos si llevo solo mochila)",
            "Siempre con margen holgado para no estresarme"
          ]
        }
      ]
    },
    {
      "title": "Destinos de Playa: Caribe vs Mediterráneo",
      "desc": "Aguas cristalinas, resorts todo incluido, calas y verano.",
      "questions": [
        {
          "p": "¿Qué tipo de destino de playa prefieres para relajarte?",
          "ops": [
            "Resorts todo incluido en el Caribe (Cancún, Punta Cana)",
            "Calas vírgenes de aguas turquesas en el Mediterráneo (Baleares, Grecia)",
            "Playas de arena dorada con olas para hacer surf",
            "Playas tranquilas familiares de fácil acceso"
          ]
        },
        {
          "p": "¿Te gusta pasar todo el día tumbado en la hamaca al sol?",
          "ops": [
            "Sí, desconexión total con libro, bebida y siesta",
            "Un par de horas al sol y luego prefiero bañarme o pasear",
            "Prefiero hacer actividades acuáticas (snorkel, kayak, moto de agua)",
            "No aguanto mucho tiempo al sol, busco la sombra"
          ]
        },
        {
          "p": "¿Has estado en un hotel con régimen de Todo Incluido (All Inclusive)?",
          "ops": [
            "Sí, me encanta la comodidad de comer y beber sin pensar en gastos",
            "He estado pero prefiero salir a explorar restaurantes locales",
            "Me gustaría probar la experiencia algún día",
            "Prefiero apartamentos para cocinar mi propia comida"
          ]
        },
        {
          "p": "¿Qué protector solar utilizas en la playa?",
          "ops": [
            "Factor de protección muy alto SPF 50+ siempre",
            "Factor SPF 30 resistente al agua",
            "Aceite bronceador para coger color rápido",
            "Rara vez me aplico protector solar"
          ]
        },
        {
          "p": "¿Prefieres bañarte en el mar o en la piscina del hotel?",
          "ops": [
            "En el mar, el agua salada y la naturaleza no tienen rival",
            "En la piscina del hotel con hamacas cómodas sin arena",
            "Alterno entre ambas a lo largo del día",
            "Casi no me baño, voy por la brisa y las vistas"
          ]
        }
      ]
    },
    {
      "title": "Turismo en Grandes Capitales del Mundo",
      "desc": "Nueva York, Tokio, Londres, París y rascacielos.",
      "questions": [
        {
          "p": "¿Cuál es la gran capital mundial que más sueñas con visitar?",
          "ops": [
            "Tokio (Japón) por su fascinante mezcla de tradición y futuro",
            "Nueva York (EE.UU.) por su energía de película y rascacielos",
            "Londres o París por su historia, museos y elegancia",
            "Roma por sus monumentos milenarios en cada esquina"
          ]
        },
        {
          "p": "¿Cómo te desplazas cuando haces turismo en una gran ciudad?",
          "ops": [
            "En metro y autobús público como un ciudadano local",
            "Caminando decenas de kilómetros al día hasta cansarme",
            "En Uber o taxis para ir directo a cada punto",
            "En autobuses turísticos descapotables (Hop-on Hop-off)"
          ]
        },
        {
          "p": "¿Visitas museos de arte e historia en tus viajes urbanos?",
          "ops": [
            "Sí, reservo entradas para los museos más importantes",
            "Solo 1 o 2 museos emblemáticos si son imprescindibles",
            "Prefiero pasear por las calles y barrios antes que entrar a museos",
            "No me gusta visitar museos"
          ]
        },
        {
          "p": "¿Subes a miradores de rascacielos para ver la ciudad desde arriba?",
          "ops": [
            "Sí, siempre busco el mirador más alto de la ciudad al atardecer",
            "Solo si no hay que hacer colas desmesuradas",
            "Prefiero miradores naturales gratuitos en colinas",
            "Tengo algo de vértigo y evito las alturas extremas"
          ]
        },
        {
          "p": "¿Cuánto tiempo consideras ideal para conocer una gran capital?",
          "ops": [
            "Entre 4 y 6 días completos para ver lo principal con calma",
            "Una escapada rápida de fin de semana (2 a 3 días)",
            "Al menos una semana entera o 10 días",
            "Más de dos semanas para empaparme de la vida local"
          ]
        }
      ]
    },
    {
      "title": "Viajes en Furgoneta Camper y Caravaning",
      "desc": "Libertad sobre ruedas, acampada libre, rutas y naturaleza.",
      "questions": [
        {
          "p": "¿Has viajado alguna vez en furgoneta camperizada o autocaravana?",
          "ops": [
            "Sí, tengo mi propia camper o he hecho viajes inolvidables",
            "He alquilado una camper un fin de semana para probar",
            "Tengo muchas ganas de hacer un viaje así con amigos o pareja",
            "Prefiero la comodidad de un hotel con cama y baño privado"
          ]
        },
        {
          "p": "¿Qué es lo que más te atrae del estilo de vida camper?",
          "ops": [
            "Despertarte cada día frente a un paisaje natural diferente",
            "La libertad de cambiar de ruta sobre la marcha sin reservas previas",
            "Viajar con tu mascota y todo tu equipaje deportivo a cuestas",
            "El contacto directo con la naturaleza y las estrellas"
          ]
        },
        {
          "p": "¿Qué te parece el aspecto más complicado de viajar en camper?",
          "ops": [
            "El espacio reducido y la gestión del agua y WC químico",
            "Encontrar sitios legales y seguros para pernoctar",
            "El consumo de combustible de un vehículo voluminoso",
            "Tener que cocinar y fregar en un espacio pequeño"
          ]
        },
        {
          "p": "¿Qué ruta camper te gustaría recorrer más?",
          "ops": [
            "La costa de Portugal y Algarve recorriendo playas salvajes",
            "La Ruta 66 en Estados Unidos o los fiordos de Noruega",
            "El norte de España (Asturias, Cantabria y País Vasco)",
            "Los Alpes suizos y puertos de montaña alpinos"
          ]
        },
        {
          "p": "¿Comprarías una camper para viajar todos los fines de semana?",
          "ops": [
            "Sí, es mi sueño de ocio a medio plazo",
            "Prefiero alquilar puntualmente para no tener gastos de mantenimiento",
            "No me compensa económicamente",
            "No es mi estilo de viaje"
          ]
        }
      ]
    },
    {
      "title": "Cruceros y Grandes Barcos de Vacaciones",
      "desc": "Camarotes con balcón, escalas, piscinas en cubierta y buffet.",
      "questions": [
        {
          "p": "¿Has realizado algún viaje en crucero turístico?",
          "ops": [
            "Sí, he hecho uno o varios cruceros y la experiencia fue genial",
            "Nunca he hecho un crucero pero me gustaría probar",
            "No me llama la atención la idea de viajar en barco grande",
            "Tengo miedo a marearme en alta mar"
          ]
        },
        {
          "p": "¿Qué destino de crucero te parece más atractivo?",
          "ops": [
            "Islas Griegas y Mediterráneo oriental",
            "Fiordos Noruegos y paisajes glaciares",
            "Islas del Caribe con escalas en playas privadas",
            "Cruceros fluviales por el Danubio o el Rin"
          ]
        },
        {
          "p": "¿Qué tipo de camarote elegirías en un crucero?",
          "ops": [
            "Camarote exterior con balcón privado para ver el mar",
            "Camarote interior por ser la opción más económica",
            "Camarote con ventana fija (ojo de buey)",
            "Suite espaciosa con mayordomo"
          ]
        },
        {
          "p": "¿Qué servicio a bordo de los cruceros te parece más llamativo?",
          "ops": [
            "Las piscinas con toboganes y jacuzzis en la cubierta alta",
            "Los espectáculos teatrales nocturnos y casinos a bordo",
            "Los buffets abiertos casi 24 horas con comida variada",
            "Poder visitar varias ciudades distintas sin deshacer la maleta"
          ]
        },
        {
          "p": "¿Prefieres hacer las excursiones organizadas del barco o por tu cuenta?",
          "ops": [
            "Bajar por libre y explorar las ciudades a mi ritmo",
            "Contratar las excursiones oficiales del barco por seguridad de horarios",
            "Excursiones con agencias locales más baratas en el puerto",
            "Quedarme en el barco disfrutando de las instalaciones vacías"
          ]
        }
      ]
    },
    {
      "title": "Idiomas, Choque Cultural y Adaptación",
      "desc": "Comunicación en el extranjero, costumbres locales y respeto.",
      "questions": [
        {
          "p": "¿Cómo te comunicas cuando viajas a un país donde no hablan tu idioma?",
          "ops": [
            "En inglés con soltura en la mayoría de situaciones",
            "Con ayuda de Google Traductor con la cámara y voz",
            "Con gestos, señas y una sonrisa universal",
            "Intento aprender de antemano palabras básicas de cortesía"
          ]
        },
        {
          "p": "¿Te gusta probar la comida callejera (Street Food) local en tus viajes?",
          "ops": [
            "Sí, es la forma más auténtica y rica de conocer un país",
            "Solo en puestos concurridos que tengan buenas valoraciones higiénicas",
            "Prefiero restaurantes cerrados con garantías sanitarias",
            "No me atrevo con la comida callejera por miedo a ponerme malo"
          ]
        },
        {
          "p": "¿Has experimentado un choque cultural muy fuerte en algún viaje?",
          "ops": [
            "Sí, en países asiáticos o de oriente medio, fue muy enriquecedor",
            "Ligeras diferencias pero me adapté con facilidad",
            "Intento informarme bien de las costumbres locales antes de ir",
            "Apenas he viajado fuera de mi entorno cultural"
          ]
        },
        {
          "p": "¿Qué haces con el cambio de moneda cuando viajas fuera de tu divisa?",
          "ops": [
            "Uso tarjetas sin comisiones de cambio (Revolut, N26)",
            "Saco efectivo en cajeros locales del destino",
            "Cambio billetes en el aeropuerto o banco antes de salir",
            "Pago todo con mi tarjeta bancaria habitual"
          ]
        },
        {
          "p": "¿Compras eSIMs digitales de datos móviles para viajar al extranjero?",
          "ops": [
            "Sí, activo una eSIM digital (Airalo, Holafly) antes de aterrizar",
            "Compro una tarjeta SIM física prepago local en el aeropuerto",
            "Solo uso el WiFi gratuito de hoteles y cafeterías",
            "Uso el roaming de mi compañía telefónica"
          ]
        }
      ]
    },
    {
      "title": "Turismo Rural y Desconexión en Pueblos",
      "desc": "Casas rurales con chimenea, gastronomía tradicional y calma.",
      "questions": [
        {
          "p": "¿Con qué frecuencia haces escapadas de turismo rural a pueblos?",
          "ops": [
            "Varias veces al año en puentes y fines de semana de otoño/invierno",
            "Al menos una vez al año para reunir a toda la familia o amigos",
            "Solo de paso en vacaciones de verano",
            "Casi nunca, soy una persona 100% urbanita"
          ]
        },
        {
          "p": "¿Qué buscas principalmente en una casa rural?",
          "ops": [
            "Chimenea de leña, barbacoa exterior y jardín privado",
            "Piscina privada para el verano y vistas a la montaña",
            "Cocina amplia y mesa grande para comidas en grupo",
            "Buena conexión a internet por si necesito trabajar"
          ]
        },
        {
          "p": "¿Comprarías una casa de pueblo para restaurar como segunda residencia?",
          "ops": [
            "Sí, me encantaría tener un refugio de paz en el campo",
            "Solo si estuviera lista para entrar a vivir sin obras complejas",
            "Prefiero alquilar para no tener ataduras ni gastos fijos",
            "No me interesa tener casa en un pueblo"
          ]
        },
        {
          "p": "¿Qué actividades disfrutas más en un entorno rural?",
          "ops": [
            "Senderismo suave por el bosque y respirar aire puro",
            "Comer en mesones tradicionales guisos y carnes asadas",
            "Hacer sobremesa larga junto a la chimenea jugando a juegos",
            "Comprar productos artesanos locales (miel, embutidos, quesos)"
          ]
        },
        {
          "p": "¿Cuánto tiempo puedes estar en un pueblo sin aburrirte?",
          "ops": [
            "Podría vivir allí permanentemente sin problemas",
            "Un fin de semana largo de 3 o 4 días es perfecto",
            "A los 2 días ya echo de menos la actividad de la ciudad",
            "Solo paso el día y vuelvo a dormir a mi casa"
          ]
        }
      ]
    },
    {
      "title": "Fotografía de Viajes y Creación de Recuerdos",
      "desc": "Cámaras réflex, fotos con smartphone, álbumes y Reels.",
      "questions": [
        {
          "p": "¿Qué cámara utilizas para hacer fotos durante tus viajes?",
          "ops": [
            "La cámara de mi smartphone de gama alta",
            "Cámara réflex o sin espejo (Mirrorless) con objetivos dedicados",
            "Cámara de acción deportiva (GoPro) para actividades",
            "Cámara analógica clásica con carrete de película"
          ]
        },
        {
          "p": "¿Sueles imprimir álbumes de fotos físicos después de un gran viaje?",
          "ops": [
            "Sí, diseño e imprimo un fotolibro de cada gran viaje",
            "Imprimo un par de fotos destacadas para enmarcar en casa",
            "Solo las guardo en carpetas en la nube o disco duro",
            "Las subo a redes sociales y no las imprimo en papel"
          ]
        },
        {
          "p": "¿Dedicas mucho tiempo a posar para la foto perfecta en lugares turísticos?",
          "ops": [
            "Hago un par de fotos rápidas del paisaje y sigo disfrutando",
            "Me gusta buscar buenos ángulos y luz para tener fotos bonitas",
            "Me agobia la gente que hace colas de 1 hora solo para un selfie",
            "Rara vez salgo en las fotos, solo fotografío el entorno"
          ]
        },
        {
          "p": "¿Compras recuerdos típicos (souvenirs) en cada ciudad que visitas?",
          "ops": [
            "Sí, imanes para la nevera de cada lugar son tradición sagrada",
            "Compro camisetas, tazas o artesanía local auténtica",
            "Compro productos gastronómicos típicos para comer en casa",
            "No suelo comprar souvenirs porque acumulan polvo"
          ]
        },
        {
          "p": "¿Llevas un diario de viaje escrito con notas de tus experiencias?",
          "ops": [
            "Sí, apunto anécdotas, restaurantes y gastos de cada día",
            "Tengo notas en el móvil con recomendaciones",
            "Solo confío en mi memoria y en las fotos tomadas",
            "No llevo registro escrito"
          ]
        }
      ]
    },
    {
      "title": "Viajes de Mochilero (Backpacking) y Hostales",
      "desc": "Mochila a la espalda, habitaciones compartidas y bajo presupuesto.",
      "questions": [
        {
          "p": "¿Has viajado alguna vez de mochilero por varios países seguidos?",
          "ops": [
            "Sí, he hecho viajes largos de mochila por el sudeste asiático o Europa",
            "He hecho rutas cortas de mochila de 1 o 2 semanas",
            "Me gustaría vivir la experiencia al menos una vez en la vida",
            "Prefiero viajar con maleta de ruedas y hoteles cómodos"
          ]
        },
        {
          "p": "¿Dormirías en una habitación compartida con literas en un hostal juvenil?",
          "ops": [
            "Sí, es genial para ahorrar y conocer a otros viajeros de todo el mundo",
            "Solo si viajo solo o con presupuesto muy ajustado",
            "Prefiero habitación privada aunque sea dentro del hostal",
            "No comparto habitación con desconocidos bajo ningún concepto"
          ]
        },
        {
          "p": "¿Qué es lo más importante en la mochila de un viajero?",
          "ops": [
            "Un buen calzado cómodo todoterreno que no haga rozaduras",
            "Cargador portátil (Powerbank) potente para no quedarse sin batería",
            "Neceser compacto con toalla de secado rápido y tapones",
            "Chubasquero ligero plegable cortavientos"
          ]
        },
        {
          "p": "¿Utilizas trenes nocturnos o autobuses largos para ahorrar noche de hotel?",
          "ops": [
            "Sí, duermes mientras avanzas y ahorras tiempo y dinero",
            "Lo he hecho pero se duerme con dificultad",
            "Prefiero viajar de día y dormir en una cama fija de noche",
            "Solo tomo vuelos rápidos"
          ]
        },
        {
          "p": "¿Qué cualidad consideras más necesaria para viajar de mochilero?",
          "ops": [
            "Capacidad de adaptación y flexibilidad ante imprevistos",
            "Sociabilidad para pedir ayuda y hacer amigos fácilmente",
            "Organización para estirar el presupuesto al máximo",
            "Paciencia infinita"
          ]
        }
      ]
    },
    {
      "title": "Turismo Temático: Parques de Atracciones y Eventos",
      "desc": "Disneyland, Universal Studios, PortAventura y montañas rusas.",
      "questions": [
        {
          "p": "¿Te gustan los parques de atracciones temáticos?",
          "ops": [
            "Me fascinan, viajo específicamente para visitar grandes parques",
            "Me encantan las montañas rusas fuertes con caídas y loopings",
            "Prefiero atracciones oscuras inmersivas y espectáculos familiares",
            "No me gustan las atracciones fuertes porque me mareo"
          ]
        },
        {
          "p": "¿Qué parque temático consideras el mejor al que has ido o sueñas ir?",
          "ops": [
            "Universal Studios (Orlando / Osaka) por las zonas de Harry Potter / Nintendo",
            "Disneyland / Disney World por la magia y ambientación perfecta",
            "PortAventura / Europa-Park por sus montañas rusas de récord",
            "Parques acuáticos gigantescos con toboganes extremos"
          ]
        },
        {
          "p": "¿Pagarías por pases rápidos (Fast Pass / Express) para evitar colas?",
          "ops": [
            "Sin duda, mi tiempo de vacaciones vale más que esperar 2 horas por atracción",
            "Solo en días de máxima afluencia en atracciones estrella",
            "Me niego a pagar suplementos extra abusivos",
            "Aprovecho las colas de Single Rider (viajero individual) para avanzar rápido"
          ]
        },
        {
          "p": "¿Qué atracción te produce más adrenalina?",
          "ops": [
            "Montaña rusa de aceleración magnética que alcanza +130 km/h en segundos",
            "Torre de caída libre de más de 80 metros de altura",
            "Atracciones con caídas verticales de más de 90 grados",
            "Simuladores inmersivos con pantallas envolventes 4D"
          ]
        },
        {
          "p": "¿Comes en los restaurantes temáticos dentro del parque?",
          "ops": [
            "Sí, para sumergirme al 100% en la experiencia temática",
            "Pido comida rápida básica dentro del parque para no perder tiempo",
            "Llevo mis propios bocadillos y snacks si el parque lo permite",
            "Salgo a comer fuera del parque"
          ]
        }
      ]
    }
  ]
},
{
  "category": "Automoción, Motores & Conducción",
  "icon": "🚗",
  "topics": [
    {
      "title": "Coches de Combustión vs Híbridos y Eléctricos",
      "desc": "Motores gasolina, diésel, híbridos autorecargables y enchufables.",
      "questions": [
        {
          "p": "¿Qué tipo de motor tiene tu coche actual o el de tu familia?",
          "ops": [
            "Motor de gasolina tradicional",
            "Motor diésel de bajo consumo para trayectos largos",
            "Motor híbrido autorrecargable (HEV) o enchufable (PHEV)",
            "Vehículo 100% eléctrico a batería (EV)"
          ]
        },
        {
          "p": "¿Si compraras un coche nuevo hoy, qué motorización elegirías?",
          "ops": [
            "Híbrido no enchufable por etiqueta ECO y practicidad sin cables",
            "Gasolina potente o deportivo con cambio manual",
            "100% Eléctrico para cargar en casa y ahorrar costes",
            "Híbrido enchufable para tener lo mejor de ambos mundos"
          ]
        },
        {
          "p": "¿Qué opinas sobre la desaparición progresiva del motor diésel?",
          "ops": [
            "Una lástima, para hacer muchos kilómetros en autopista sigue siendo imbatible",
            "Lógica por las emisiones contaminantes en ciudades",
            "Injusta porque los motores diésel modernos son muy limpios",
            "Me es indiferente"
          ]
        },
        {
          "p": "¿Tienes punto de carga en tu garaje o plaza de aparcamiento?",
          "ops": [
            "Sí, tengo cargador instalado en mi vivienda unifamiliar o garaje",
            "Tengo plaza comunitaria pero aún no he instalado cargador",
            "Aparco en la calle y dependería de cargadores públicos",
            "No tengo coche"
          ]
        },
        {
          "p": "¿Cuál es el factor más determinante al comprar un coche?",
          "ops": [
            "Fiabilidad mecánica contrastada y coste de mantenimiento bajo",
            "Diseño exterior, potencia y sensaciones al volante",
            "Seguridad activa y espacio para familia y equipaje",
            "Precio de adquisición y condiciones de financiación"
          ]
        }
      ]
    },
    {
      "title": "Cambio Manual vs Cambio Automático",
      "desc": "Palanca de cambios, doble embrague, levas y comodidad en atascos.",
      "questions": [
        {
          "p": "¿Prefieres conducir con cambio manual o cambio automático?",
          "ops": [
            "Automático siempre, la comodidad en ciudad y atascos no tiene precio",
            "Manual por el control total de las marchas y el placer de conducir",
            "Automático con levas en el volante para poder cambiar cuando quiera",
            "Me es indiferente, me adapto a cualquier coche"
          ]
        },
        {
          "p": "¿Aprendiste a conducir en un coche con cambio manual?",
          "ops": [
            "Sí, como la inmensa mayoría de conductores en mi país",
            "Aprendí directamente en un coche automático",
            "Tuve clases en manual pero en cuanto pude pasé a automático",
            "No tengo carnet de conducir"
          ]
        },
        {
          "p": "¿Consideras que el cambio automático es más seguro?",
          "ops": [
            "Sí, permite mantener las dos manos en el volante y menos distracciones",
            "Es igual de seguro, depende de la atención del conductor",
            "El manual da mejor retención con freno motor en bajadas pronunciadas",
            "No noto diferencia en seguridad"
          ]
        },
        {
          "p": "¿Has conducido coches con levas de cambio detrás del volante?",
          "ops": [
            "Sí, es divertidísimo para reducir marchas en carreteras de curvas",
            "Las he probado pero casi siempre dejo el modo D automático",
            "Mi coche no tiene levas pero me gustaría probarlas",
            "No he conducido coches con levas"
          ]
        },
        {
          "p": "¿Pagarías el sobrecoste habitual de $1,500-$2,000 por la caja automática?",
          "ops": [
            "Sin dudarlo, es el extra más rentable de cualquier coche moderno",
            "Solo si voy a usar el coche mucho en ciudad",
            "Prefiero ahorrarme ese dinero o gastarlo en otro equipamiento",
            "No pagaría por cambio automático"
          ]
        }
      ]
    },
    {
      "title": "Motos, Scooters y Libertad sobre Dos Ruedas",
      "desc": "Motos de gran cilindrada, scooters urbanos 125cc y cascos.",
      "questions": [
        {
          "p": "¿Conduces motocicleta o scooter habitualmente?",
          "ops": [
            "Sí, moto de gran cilindrada para rutas y viajes de fin de semana",
            "Scooter de 125cc o eléctrico para moverme ágil por la ciudad",
            "Tengo moto pero la uso de forma ocasional con buen tiempo",
            "No conduzco motocicletas"
          ]
        },
        {
          "p": "¿Qué ventaja consideras inigualable en una moto urbana?",
          "ops": [
            "Aparcar en la puerta de cualquier sitio sin dar vueltas",
            "Ahorro enorme de tiempo al evitar atascos de tráfico",
            "Bajo consumo de combustible y mantenimiento económico",
            "La sensación de libertad y viento"
          ]
        },
        {
          "p": "¿Qué tipo de casco utilizas para montar en moto?",
          "ops": [
            "Casco integral cerrado de fibra de carbono para máxima protección",
            "Casco modular abatible por comodidad al parar",
            "Casco jet abierto para ciudad",
            "No conduzco moto"
          ]
        },
        {
          "p": "¿Llevas siempre chaqueta con protecciones y guantes homologados?",
          "ops": [
            "Siempre, la equipación completa es el único chasis en una moto",
            "Guantes y chaqueta siempre, aunque haga calor en verano",
            "Solo casco en trayectos urbanos cortos",
            "No conduzco moto"
          ]
        },
        {
          "p": "¿Has soñado alguna vez con hacer un gran viaje en moto?",
          "ops": [
            "Sí, recorrer la Ruta 66 o los pasos alpinos en una moto Trail / Touring",
            "Una ruta por la costa con una moto clásica / Café Racer",
            "Prefiero la comodidad y seguridad de las 4 ruedas de un coche",
            "No me llaman la atención las motos"
          ]
        }
      ]
    },
    {
      "title": "Mantenimiento del Coche, ITV y Mecánica",
      "desc": "Cambios de aceite, neumáticos, revisiones periódicas y talleres.",
      "questions": [
        {
          "p": "¿Llevas el mantenimiento de tu coche al día según el libro oficial?",
          "ops": [
            "Rigurosamente cada año o kilometraje indicado",
            "Suelo pasar la revisión cuando se enciende el aviso en el cuadro",
            "Solo cambio aceite y filtros cuando me acuerdo",
            "No tengo coche propio"
          ]
        },
        {
          "p": "¿Dónde prefieres llevar tu coche a reparar o mantener?",
          "ops": [
            "A mi taller mecánico de confianza de barrio",
            "Al concesionario oficial de la marca aunque sea más caro",
            "Hago yo mismo tareas sencillas (bombillas, filtros, batería)",
            "A grandes cadenas de mecánica rápida"
          ]
        },
        {
          "p": "¿Con qué frecuencia revisas la presión de los neumáticos?",
          "ops": [
            "Al menos una vez al mes o antes de cada viaje largo",
            "Solo cuando paso la revisión anual en el taller",
            "Solo si veo un neumático visiblemente bajo de aire",
            "Casi nunca reviso la presión"
          ]
        },
        {
          "p": "¿Te genera nerviosismo pasar la Inspección Técnica de Vehículos (ITV)?",
          "ops": [
            "Ninguno, llevo el coche impecable y pasa a la primera",
            "Un poco de incertidumbre por si encuentran algún defecto menor",
            "Bastante, temo que me pongan falta grave y tener que volver",
            "No me ha tocado pasarla todavía"
          ]
        },
        {
          "p": "¿Sabrías cambiar una rueda pinchada por la de repuesto en carretera?",
          "ops": [
            "Sí, sé colocar el gato y aflojar los tornillos con soltura",
            "Conozco la teoría pero prefiero llamar a la grúa del seguro",
            "Nunca lo he hecho y me daría miedo hacerlo en carretera",
            "Mi coche lleva kit antipinchazos con compresor en vez de rueda"
          ]
        }
      ]
    },
    {
      "title": "Fórmula 1 y Automovilismo Deportivo",
      "desc": "Grandes Premios, Ferrari, Red Bull, Fernando Alonso y adelantamientos.",
      "questions": [
        {
          "p": "¿Sigues las carreras de Fórmula 1 los fines de semana?",
          "ops": [
            "Sí, veo clasificación el sábado y carrera el domingo religiosamente",
            "Solo las carreras más espectaculares (Mónaco, Silverstone, Spa)",
            "Miro los resúmenes de adelantamientos y polémicas en YouTube",
            "No sigo la Fórmula 1"
          ]
        },
        {
          "p": "¿Cuál es tu piloto o escudería favorita en la parrilla?",
          "ops": [
            "Fernando Alonso / Aston Martin",
            "Ferrari (Scuderia Ferrari)",
            "Max Verstappen / Red Bull Racing",
            "Lewis Hamilton / Mercedes"
          ]
        },
        {
          "p": "¿Has asistido a un circuito a ver un Gran Premio de F1 o MotoGP en directo?",
          "ops": [
            "Sí, el sonido de los motores en vivo y el ambiente es sobrecogedor",
            "Me encantaría ir al menos una vez en la vida",
            "Prefiero verlo por televisión con comentarios técnicos y repeticiones",
            "No me interesa el automovilismo"
          ]
        },
        {
          "p": "¿Qué circuito del calendario de F1 te parece el más legendario?",
          "ops": [
            "Spa-Francorchamps en Bélgica con la subida de Eau Rouge",
            "Monza en Italia por la velocidad pura del Templo de la Velocidad",
            "Mónaco por el glamour y la precisión milimétrica entre muros",
            "Suzuka en Japón por sus curvas enlazadas en S"
          ]
        },
        {
          "p": "¿Te gustan los simuladores de conducción con volante y pedales (Simracing)?",
          "ops": [
            "Sí, tengo volante Force Feedback y juego a Assetto Corsa / iRacing / F1",
            "He probado volantes de amigos y me parece súper inmersivo",
            "Prefiero jugar a juegos de carreras con mando tradicional",
            "No juego a títulos de carreras"
          ]
        }
      ]
    },
    {
      "title": "Carsharing, Alquiler de Vehículos y Viajes Compartidos",
      "desc": "BlaBlaCar, alquiler vacacional, Zity y no tener coche propio.",
      "questions": [
        {
          "p": "¿Has utilizado plataformas de viajes compartidos como BlaBlaCar?",
          "ops": [
            "Sí, como conductor o pasajero con frecuencia para ahorrar en viajes",
            "Lo he usado en alguna ocasión puntual de urgencia",
            "Conozco el servicio pero prefiero viajar en tren, bus o coche propio",
            "Nunca he compartido coche con desconocidos"
          ]
        },
        {
          "p": "¿Utilizas servicios de carsharing por minutos en tu ciudad?",
          "ops": [
            "Sí, es comodísimo para trayectos urbanos sin preocuparse de aparcar",
            "Ocasionalmente si necesito mover bultos grandes",
            "Prefiero transporte público o mi propio vehículo",
            "En mi ciudad no hay servicios de carsharing"
          ]
        },
        {
          "p": "¿Crees que en el futuro las nuevas generaciones dejarán de comprar coche propio?",
          "ops": [
            "Sí, en grandes ciudades saldrá más a cuenta pagar por uso",
            "En ciudades sí, pero en zonas rurales o pueblos el coche es imprescindible",
            "La gente siempre querrá tener su propio coche por independencia",
            "Dependerá de los costes de adquisición y combustible"
          ]
        },
        {
          "p": "¿Qué seguro contratas al alquilar un coche de vacaciones?",
          "ops": [
            "Siempre seguro a todo riesgo sin franquicia para viajar con tranquilidad total",
            "El seguro básico que viene incluido para pagar lo mínimo",
            "Uso el seguro de cobertura que ofrece mi tarjeta de crédito",
            "Rara vez alquilo coches"
          ]
        },
        {
          "p": "¿Te gustaría que existieran taxis y transportes 100% autónomos sin conductor?",
          "ops": [
            "Sí, el futuro de la conducción autónoma será más seguro y barato",
            "Me daría cierta desconfianza subirme a un coche sin volante ni chófer",
            "Prefiero la conducción humana",
            "Creo que aún faltan muchos años para que sea una realidad común"
          ]
        }
      ]
    },
    {
      "title": "Estética del Coche, Detailing y Limpieza",
      "desc": "Lavado a mano, ceras cerámicas, túneles de lavado y ambientadores.",
      "questions": [
        {
          "p": "¿Cómo lavas habitualmente tu coche por fuera?",
          "ops": [
            "A mano con dos cubos, champú especial y toallas de microfibra (Detailing)",
            "En cabinas de lavado a presión con lanza de agua caliente",
            "En túneles de lavado automáticos de rodillos por rapidez",
            "Casi nunca lavo el coche por fuera, espero a que llueva"
          ]
        },
        {
          "p": "¿Con qué frecuencia limpias el interior del habitáculo?",
          "ops": [
            "Cada semana aspiro alfombrillas y limpio salpicadero a fondo",
            "Una vez al mes o cada mes y medio",
            "Solo cuando está visiblemente sucio o voy a llevar invitados",
            "Casi nunca limpio el interior"
          ]
        },
        {
          "p": "¿Utilizas ambientador dentro del vehículo?",
          "ops": [
            "Sí, ambientadores de clip de rejilla o botellita con fragancia agradable",
            "Prefiero el olor a limpio natural sin ambientadores químicos",
            "Solo pongo ambientador de pino clásico de vez en cuando",
            "No me gustan los olores artificiales en el coche"
          ]
        },
        {
          "p": "¿Permites que se coma o se fume dentro de tu coche?",
          "ops": [
            "Prohibido comer o fumar categricamente, el coche se mantiene impoluto",
            "Comer snacks sencillos sí, pero nada que manche o huela fuerte",
            "Se permite comer pero no fumar",
            "No tengo reglas estrictas dentro del vehículo"
          ]
        },
        {
          "p": "¿Aplicas tratamientos de cera o sellado cerámico a la pintura?",
          "ops": [
            "Sí, aplico cera o recubrimiento cerámico para proteger el brillo",
            "Solo la cera que echa la lanza del lavadero",
            "No le aplico productos de protección a la chapa",
            "No me fijo en el estado del brillo de la pintura"
          ]
        }
      ]
    },
    {
      "title": "Seguridad Vial, Radares y Asistentes de Conducción (ADAS)",
      "desc": "Control de crucero adaptativo, frenada de emergencia y límites.",
      "questions": [
        {
          "p": "¿Qué asistente de conducción consideras más útil en autopista?",
          "ops": [
            "Control de crucero adaptativo que mantiene la distancia automáticamente",
            "Asistente de mantenimiento en el centro del carril",
            "Detector de ángulo muerto en los espejos retrovisores",
            "Cámara de visión 360 grados y sensores para aparcar"
          ]
        },
        {
          "p": "¿Utilizas aplicaciones que avisan de la presencia de radares (Waze, Coyote)?",
          "ops": [
            "Siempre activada en segundo plano para evitar multas por despiste",
            "Solo en viajes largos por carreteras que no conozco",
            "No, suelo respetar estrictamente las señales de velocidad",
            "No utilizo avisadores de radar"
          ]
        },
        {
          "p": "¿Qué te parecen los sistemas que frenan automáticamente ante un peatón u obstáculo?",
          "ops": [
            "Una bendición tecnológica que salva miles de vidas al año",
            "Muy útiles aunque a veces dan falsas alarmas que asustan",
            "Prefiero mantener el control manual de los pedales",
            "No he probado coches con frenada de emergencia autónoma"
          ]
        },
        {
          "p": "¿Alguna vez te ha saltado un radar de velocidad en carretera?",
          "ops": [
            "Sí, alguna multa por despiste de 5 o 10 km/h por encima del límite",
            "Afortunadamente nunca me han multado por velocidad",
            "Hace muchos años",
            "No tengo carnet de conducir"
          ]
        },
        {
          "p": "¿Qué opinas sobre reducir los límites de velocidad en ciudades a 30 km/h?",
          "ops": [
            "Adecuado para proteger a peatones, ciclistas y reducir atropellos",
            "Excesivamente lento en avenidas anchas donde genera congestión",
            "Solo debería aplicarse en calles residenciales y entornos escolares",
            "Me parece una medida recaudatoria"
          ]
        }
      ]
    },
    {
      "title": "Sonido y Conectividad en el Coche: CarPlay y Android Auto",
      "desc": "Pantallas táctiles, Bluetooth, navegación por satélite y altavoces.",
      "questions": [
        {
          "p": "¿Utilizas Apple CarPlay o Android Auto en tu vehículo?",
          "ops": [
            "Sí, inalámbrico o por cable, es imprescindible para mapas y música",
            "Uso solo conexión Bluetooth básica para reproducir audio",
            "Tengo soporte para el móvil en la rejilla y miro la pantalla del teléfono",
            "La radio clásica FM/AM de toda la vida"
          ]
        },
        {
          "p": "¿Qué prefieres: mandos físicos tradicionales o pantallas táctiles para el climatizador?",
          "ops": [
            "Botones y ruletas físicas para cambiar la temperatura sin apartar la vista",
            "Pantalla táctil moderna de gran formato con diseño minimalista",
            "Combinación equilibrada de ambos",
            "Control por voz del asistente"
          ]
        },
        {
          "p": "¿Qué sueles escuchar habitualmente mientras conduces?",
          "ops": [
            "Playlists de música energética en Spotify / Apple Music",
            "Podcasts de entrevistas o tertulias para aprender",
            "Programas de radio generalista o deportiva",
            "Prefiero el silencio del motor para pensar"
          ]
        },
        {
          "p": "¿Qué importancia le das a la calidad del equipo de sonido de un coche?",
          "ops": [
            "Mucha, si puedo elijo equipos firmados de calidad (Bose, Harman Kardon, etc.)",
            "Con que suene nítido a volumen medio me basta",
            "Casi no noto la diferencia con altavoces de serie básicos",
            "No escucho música a menudo en el coche"
          ]
        },
        {
          "p": "¿Cargas el móvil en el coche por cable o con base de carga inalámbrica?",
          "ops": [
            "Por cable rápido USB-C directo a la toma de corriente",
            "En la bandeja de carga inalámbrica integrada por inducción",
            "Con un adaptador de mechero de 12V",
            "No suelo cargarlo en el coche"
          ]
        }
      ]
    },
    {
      "title": "Coches Clásicos, Concentraciones y Cultura del Motor",
      "desc": "Youngtimers de los 90, coches vintage, ferias y restauración.",
      "questions": [
        {
          "p": "¿Te atraen los coches clásicos o deportivos de los años 80 y 90 (Youngtimers)?",
          "ops": [
            "Me apasionan, tenían mucha más personalidad mecánica y alma que los actuales",
            "Me gusta verlos en exhibiciones aunque prefiero la seguridad moderna",
            "Solo los superdeportivos clásicos legendarios (Ferrari F40, Porsche 911)",
            "Prefiero los coches modernos tecnológicos"
          ]
        },
        {
          "p": "¿Has asistido a concentraciones de coches o quedadas del motor?",
          "ops": [
            "Sí, asisto a quedadas (Cars & Coffee, etc.) con frecuencia",
            "He ido a salones del automóvil o ferias de clásicos",
            "Miro vídeos en YouTube de eventos del motor",
            "No me interesan las concentraciones de coches"
          ]
        },
        {
          "p": "¿Te gustaría tener un coche histórico guardado en el garaje para pasear los domingos?",
          "ops": [
            "Sí, es uno de mis sueños dorados como aficionado al motor",
            "Si tuviera presupuesto de sobra y espacio propio sí",
            "Me daría pereza el mantenimiento y encontrar piezas de recambio",
            "No me llama la atención tener vehículos antiguos"
          ]
        },
        {
          "p": "¿Qué sonido de motor te parece el más emocionante?",
          "ops": [
            "El aullido agudo de un motor V10 o V12 atmosférico a altas revoluciones",
            "El rugido bronco y grave de un motor V8 americano clásico",
            "El petardeo deportivo y turbo de un 4 cilindros rabioso (GTI, etc.)",
            "El silencio absoluto y aceleración instantánea de los motores eléctricos"
          ]
        },
        {
          "p": "¿Qué modelo de coche consideras el más icónico de la historia?",
          "ops": [
            "Porsche 911 con su silueta inconfundible durante 60 años",
            "Ford Mustang clásico de 1967",
            "Volkswagen Escarabajo / Golf GTI Mk1",
            "Ferrari 250 GTO"
          ]
        }
      ]
    }
  ]
}
];

// Generar las 100 encuestas estructuradas
const allSurveys = [];
let surveyIndex = 1;

categoriesData.forEach(catGroup => {
  catGroup.topics.forEach(topic => {
    const idFormatted = String(surveyIndex).padStart(3, '0');
    const surveyObj = {
      id: `enc_${idFormatted}`,
      numero: surveyIndex,
      titulo: topic.title,
      categoria: catGroup.category,
      categoria_icono: catGroup.icon,
      descripcion: topic.desc,
      recompensa_diamantes: 50, // 50 💎 (= 5 USDT)
      duracion_estimada: '2 min',
      total_preguntas: 5,
      preguntas: topic.questions.map((q, qIdx) => ({
        id: `p${qIdx + 1}`,
        numero: qIdx + 1,
        pregunta: q.p,
        opciones: q.ops.map((op, opIdx) => ({
          letra: String.fromCharCode(65 + opIdx), // A, B, C, D
          texto: op
        }))
      }))
    };

    allSurveys.push(surveyObj);

    // Guardar archivo individual de la encuesta
    const singlePath = path.join(__dirname, `encuesta_${idFormatted}.json`);
    fs.writeFileSync(singlePath, JSON.stringify(surveyObj, null, 2), 'utf-8');

    surveyIndex++;
  });
});

// Guardar colección completa consolidada en encuestas.json
const fullPath = path.join(__dirname, 'encuestas.json');
fs.writeFileSync(fullPath, JSON.stringify(allSurveys, null, 2), 'utf-8');

// También generar un archivo JS para importación directa en Frontend
const jsExportPath = path.join(__dirname, 'encuestas_data.js');
const jsContent = `// Catálogo Oficial de 100 Encuestas PANDA CASH
// Cada encuesta contiene 5 preguntas estructuradas con 4 opciones.
window.PANDA_ENCUESTAS_DATA = ${JSON.stringify(allSurveys, null, 2)};
`;
fs.writeFileSync(jsExportPath, jsContent, 'utf-8');

console.log(`✅ ¡Se generaron con éxito ${allSurveys.length} encuestas completas en: ${__dirname}!`);
console.log(`   - Archivos individuales: encuesta_001.json a encuesta_100.json`);
console.log(`   - Archivo consolidado: encuestas.json`);
console.log(`   - Archivo web JS: encuestas_data.js`);

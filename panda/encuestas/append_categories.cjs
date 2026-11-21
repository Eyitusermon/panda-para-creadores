const fs = require('fs');

const extraCategories = [
  {
    category: 'Gastronomía & Restaurantes',
    icon: '🍕',
    topics: [
      {
        title: 'Comida Rápida y Cadenas de Hamburguesas',
        desc: 'McDonalds, Burger King, Five Guys y smash burgers.',
        questions: [
          { p: '¿Qué cadena de comida rápida prefieres para una hamburguesa?', ops: ['McDonalds por las patatas y hamburguesas clásicas', 'Burger King por el sabor a la parrilla', 'Cadenas de Smash Burgers gourmet', 'Wendy / Carl Jr / Five Guys'] },
          { p: '¿Prefieres hamburguesa clásica gruesa o smash burger crujiente?', ops: ['Smash burger fina con bordes caramelizados', 'Hamburguesa gruesa al punto jugosa', 'Hamburguesa de pollo frito crujiente', 'Hamburguesa vegetal / vegetariana'] },
          { p: '¿Qué salsa es imprescindible en tus patatas fritas?', ops: ['Ketchup clásico de tomate', 'Mayonesa o alioli cremoso', 'Salsa barbacoa ahumada (BBQ)', 'Salsa de queso cheddar fundido'] },
          { p: '¿Pides por el autoservicio (Auto-King / McAuto) o en sala?', ops: ['Por el autoservicio desde el coche para llevar', 'En los quioscos táctiles de la sala para comer allí', 'Pido a domicilio por aplicación', 'Para llevar en mostrador'] },
          { p: '¿Pruebas las ediciones especiales y promociones temporales?', ops: ['Sí, siempre pruebo la hamburguesa especial de temporada', 'Solo si tiene ingredientes que me llamen mucho', 'Prefiero pedir siempre mi menú favorito de siempre', 'Rara vez me fijo en las promociones'] }
        ]
      },
      {
        title: 'Pizzas: Masa, Ingredientes y Tradición',
        desc: 'Pizza napolitana, masa fina, bordes rellenos y pepperoni.',
        questions: [
          { p: '¿Qué estilo de masa de pizza te gusta más?', ops: ['Masa napolitana fina con borde inflado y alveolado', 'Masa fina y crujiente estilo romana', 'Masa gruesa y esponjosa estilo Chicago / Deep Dish', 'Masa con borde relleno de queso'] },
          { p: '¿Cuál es tu pizza favorita de todos los tiempos?', ops: ['Pepperoni clásico con mozzarella y orégano', 'Pizza Barbacoa con carne picada y bacon', 'Cuatro Quesos (Quattro Formaggi) cremosa', 'Margarita tradicional con albahaca fresca'] },
          { p: '¿Piña en la pizza (Pizza Hawaiana): a favor o en contra?', ops: ['Totalmente a favor, el contraste dulce-salado es genial', 'En contra, la fruta caliente no pertenece a la pizza', 'Me da igual, la como si la ponen pero no la pido', 'Nunca la he probado'] },
          { p: '¿Comes la pizza con las manos o con cubiertos?', ops: ['Siempre con las manos doblando la porción', 'Con cuchillo y tenedor para no mancharme', 'Empiezo con cubiertos y termino con las manos', 'Depende de si estoy en casa o en un restaurante elegante'] },
          { p: '¿Te comes los bordes de la pizza o los dejas en el plato?', ops: ['Me los como siempre, especialmente con salsa o aceite picante', 'Solo si la masa está tierna y recién horneada', 'Suelo dejar los bordes para no llenarme tanto', 'Solo si vienen rellenos de queso'] }
        ]
      },
      {
        title: 'Sushi y Cocina Japonesa',
        desc: 'Nigiris, makis, salmón, atún rojo y restaurantes buffet libre.',
        questions: [
          { p: '¿Con qué frecuencia comes sushi o comida japonesa?', ops: ['Al menos 2 o 3 veces al mes', 'Una vez al mes como premio especial', 'Solo en ocasiones muy puntuales con amigos', 'No me gusta el pescado crudo ni el sushi'] },
          { p: '¿Qué tipo de pieza de sushi es tu favorita?', ops: ['Nigiris de salmón flameado con salsas', 'Makis y rolls tempurizados crujientes', 'Sashimi puro de atún rojo o salmón fresco', 'Gunkans o temakis especiales'] },
          { p: '¿Sabes comer con palillos japoneses con soltura?', ops: ['Sí, los domino perfectamente sin esfuerzo', 'Me defiendo bien aunque a veces se me resbala alguna pieza', 'Pido adaptador o tenedor cuando puedo', 'Como las piezas de sushi con las manos como en Japón tradicional'] },
          { p: '¿Le pones wasabi y jengibre al sushi?', ops: ['Disuelvo wasabi en la soja para darle toque picante', 'Me encanta el jengibre encurtido entre pieza y pieza', 'Solo salsa de soja suave sin wasabi', 'Prefiero salsas dulces como teriyaki o anguila'] },
          { p: '¿Prefieres restaurantes buffet a la carta con tablet o restaurante tradicional?', ops: ['Buffet a la carta con pedidos infinitos por tablet', 'Restaurante tradicional con menú degustación cuidado', 'Locales de cinta giratoria (Kaitenzushi)', 'Pido bandejas de sushi para comer en casa'] }
        ]
      },
      {
        title: 'Tacos, Comida Mexicana y Especias',
        desc: 'Tacos al pastor, birria, guacamole casero y salsas picantes.',
        questions: [
          { p: '¿Cuál es tu platillo mexicano favorito?', ops: ['Tacos al pastor con piña y cilantro', 'Tacos de birria con queso y consomé para dipear', 'Burritos grandes y quesadillas', 'Nachos con guacamole, queso fundido y frijoles'] },
          { p: '¿Qué tolerancia tienes al picante en las comidas?', ops: ['Alta, me encantan las salsas muy picantes (Habanero, Jalapeño)', 'Media, disfruto el picante suave que realce el sabor', 'Baja, el picante fuerte me arruina la comida', 'Cero, no tolero el picante en absoluto'] },
          { p: '¿Prefieres tortillas de maíz o tortillas de trigo?', ops: ['Tortillas de maíz nixtamalizado tradicionales', 'Tortillas de harina de trigo suaves', 'Totopos crujientes de maíz', 'Me gustan ambas por igual'] },
          { p: '¿Cómo prefieres el guacamole?', ops: ['Casero en molcajete con trozos de aguacate, tomate, cebolla y lima', 'Totalmente triturado y cremoso sin grumos', 'Con toque de cilantro y chile jalapeño picado', 'Comprado ya preparado en tarrina por rapidez'] },
          { p: '¿Qué bebida acompaña mejor a una buena comida mexicana?', ops: ['Cerveza mexicana bien fría con lima (Corona, Modelo)', 'Margarita con sal en el borde', 'Aguas frescas naturales (Horchata, Jamaica)', 'Refrescos clásicos de cola'] }
        ]
      },
      {
        title: 'Postres, Helados y Dulces',
        desc: 'Tarta de queso, chocolate, heladerías artesanales y tiramisú.',
        questions: [
          { p: '¿Pides postre habitualmente cuando sales a comer a un restaurante?', ops: ['Siempre, dejo hueco obligatorio para el dulce', 'Solo si la carta tiene tarta de queso fluida o chocolate', 'Solo para compartir entre varios comensales', 'Casi nunca pido postre, prefiero terminar con café'] },
          { p: '¿Cuál es tu sabor de helado predilecto?', ops: ['Pistacho cremoso o avellana tostada', 'Chocolate negro intenso o con cookies', 'Vainilla Bourbon o dulce de leche', 'Sabores frutales refrescantes (Limón, mango, fresa)'] },
          { p: '¿Prefieres el helado en tarrina o en cucurucho de barquillo?', ops: ['Cucurucho de galleta crujiente siempre', 'En tarrina con cuchara para no gotear', 'En tarrina con galleta encima', 'En copa grande con nata y sirope'] },
          { p: '¿Qué tarta te parece la reina de la repostería?', ops: ['Tarta de queso horneada cremosa estilo Donostia', 'Tarta de chocolate con capas y trufa', 'Tarta de zanahoria (Carrot cake) con frosting de queso', 'Tiramisú italiano tradicional con mascarpone'] },
          { p: '¿Eres más de chocolate negro puro, con leche o blanco?', ops: ['Chocolate negro (+70% de cacao) intenso', 'Chocolate con leche dulce y cremoso', 'Chocolate blanco mantecoso', 'Cualquiera mientras lleve avellanas o almendras'] }
        ]
      },
      {
        title: 'Tapas, Raciones y Gastronomía Española',
        desc: 'Tortilla de patatas, jamón ibérico, croquetas y bravas.',
        questions: [
          { p: '¿Tortilla de patatas: con cebolla o sin cebolla?', ops: ['Con cebolla siempre, le da jugosidad y dulzor', 'Sin cebolla, solo patata, huevo y sal', 'Me como cualquiera mientras esté poco cuajada', 'Prefiero la tortilla muy cuajada y firme'] },
          { p: '¿Cómo te gusta la tortilla de patatas por dentro?', ops: ['Muy jugosa y líquida (estilo Betanzos)', 'En su punto medio cremoso pero que no se desparrame', 'Bien cuajada y compacta para cortar en dados', 'Rellena de jamón y queso'] },
          { p: '¿Cuál es tu ración imprescindible de tapas con amigos?', ops: ['Croquetas cremosas caseras (de jamón o boletus)', 'Patatas bravas con salsa picante auténtica', 'Jamón ibérico de bellota con pan con tomate', 'Calamares a la romana o rabas'] },
          { p: '¿Qué bebida pides habitualmente para el aperitivo?', ops: ['Cerveza caña bien tirada con espuma', 'Vermut rojo con hielo y rodaja de naranja', 'Vino tinto o blanco fresco', 'Refresco o agua con gas'] },
          { p: '¿Prefieres el tapeo de pie de barra en barra o mesa sentado?', ops: ['Ir de bar en bar probando la tapa estrella de cada uno', 'Sentados tranquilamente en terraza al sol', 'Mesa en salón interior con sobremesa larga', 'Cualquiera mientras haya buen ambiente y comida rica'] }
        ]
      },
      {
        title: 'Desayunos y Brunches de Fin de Semana',
        desc: 'Huevos benedict, tostadas de aguacate, tortitas y zumo.',
        questions: [
          { p: '¿Qué sueles desayunar habitualmente entre semana?', ops: ['Café solo o con leche y nada más (desayuno rápido)', 'Tostada con aceite de oliva virgen extra y tomate / pavo', 'Cereales, avena o yogur con frutos secos', 'Huevos revueltos o tortilla con fruta'] },
          { p: '¿Te gustan los brunches de fin de semana?', ops: ['Me encantan, es mi plan favorito de sábado o domingo', 'He ido en algunas ocasiones y se come de lujo', 'Me parece una moda cara para lo que sirven', 'Prefiero el almuerzo tradicional a mediodía'] },
          { p: '¿Prefieres desayuno dulce o desayuno salado?', ops: ['Salado (tostadas, huevos, queso, jamón)', 'Dulce (croissants, tortitas, gofres con sirope)', 'Combinación de ambos (primero salado y luego dulce)', 'Solo líquidos (café, té o zumo)'] },
          { p: '¿Qué plato de brunch no puede faltar en tu mesa?', ops: ['Huevos Benedictine con salsa holandesa sobre pan brioche', 'Tostada de pan de masa madre con aguacate y huevo poché', 'Pancakes esponjosos con sirope de arce y frutos rojos', 'Açai bowl frío con granola crujiente'] },
          { p: '¿Zumo de naranja recién exprimido o zumo envasado?', ops: ['Exprimido natural en el momento, no hay comparación', 'Zumo envasado 100% fruta refrigerado por rapidez', 'Prefiero batidos verdes (smoothies) de frutas y verduras', 'No suelo tomar zumos en el desayuno'] }
        ]
      },
      {
        title: 'Barbacoas, Asados y Carnes a la Brasa',
        desc: 'Chuletones, costillares BBQ, carbón y parrilladas familiares.',
        questions: [
          { p: '¿Cuál es tu punto favorito de cocción de la carne roja?', ops: ['Poco hecho (sangrante y muy tierno)', 'Al punto (rosado en el centro y sellado por fuera)', 'Al punto más (casi hecho pero jugoso)', 'Muy hecho (bien cocido sin zonas rojas)'] },
          { p: '¿Prefieres barbacoa de carbón tradicional o de gas?', ops: ['De carbón o leña por el inconfundible aroma a humo', 'De gas por rapidez de encendido y limpieza fácil', 'Parrilla eléctrica o plancha en cocina', 'Cualquiera mientras la carne sea de calidad'] },
          { p: '¿Qué corte de carne disfrutas más en un asado?', ops: ['Chuletón madurado / Ribeye grueso', 'Costillas de cerdo marinadas en salsa barbacoa', 'Chorizo criollo, morcilla y panceta crujiente', 'Picaña o entraña a fuego lento'] },
          { p: '¿Sueles ser el encargado de la parrilla en reuniones con amigos?', ops: ['Sí, soy el maestro asador oficial de mi grupo', 'Ayudo con el fuego y los platos', 'Prefiero ocuparme de las ensaladas, bebidas o postre', 'Solo me siento a disfrutar de la comida lista'] },
          { p: '¿Qué guarnición no puede faltar con un buen asado?', ops: ['Patatas asadas en papel de aluminio con mantequilla', 'Ensalada fresca mixta para desengrasar', 'Pimientos asados a la brasa', 'Pan rústico crujiente con chimichurri'] }
        ]
      },
      {
        title: 'Cervezas Artesanales e Industriales',
        desc: 'IPAs aromáticas, lagers rubias, cervezas tostadas y catas.',
        questions: [
          { p: '¿Qué tipo de cerveza prefieres habitualmente?', ops: ['Lager rubia tradicional ligera y muy fría', 'IPA (India Pale Ale) aromática y lupulada', 'Cerveza tostada o de trigo (tipo belga / alemana)', 'Stout o cerveza negra con notas de café y cacao'] },
          { p: '¿Consumes cerveza artesanal (Craft Beer)?', ops: ['Sí, busco marcas locales y nuevos lotes en latas de diseño', 'Me gusta probarlas cuando voy a cervecerías especializadas', 'Prefiero las marcas comerciales de toda la vida', 'No tomo cerveza'] },
          { p: '¿Bebes la cerveza directamente del botellín o en vaso de cristal?', ops: ['En copa o vaso de cristal fino bien tirada', 'Directamente del botellín bien frío', 'En jarra congelada en verano', 'En lata directamente'] },
          { p: '¿Qué opinas de la cerveza 0,0% sin alcohol?', ops: ['Han mejorado muchísimo y son una gran opción para cuidarse', 'Las tomo cuando tengo que conducir', 'Prefiero tomar agua antes que cerveza sin alcohol', 'No tomo cerveza'] },
          { p: '¿Cuál es el mejor momento para una cerveza bien fría?', ops: ['Al salir de trabajar con compañeros (Afterwork)', 'El fin de semana al mediodía con el aperitivo al sol', 'Viendo un partido de fútbol emocionante', 'Por la noche cenando con amigos'] }
        ]
      },
      {
        title: 'Vino, Enología y Bodegas',
        desc: 'Tintos crianza, blancos frescos, uvas y catas de vino.',
        questions: [
          { p: '¿Qué tipo de vino sueles pedir con más frecuencia?', ops: ['Vino tinto con cuerpo (Ribera del Duero, Rioja, Malbec)', 'Vino blanco fresco y afrutado (Albariño, Rueda, Verdejo)', 'Vino rosado o espumoso (Cava, Champagne, Prosecco)', 'No suelo beber vino'] },
          { p: '¿Con qué frecuencia tomas una copa de vino?', ops: ['En comidas o cenas de fin de semana con buena comida', 'Casi a diario con la comida principal', 'Solo en celebraciones especiales o brindis', 'Muy rara vez'] },
          { p: '¿Has visitado alguna vez una bodega con cata guiada de vinos?', ops: ['Sí, he hecho enoturismo y me pareció una experiencia genial', 'Me gustaría visitar alguna bodega próximamente', 'Solo he asistido a catas en restaurantes o eventos', 'No he visitado bodegas'] },
          { p: '¿Cuánto sueles gastar en una botella de vino para casa?', ops: ['Entre $5 y $10 USD para consumo habitual', 'Entre $10 y $20 USD para una cena especial', 'Más de $25 USD buscando añadas o bodegas de autor', 'Casi nunca compro botellas de vino'] },
          { p: '¿Te fijas en la Denominación de Origen al elegir un vino en el supermercado?', ops: ['Siempre, tengo mis regiones y variedades de uva favoritas', 'Miro el diseño de la etiqueta y el rango de precio', 'Pido consejo a amigos o dependientes de la tienda', 'Cojo la botella que esté en oferta'] }
        ]
      }
    ]
  },
  {
    category: 'Viajes, Destinos & Turismo',
    icon: '✈️',
    topics: [
      {
        title: 'Aerolíneas de Bajo Coste vs Aerolíneas Tradicionales',
        desc: 'Ryanair, equipaje de mano, embarque prioritario y vuelos.',
        questions: [
          { p: '¿Sueles viajar con aerolíneas Low Cost (Ryanair, Vueling, EasyJet)?', ops: ['Sí, casi siempre para encontrar los billetes más baratos', 'Solo para vuelos cortos de menos de 2 horas', 'Prefiero aerolíneas tradicionales con más servicios incluidos', 'Evito las low cost por la incomodidad y políticas de maletas'] },
          { p: '¿Pagas por añadir equipaje de mano en cabina o viajas solo con mochila?', ops: ['Viajo solo con una mochila bajo el asiento para no pagar extras', 'Pago siempre por la maleta de cabina de 10 kg', 'Facturo maleta grande en bodega para llevar todo cómodo', 'Depende de la duración del viaje'] },
          { p: '¿Pagas por elegir asiento en el avión?', ops: ['No, dejo que el sistema me asigne asiento aleatorio gratis', 'Pago para asegurar ventanilla o salida de emergencia', 'Solo si viajo acompañado para ir sentados juntos', 'Solo en vuelos intercontinentales largos'] },
          { p: '¿Qué es lo que más te molesta en un aeropuerto?', ops: ['Las colas interminables en los controles de seguridad', 'Los retrasos imprevistos y cancelaciones de vuelos', 'Los precios desorbitados del agua y comida en terminales', 'La gente que se agolpa en la puerta antes de su turno de embarque'] },
          { p: '¿Con cuánta antelación llegas al aeropuerto antes del despegue?', ops: ['Con 2 horas para vuelos nacionales / europeos', 'Con más de 3 horas para vuelos internacionales largos', 'Con el tiempo justo (1 hora o menos si llevo solo mochila)', 'Siempre con margen holgado para no estresarme'] }
        ]
      },
      {
        title: 'Destinos de Playa: Caribe vs Mediterráneo',
        desc: 'Aguas cristalinas, resorts todo incluido, calas y verano.',
        questions: [
          { p: '¿Qué tipo de destino de playa prefieres para relajarte?', ops: ['Resorts todo incluido en el Caribe (Cancún, Punta Cana)', 'Calas vírgenes de aguas turquesas en el Mediterráneo (Baleares, Grecia)', 'Playas de arena dorada con olas para hacer surf', 'Playas tranquilas familiares de fácil acceso'] },
          { p: '¿Te gusta pasar todo el día tumbado en la hamaca al sol?', ops: ['Sí, desconexión total con libro, bebida y siesta', 'Un par de horas al sol y luego prefiero bañarme o pasear', 'Prefiero hacer actividades acuáticas (snorkel, kayak, moto de agua)', 'No aguanto mucho tiempo al sol, busco la sombra'] },
          { p: '¿Has estado en un hotel con régimen de Todo Incluido (All Inclusive)?', ops: ['Sí, me encanta la comodidad de comer y beber sin pensar en gastos', 'He estado pero prefiero salir a explorar restaurantes locales', 'Me gustaría probar la experiencia algún día', 'Prefiero apartamentos para cocinar mi propia comida'] },
          { p: '¿Qué protector solar utilizas en la playa?', ops: ['Factor de protección muy alto SPF 50+ siempre', 'Factor SPF 30 resistente al agua', 'Aceite bronceador para coger color rápido', 'Rara vez me aplico protector solar'] },
          { p: '¿Prefieres bañarte en el mar o en la piscina del hotel?', ops: ['En el mar, el agua salada y la naturaleza no tienen rival', 'En la piscina del hotel con hamacas cómodas sin arena', 'Alterno entre ambas a lo largo del día', 'Casi no me baño, voy por la brisa y las vistas'] }
        ]
      },
      {
        title: 'Turismo en Grandes Capitales del Mundo',
        desc: 'Nueva York, Tokio, Londres, París y rascacielos.',
        questions: [
          { p: '¿Cuál es la gran capital mundial que más sueñas con visitar?', ops: ['Tokio (Japón) por su fascinante mezcla de tradición y futuro', 'Nueva York (EE.UU.) por su energía de película y rascacielos', 'Londres o París por su historia, museos y elegancia', 'Roma por sus monumentos milenarios en cada esquina'] },
          { p: '¿Cómo te desplazas cuando haces turismo en una gran ciudad?', ops: ['En metro y autobús público como un ciudadano local', 'Caminando decenas de kilómetros al día hasta cansarme', 'En Uber o taxis para ir directo a cada punto', 'En autobuses turísticos descapotables (Hop-on Hop-off)'] },
          { p: '¿Visitas museos de arte e historia en tus viajes urbanos?', ops: ['Sí, reservo entradas para los museos más importantes', 'Solo 1 o 2 museos emblemáticos si son imprescindibles', 'Prefiero pasear por las calles y barrios antes que entrar a museos', 'No me gusta visitar museos'] },
          { p: '¿Subes a miradores de rascacielos para ver la ciudad desde arriba?', ops: ['Sí, siempre busco el mirador más alto de la ciudad al atardecer', 'Solo si no hay que hacer colas desmesuradas', 'Prefiero miradores naturales gratuitos en colinas', 'Tengo algo de vértigo y evito las alturas extremas'] },
          { p: '¿Cuánto tiempo consideras ideal para conocer una gran capital?', ops: ['Entre 4 y 6 días completos para ver lo principal con calma', 'Una escapada rápida de fin de semana (2 a 3 días)', 'Al menos una semana entera o 10 días', 'Más de dos semanas para empaparme de la vida local'] }
        ]
      },
      {
        title: 'Viajes en Furgoneta Camper y Caravaning',
        desc: 'Libertad sobre ruedas, acampada libre, rutas y naturaleza.',
        questions: [
          { p: '¿Has viajado alguna vez en furgoneta camperizada o autocaravana?', ops: ['Sí, tengo mi propia camper o he hecho viajes inolvidables', 'He alquilado una camper un fin de semana para probar', 'Tengo muchas ganas de hacer un viaje así con amigos o pareja', 'Prefiero la comodidad de un hotel con cama y baño privado'] },
          { p: '¿Qué es lo que más te atrae del estilo de vida camper?', ops: ['Despertarte cada día frente a un paisaje natural diferente', 'La libertad de cambiar de ruta sobre la marcha sin reservas previas', 'Viajar con tu mascota y todo tu equipaje deportivo a cuestas', 'El contacto directo con la naturaleza y las estrellas'] },
          { p: '¿Qué te parece el aspecto más complicado de viajar en camper?', ops: ['El espacio reducido y la gestión del agua y WC químico', 'Encontrar sitios legales y seguros para pernoctar', 'El consumo de combustible de un vehículo voluminoso', 'Tener que cocinar y fregar en un espacio pequeño'] },
          { p: '¿Qué ruta camper te gustaría recorrer más?', ops: ['La costa de Portugal y Algarve recorriendo playas salvajes', 'La Ruta 66 en Estados Unidos o los fiordos de Noruega', 'El norte de España (Asturias, Cantabria y País Vasco)', 'Los Alpes suizos y puertos de montaña alpinos'] },
          { p: '¿Comprarías una camper para viajar todos los fines de semana?', ops: ['Sí, es mi sueño de ocio a medio plazo', 'Prefiero alquilar puntualmente para no tener gastos de mantenimiento', 'No me compensa económicamente', 'No es mi estilo de viaje'] }
        ]
      },
      {
        title: 'Cruceros y Grandes Barcos de Vacaciones',
        desc: 'Camarotes con balcón, escalas, piscinas en cubierta y buffet.',
        questions: [
          { p: '¿Has realizado algún viaje en crucero turístico?', ops: ['Sí, he hecho uno o varios cruceros y la experiencia fue genial', 'Nunca he hecho un crucero pero me gustaría probar', 'No me llama la atención la idea de viajar en barco grande', 'Tengo miedo a marearme en alta mar'] },
          { p: '¿Qué destino de crucero te parece más atractivo?', ops: ['Islas Griegas y Mediterráneo oriental', 'Fiordos Noruegos y paisajes glaciares', 'Islas del Caribe con escalas en playas privadas', 'Cruceros fluviales por el Danubio o el Rin'] },
          { p: '¿Qué tipo de camarote elegirías en un crucero?', ops: ['Camarote exterior con balcón privado para ver el mar', 'Camarote interior por ser la opción más económica', 'Camarote con ventana fija (ojo de buey)', 'Suite espaciosa con mayordomo'] },
          { p: '¿Qué servicio a bordo de los cruceros te parece más llamativo?', ops: ['Las piscinas con toboganes y jacuzzis en la cubierta alta', 'Los espectáculos teatrales nocturnos y casinos a bordo', 'Los buffets abiertos casi 24 horas con comida variada', 'Poder visitar varias ciudades distintas sin deshacer la maleta'] },
          { p: '¿Prefieres hacer las excursiones organizadas del barco o por tu cuenta?', ops: ['Bajar por libre y explorar las ciudades a mi ritmo', 'Contratar las excursiones oficiales del barco por seguridad de horarios', 'Excursiones con agencias locales más baratas en el puerto', 'Quedarme en el barco disfrutando de las instalaciones vacías'] }
        ]
      },
      {
        title: 'Idiomas, Choque Cultural y Adaptación',
        desc: 'Comunicación en el extranjero, costumbres locales y respeto.',
        questions: [
          { p: '¿Cómo te comunicas cuando viajas a un país donde no hablan tu idioma?', ops: ['En inglés con soltura en la mayoría de situaciones', 'Con ayuda de Google Traductor con la cámara y voz', 'Con gestos, señas y una sonrisa universal', 'Intento aprender de antemano palabras básicas de cortesía'] },
          { p: '¿Te gusta probar la comida callejera (Street Food) local en tus viajes?', ops: ['Sí, es la forma más auténtica y rica de conocer un país', 'Solo en puestos concurridos que tengan buenas valoraciones higiénicas', 'Prefiero restaurantes cerrados con garantías sanitarias', 'No me atrevo con la comida callejera por miedo a ponerme malo'] },
          { p: '¿Has experimentado un choque cultural muy fuerte en algún viaje?', ops: ['Sí, en países asiáticos o de oriente medio, fue muy enriquecedor', 'Ligeras diferencias pero me adapté con facilidad', 'Intento informarme bien de las costumbres locales antes de ir', 'Apenas he viajado fuera de mi entorno cultural'] },
          { p: '¿Qué haces con el cambio de moneda cuando viajas fuera de tu divisa?', ops: ['Uso tarjetas sin comisiones de cambio (Revolut, N26)', 'Saco efectivo en cajeros locales del destino', 'Cambio billetes en el aeropuerto o banco antes de salir', 'Pago todo con mi tarjeta bancaria habitual'] },
          { p: '¿Compras eSIMs digitales de datos móviles para viajar al extranjero?', ops: ['Sí, activo una eSIM digital (Airalo, Holafly) antes de aterrizar', 'Compro una tarjeta SIM física prepago local en el aeropuerto', 'Solo uso el WiFi gratuito de hoteles y cafeterías', 'Uso el roaming de mi compañía telefónica'] }
        ]
      },
      {
        title: 'Turismo Rural y Desconexión en Pueblos',
        desc: 'Casas rurales con chimenea, gastronomía tradicional y calma.',
        questions: [
          { p: '¿Con qué frecuencia haces escapadas de turismo rural a pueblos?', ops: ['Varias veces al año en puentes y fines de semana de otoño/invierno', 'Al menos una vez al año para reunir a toda la familia o amigos', 'Solo de paso en vacaciones de verano', 'Casi nunca, soy una persona 100% urbanita'] },
          { p: '¿Qué buscas principalmente en una casa rural?', ops: ['Chimenea de leña, barbacoa exterior y jardín privado', 'Piscina privada para el verano y vistas a la montaña', 'Cocina amplia y mesa grande para comidas en grupo', 'Buena conexión a internet por si necesito trabajar'] },
          { p: '¿Comprarías una casa de pueblo para restaurar como segunda residencia?', ops: ['Sí, me encantaría tener un refugio de paz en el campo', 'Solo si estuviera lista para entrar a vivir sin obras complejas', 'Prefiero alquilar para no tener ataduras ni gastos fijos', 'No me interesa tener casa en un pueblo'] },
          { p: '¿Qué actividades disfrutas más en un entorno rural?', ops: ['Senderismo suave por el bosque y respirar aire puro', 'Comer en mesones tradicionales guisos y carnes asadas', 'Hacer sobremesa larga junto a la chimenea jugando a juegos', 'Comprar productos artesanos locales (miel, embutidos, quesos)'] },
          { p: '¿Cuánto tiempo puedes estar en un pueblo sin aburrirte?', ops: ['Podría vivir allí permanentemente sin problemas', 'Un fin de semana largo de 3 o 4 días es perfecto', 'A los 2 días ya echo de menos la actividad de la ciudad', 'Solo paso el día y vuelvo a dormir a mi casa'] }
        ]
      },
      {
        title: 'Fotografía de Viajes y Creación de Recuerdos',
        desc: 'Cámaras réflex, fotos con smartphone, álbumes y Reels.',
        questions: [
          { p: '¿Qué cámara utilizas para hacer fotos durante tus viajes?', ops: ['La cámara de mi smartphone de gama alta', 'Cámara réflex o sin espejo (Mirrorless) con objetivos dedicados', 'Cámara de acción deportiva (GoPro) para actividades', 'Cámara analógica clásica con carrete de película'] },
          { p: '¿Sueles imprimir álbumes de fotos físicos después de un gran viaje?', ops: ['Sí, diseño e imprimo un fotolibro de cada gran viaje', 'Imprimo un par de fotos destacadas para enmarcar en casa', 'Solo las guardo en carpetas en la nube o disco duro', 'Las subo a redes sociales y no las imprimo en papel'] },
          { p: '¿Dedicas mucho tiempo a posar para la foto perfecta en lugares turísticos?', ops: ['Hago un par de fotos rápidas del paisaje y sigo disfrutando', 'Me gusta buscar buenos ángulos y luz para tener fotos bonitas', 'Me agobia la gente que hace colas de 1 hora solo para un selfie', 'Rara vez salgo en las fotos, solo fotografío el entorno'] },
          { p: '¿Compras recuerdos típicos (souvenirs) en cada ciudad que visitas?', ops: ['Sí, imanes para la nevera de cada lugar son tradición sagrada', 'Compro camisetas, tazas o artesanía local auténtica', 'Compro productos gastronómicos típicos para comer en casa', 'No suelo comprar souvenirs porque acumulan polvo'] },
          { p: '¿Llevas un diario de viaje escrito con notas de tus experiencias?', ops: ['Sí, apunto anécdotas, restaurantes y gastos de cada día', 'Tengo notas en el móvil con recomendaciones', 'Solo confío en mi memoria y en las fotos tomadas', 'No llevo registro escrito'] }
        ]
      },
      {
        title: 'Viajes de Mochilero (Backpacking) y Hostales',
        desc: 'Mochila a la espalda, habitaciones compartidas y bajo presupuesto.',
        questions: [
          { p: '¿Has viajado alguna vez de mochilero por varios países seguidos?', ops: ['Sí, he hecho viajes largos de mochila por el sudeste asiático o Europa', 'He hecho rutas cortas de mochila de 1 o 2 semanas', 'Me gustaría vivir la experiencia al menos una vez en la vida', 'Prefiero viajar con maleta de ruedas y hoteles cómodos'] },
          { p: '¿Dormirías en una habitación compartida con literas en un hostal juvenil?', ops: ['Sí, es genial para ahorrar y conocer a otros viajeros de todo el mundo', 'Solo si viajo solo o con presupuesto muy ajustado', 'Prefiero habitación privada aunque sea dentro del hostal', 'No comparto habitación con desconocidos bajo ningún concepto'] },
          { p: '¿Qué es lo más importante en la mochila de un viajero?', ops: ['Un buen calzado cómodo todoterreno que no haga rozaduras', 'Cargador portátil (Powerbank) potente para no quedarse sin batería', 'Neceser compacto con toalla de secado rápido y tapones', 'Chubasquero ligero plegable cortavientos'] },
          { p: '¿Utilizas trenes nocturnos o autobuses largos para ahorrar noche de hotel?', ops: ['Sí, duermes mientras avanzas y ahorras tiempo y dinero', 'Lo he hecho pero se duerme con dificultad', 'Prefiero viajar de día y dormir en una cama fija de noche', 'Solo tomo vuelos rápidos'] },
          { p: '¿Qué cualidad consideras más necesaria para viajar de mochilero?', ops: ['Capacidad de adaptación y flexibilidad ante imprevistos', 'Sociabilidad para pedir ayuda y hacer amigos fácilmente', 'Organización para estirar el presupuesto al máximo', 'Paciencia infinita'] }
        ]
      },
      {
        title: 'Turismo Temático: Parques de Atracciones y Eventos',
        desc: 'Disneyland, Universal Studios, PortAventura y montañas rusas.',
        questions: [
          { p: '¿Te gustan los parques de atracciones temáticos?', ops: ['Me fascinan, viajo específicamente para visitar grandes parques', 'Me encantan las montañas rusas fuertes con caídas y loopings', 'Prefiero atracciones oscuras inmersivas y espectáculos familiares', 'No me gustan las atracciones fuertes porque me mareo'] },
          { p: '¿Qué parque temático consideras el mejor al que has ido o sueñas ir?', ops: ['Universal Studios (Orlando / Osaka) por las zonas de Harry Potter / Nintendo', 'Disneyland / Disney World por la magia y ambientación perfecta', 'PortAventura / Europa-Park por sus montañas rusas de récord', 'Parques acuáticos gigantescos con toboganes extremos'] },
          { p: '¿Pagarías por pases rápidos (Fast Pass / Express) para evitar colas?', ops: ['Sin duda, mi tiempo de vacaciones vale más que esperar 2 horas por atracción', 'Solo en días de máxima afluencia en atracciones estrella', 'Me niego a pagar suplementos extra abusivos', 'Aprovecho las colas de Single Rider (viajero individual) para avanzar rápido'] },
          { p: '¿Qué atracción te produce más adrenalina?', ops: ['Montaña rusa de aceleración magnética que alcanza +130 km/h en segundos', 'Torre de caída libre de más de 80 metros de altura', 'Atracciones con caídas verticales de más de 90 grados', 'Simuladores inmersivos con pantallas envolventes 4D'] },
          { p: '¿Comes en los restaurantes temáticos dentro del parque?', ops: ['Sí, para sumergirme al 100% en la experiencia temática', 'Pido comida rápida básica dentro del parque para no perder tiempo', 'Llevo mis propios bocadillos y snacks si el parque lo permite', 'Salgo a comer fuera del parque'] }
        ]
      }
    ]
  },
  {
    category: 'Automoción, Motores & Conducción',
    icon: '🚗',
    topics: [
      {
        title: 'Coches de Combustión vs Híbridos y Eléctricos',
        desc: 'Motores gasolina, diésel, híbridos autorecargables y enchufables.',
        questions: [
          { p: '¿Qué tipo de motor tiene tu coche actual o el de tu familia?', ops: ['Motor de gasolina tradicional', 'Motor diésel de bajo consumo para trayectos largos', 'Motor híbrido autorrecargable (HEV) o enchufable (PHEV)', 'Vehículo 100% eléctrico a batería (EV)'] },
          { p: '¿Si compraras un coche nuevo hoy, qué motorización elegirías?', ops: ['Híbrido no enchufable por etiqueta ECO y practicidad sin cables', 'Gasolina potente o deportivo con cambio manual', '100% Eléctrico para cargar en casa y ahorrar costes', 'Híbrido enchufable para tener lo mejor de ambos mundos'] },
          { p: '¿Qué opinas sobre la desaparición progresiva del motor diésel?', ops: ['Una lástima, para hacer muchos kilómetros en autopista sigue siendo imbatible', 'Lógica por las emisiones contaminantes en ciudades', 'Injusta porque los motores diésel modernos son muy limpios', 'Me es indiferente'] },
          { p: '¿Tienes punto de carga en tu garaje o plaza de aparcamiento?', ops: ['Sí, tengo cargador instalado en mi vivienda unifamiliar o garaje', 'Tengo plaza comunitaria pero aún no he instalado cargador', 'Aparco en la calle y dependería de cargadores públicos', 'No tengo coche'] },
          { p: '¿Cuál es el factor más determinante al comprar un coche?', ops: ['Fiabilidad mecánica contrastada y coste de mantenimiento bajo', 'Diseño exterior, potencia y sensaciones al volante', 'Seguridad activa y espacio para familia y equipaje', 'Precio de adquisición y condiciones de financiación'] }
        ]
      },
      {
        title: 'Cambio Manual vs Cambio Automático',
        desc: 'Palanca de cambios, doble embrague, levas y comodidad en atascos.',
        questions: [
          { p: '¿Prefieres conducir con cambio manual o cambio automático?', ops: ['Automático siempre, la comodidad en ciudad y atascos no tiene precio', 'Manual por el control total de las marchas y el placer de conducir', 'Automático con levas en el volante para poder cambiar cuando quiera', 'Me es indiferente, me adapto a cualquier coche'] },
          { p: '¿Aprendiste a conducir en un coche con cambio manual?', ops: ['Sí, como la inmensa mayoría de conductores en mi país', 'Aprendí directamente en un coche automático', 'Tuve clases en manual pero en cuanto pude pasé a automático', 'No tengo carnet de conducir'] },
          { p: '¿Consideras que el cambio automático es más seguro?', ops: ['Sí, permite mantener las dos manos en el volante y menos distracciones', 'Es igual de seguro, depende de la atención del conductor', 'El manual da mejor retención con freno motor en bajadas pronunciadas', 'No noto diferencia en seguridad'] },
          { p: '¿Has conducido coches con levas de cambio detrás del volante?', ops: ['Sí, es divertidísimo para reducir marchas en carreteras de curvas', 'Las he probado pero casi siempre dejo el modo D automático', 'Mi coche no tiene levas pero me gustaría probarlas', 'No he conducido coches con levas'] },
          { p: '¿Pagarías el sobrecoste habitual de $1,500-$2,000 por la caja automática?', ops: ['Sin dudarlo, es el extra más rentable de cualquier coche moderno', 'Solo si voy a usar el coche mucho en ciudad', 'Prefiero ahorrarme ese dinero o gastarlo en otro equipamiento', 'No pagaría por cambio automático'] }
        ]
      },
      {
        title: 'Motos, Scooters y Libertad sobre Dos Ruedas',
        desc: 'Motos de gran cilindrada, scooters urbanos 125cc y cascos.',
        questions: [
          { p: '¿Conduces motocicleta o scooter habitualmente?', ops: ['Sí, moto de gran cilindrada para rutas y viajes de fin de semana', 'Scooter de 125cc o eléctrico para moverme ágil por la ciudad', 'Tengo moto pero la uso de forma ocasional con buen tiempo', 'No conduzco motocicletas'] },
          { p: '¿Qué ventaja consideras inigualable en una moto urbana?', ops: ['Aparcar en la puerta de cualquier sitio sin dar vueltas', 'Ahorro enorme de tiempo al evitar atascos de tráfico', 'Bajo consumo de combustible y mantenimiento económico', 'La sensación de libertad y viento'] },
          { p: '¿Qué tipo de casco utilizas para montar en moto?', ops: ['Casco integral cerrado de fibra de carbono para máxima protección', 'Casco modular abatible por comodidad al parar', 'Casco jet abierto para ciudad', 'No conduzco moto'] },
          { p: '¿Llevas siempre chaqueta con protecciones y guantes homologados?', ops: ['Siempre, la equipación completa es el único chasis en una moto', 'Guantes y chaqueta siempre, aunque haga calor en verano', 'Solo casco en trayectos urbanos cortos', 'No conduzco moto'] },
          { p: '¿Has soñado alguna vez con hacer un gran viaje en moto?', ops: ['Sí, recorrer la Ruta 66 o los pasos alpinos en una moto Trail / Touring', 'Una ruta por la costa con una moto clásica / Café Racer', 'Prefiero la comodidad y seguridad de las 4 ruedas de un coche', 'No me llaman la atención las motos'] }
        ]
      },
      {
        title: 'Mantenimiento del Coche, ITV y Mecánica',
        desc: 'Cambios de aceite, neumáticos, revisiones periódicas y talleres.',
        questions: [
          { p: '¿Llevas el mantenimiento de tu coche al día según el libro oficial?', ops: ['Rigurosamente cada año o kilometraje indicado', 'Suelo pasar la revisión cuando se enciende el aviso en el cuadro', 'Solo cambio aceite y filtros cuando me acuerdo', 'No tengo coche propio'] },
          { p: '¿Dónde prefieres llevar tu coche a reparar o mantener?', ops: ['A mi taller mecánico de confianza de barrio', 'Al concesionario oficial de la marca aunque sea más caro', 'Hago yo mismo tareas sencillas (bombillas, filtros, batería)', 'A grandes cadenas de mecánica rápida'] },
          { p: '¿Con qué frecuencia revisas la presión de los neumáticos?', ops: ['Al menos una vez al mes o antes de cada viaje largo', 'Solo cuando paso la revisión anual en el taller', 'Solo si veo un neumático visiblemente bajo de aire', 'Casi nunca reviso la presión'] },
          { p: '¿Te genera nerviosismo pasar la Inspección Técnica de Vehículos (ITV)?', ops: ['Ninguno, llevo el coche impecable y pasa a la primera', 'Un poco de incertidumbre por si encuentran algún defecto menor', 'Bastante, temo que me pongan falta grave y tener que volver', 'No me ha tocado pasarla todavía'] },
          { p: '¿Sabrías cambiar una rueda pinchada por la de repuesto en carretera?', ops: ['Sí, sé colocar el gato y aflojar los tornillos con soltura', 'Conozco la teoría pero prefiero llamar a la grúa del seguro', 'Nunca lo he hecho y me daría miedo hacerlo en carretera', 'Mi coche lleva kit antipinchazos con compresor en vez de rueda'] }
        ]
      },
      {
        title: 'Fórmula 1 y Automovilismo Deportivo',
        desc: 'Grandes Premios, Ferrari, Red Bull, Fernando Alonso y adelantamientos.',
        questions: [
          { p: '¿Sigues las carreras de Fórmula 1 los fines de semana?', ops: ['Sí, veo clasificación el sábado y carrera el domingo religiosamente', 'Solo las carreras más espectaculares (Mónaco, Silverstone, Spa)', 'Miro los resúmenes de adelantamientos y polémicas en YouTube', 'No sigo la Fórmula 1'] },
          { p: '¿Cuál es tu piloto o escudería favorita en la parrilla?', ops: ['Fernando Alonso / Aston Martin', 'Ferrari (Scuderia Ferrari)', 'Max Verstappen / Red Bull Racing', 'Lewis Hamilton / Mercedes'] },
          { p: '¿Has asistido a un circuito a ver un Gran Premio de F1 o MotoGP en directo?', ops: ['Sí, el sonido de los motores en vivo y el ambiente es sobrecogedor', 'Me encantaría ir al menos una vez en la vida', 'Prefiero verlo por televisión con comentarios técnicos y repeticiones', 'No me interesa el automovilismo'] },
          { p: '¿Qué circuito del calendario de F1 te parece el más legendario?', ops: ['Spa-Francorchamps en Bélgica con la subida de Eau Rouge', 'Monza en Italia por la velocidad pura del Templo de la Velocidad', 'Mónaco por el glamour y la precisión milimétrica entre muros', 'Suzuka en Japón por sus curvas enlazadas en S'] },
          { p: '¿Te gustan los simuladores de conducción con volante y pedales (Simracing)?', ops: ['Sí, tengo volante Force Feedback y juego a Assetto Corsa / iRacing / F1', 'He probado volantes de amigos y me parece súper inmersivo', 'Prefiero jugar a juegos de carreras con mando tradicional', 'No juego a títulos de carreras'] }
        ]
      },
      {
        title: 'Carsharing, Alquiler de Vehículos y Viajes Compartidos',
        desc: 'BlaBlaCar, alquiler vacacional, Zity y no tener coche propio.',
        questions: [
          { p: '¿Has utilizado plataformas de viajes compartidos como BlaBlaCar?', ops: ['Sí, como conductor o pasajero con frecuencia para ahorrar en viajes', 'Lo he usado en alguna ocasión puntual de urgencia', 'Conozco el servicio pero prefiero viajar en tren, bus o coche propio', 'Nunca he compartido coche con desconocidos'] },
          { p: '¿Utilizas servicios de carsharing por minutos en tu ciudad?', ops: ['Sí, es comodísimo para trayectos urbanos sin preocuparse de aparcar', 'Ocasionalmente si necesito mover bultos grandes', 'Prefiero transporte público o mi propio vehículo', 'En mi ciudad no hay servicios de carsharing'] },
          { p: '¿Crees que en el futuro las nuevas generaciones dejarán de comprar coche propio?', ops: ['Sí, en grandes ciudades saldrá más a cuenta pagar por uso', 'En ciudades sí, pero en zonas rurales o pueblos el coche es imprescindible', 'La gente siempre querrá tener su propio coche por independencia', 'Dependerá de los costes de adquisición y combustible'] },
          { p: '¿Qué seguro contratas al alquilar un coche de vacaciones?', ops: ['Siempre seguro a todo riesgo sin franquicia para viajar con tranquilidad total', 'El seguro básico que viene incluido para pagar lo mínimo', 'Uso el seguro de cobertura que ofrece mi tarjeta de crédito', 'Rara vez alquilo coches'] },
          { p: '¿Te gustaría que existieran taxis y transportes 100% autónomos sin conductor?', ops: ['Sí, el futuro de la conducción autónoma será más seguro y barato', 'Me daría cierta desconfianza subirme a un coche sin volante ni chófer', 'Prefiero la conducción humana', 'Creo que aún faltan muchos años para que sea una realidad común'] }
        ]
      },
      {
        title: 'Estética del Coche, Detailing y Limpieza',
        desc: 'Lavado a mano, ceras cerámicas, túneles de lavado y ambientadores.',
        questions: [
          { p: '¿Cómo lavas habitualmente tu coche por fuera?', ops: ['A mano con dos cubos, champú especial y toallas de microfibra (Detailing)', 'En cabinas de lavado a presión con lanza de agua caliente', 'En túneles de lavado automáticos de rodillos por rapidez', 'Casi nunca lavo el coche por fuera, espero a que llueva'] },
          { p: '¿Con qué frecuencia limpias el interior del habitáculo?', ops: ['Cada semana aspiro alfombrillas y limpio salpicadero a fondo', 'Una vez al mes o cada mes y medio', 'Solo cuando está visiblemente sucio o voy a llevar invitados', 'Casi nunca limpio el interior'] },
          { p: '¿Utilizas ambientador dentro del vehículo?', ops: ['Sí, ambientadores de clip de rejilla o botellita con fragancia agradable', 'Prefiero el olor a limpio natural sin ambientadores químicos', 'Solo pongo ambientador de pino clásico de vez en cuando', 'No me gustan los olores artificiales en el coche'] },
          { p: '¿Permites que se coma o se fume dentro de tu coche?', ops: ['Prohibido comer o fumar categricamente, el coche se mantiene impoluto', 'Comer snacks sencillos sí, pero nada que manche o huela fuerte', 'Se permite comer pero no fumar', 'No tengo reglas estrictas dentro del vehículo'] },
          { p: '¿Aplicas tratamientos de cera o sellado cerámico a la pintura?', ops: ['Sí, aplico cera o recubrimiento cerámico para proteger el brillo', 'Solo la cera que echa la lanza del lavadero', 'No le aplico productos de protección a la chapa', 'No me fijo en el estado del brillo de la pintura'] }
        ]
      },
      {
        title: 'Seguridad Vial, Radares y Asistentes de Conducción (ADAS)',
        desc: 'Control de crucero adaptativo, frenada de emergencia y límites.',
        questions: [
          { p: '¿Qué asistente de conducción consideras más útil en autopista?', ops: ['Control de crucero adaptativo que mantiene la distancia automáticamente', 'Asistente de mantenimiento en el centro del carril', 'Detector de ángulo muerto en los espejos retrovisores', 'Cámara de visión 360 grados y sensores para aparcar'] },
          { p: '¿Utilizas aplicaciones que avisan de la presencia de radares (Waze, Coyote)?', ops: ['Siempre activada en segundo plano para evitar multas por despiste', 'Solo en viajes largos por carreteras que no conozco', 'No, suelo respetar estrictamente las señales de velocidad', 'No utilizo avisadores de radar'] },
          { p: '¿Qué te parecen los sistemas que frenan automáticamente ante un peatón u obstáculo?', ops: ['Una bendición tecnológica que salva miles de vidas al año', 'Muy útiles aunque a veces dan falsas alarmas que asustan', 'Prefiero mantener el control manual de los pedales', 'No he probado coches con frenada de emergencia autónoma'] },
          { p: '¿Alguna vez te ha saltado un radar de velocidad en carretera?', ops: ['Sí, alguna multa por despiste de 5 o 10 km/h por encima del límite', 'Afortunadamente nunca me han multado por velocidad', 'Hace muchos años', 'No tengo carnet de conducir'] },
          { p: '¿Qué opinas sobre reducir los límites de velocidad en ciudades a 30 km/h?', ops: ['Adecuado para proteger a peatones, ciclistas y reducir atropellos', 'Excesivamente lento en avenidas anchas donde genera congestión', 'Solo debería aplicarse en calles residenciales y entornos escolares', 'Me parece una medida recaudatoria'] }
        ]
      },
      {
        title: 'Sonido y Conectividad en el Coche: CarPlay y Android Auto',
        desc: 'Pantallas táctiles, Bluetooth, navegación por satélite y altavoces.',
        questions: [
          { p: '¿Utilizas Apple CarPlay o Android Auto en tu vehículo?', ops: ['Sí, inalámbrico o por cable, es imprescindible para mapas y música', 'Uso solo conexión Bluetooth básica para reproducir audio', 'Tengo soporte para el móvil en la rejilla y miro la pantalla del teléfono', 'La radio clásica FM/AM de toda la vida'] },
          { p: '¿Qué prefieres: mandos físicos tradicionales o pantallas táctiles para el climatizador?', ops: ['Botones y ruletas físicas para cambiar la temperatura sin apartar la vista', 'Pantalla táctil moderna de gran formato con diseño minimalista', 'Combinación equilibrada de ambos', 'Control por voz del asistente'] },
          { p: '¿Qué sueles escuchar habitualmente mientras conduces?', ops: ['Playlists de música energética en Spotify / Apple Music', 'Podcasts de entrevistas o tertulias para aprender', 'Programas de radio generalista o deportiva', 'Prefiero el silencio del motor para pensar'] },
          { p: '¿Qué importancia le das a la calidad del equipo de sonido de un coche?', ops: ['Mucha, si puedo elijo equipos firmados de calidad (Bose, Harman Kardon, etc.)', 'Con que suene nítido a volumen medio me basta', 'Casi no noto la diferencia con altavoces de serie básicos', 'No escucho música a menudo en el coche'] },
          { p: '¿Cargas el móvil en el coche por cable o con base de carga inalámbrica?', ops: ['Por cable rápido USB-C directo a la toma de corriente', 'En la bandeja de carga inalámbrica integrada por inducción', 'Con un adaptador de mechero de 12V', 'No suelo cargarlo en el coche'] }
        ]
      },
      {
        title: 'Coches Clásicos, Concentraciones y Cultura del Motor',
        desc: 'Youngtimers de los 90, coches vintage, ferias y restauración.',
        questions: [
          { p: '¿Te atraen los coches clásicos o deportivos de los años 80 y 90 (Youngtimers)?', ops: ['Me apasionan, tenían mucha más personalidad mecánica y alma que los actuales', 'Me gusta verlos en exhibiciones aunque prefiero la seguridad moderna', 'Solo los superdeportivos clásicos legendarios (Ferrari F40, Porsche 911)', 'Prefiero los coches modernos tecnológicos'] },
          { p: '¿Has asistido a concentraciones de coches o quedadas del motor?', ops: ['Sí, asisto a quedadas (Cars & Coffee, etc.) con frecuencia', 'He ido a salones del automóvil o ferias de clásicos', 'Miro vídeos en YouTube de eventos del motor', 'No me interesan las concentraciones de coches'] },
          { p: '¿Te gustaría tener un coche histórico guardado en el garaje para pasear los domingos?', ops: ['Sí, es uno de mis sueños dorados como aficionado al motor', 'Si tuviera presupuesto de sobra y espacio propio sí', 'Me daría pereza el mantenimiento y encontrar piezas de recambio', 'No me llama la atención tener vehículos antiguos'] },
          { p: '¿Qué sonido de motor te parece el más emocionante?', ops: ['El aullido agudo de un motor V10 o V12 atmosférico a altas revoluciones', 'El rugido bronco y grave de un motor V8 americano clásico', 'El petardeo deportivo y turbo de un 4 cilindros rabioso (GTI, etc.)', 'El silencio absoluto y aceleración instantánea de los motores eléctricos'] },
          { p: '¿Qué modelo de coche consideras el más icónico de la historia?', ops: ['Porsche 911 con su silueta inconfundible durante 60 años', 'Ford Mustang clásico de 1967', 'Volkswagen Escarabajo / Golf GTI Mk1', 'Ferrari 250 GTO'] }
        ]
      }
    ]
  }
];

let content = fs.readFileSync('panda/encuestas/generar_encuestas.cjs', 'utf-8');
const marker = '// Generar las 100 encuestas estructuradas';
const idx = content.indexOf(marker);

if (idx !== -1) {
  const lastBracket = content.lastIndexOf('];', idx);
  if (lastBracket !== -1) {
    const categoriesJsonParts = extraCategories.map(c => JSON.stringify(c, null, 2)).join(',\n');
    const newContent = content.substring(0, lastBracket) + ',\n' + categoriesJsonParts + '\n' + content.substring(lastBracket);
    fs.writeFileSync('panda/encuestas/generar_encuestas.cjs', newContent, 'utf-8');
    console.log('Successfully updated generar_encuestas.cjs with 10 full categories!');
  }
}

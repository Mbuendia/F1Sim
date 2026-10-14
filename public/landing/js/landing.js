// Landing de F1 Race Manager: enlaces de «Jugar», el muro en miniatura y los velos.
// El motor de scroll (scrollcraft.js) no se modifica; esto solo lee su estado.
(function () {
  'use strict';

  var raiz = document.documentElement;
  var VUELTAS = 58;
  var COMPUESTOS = {
    S: { color: '#e10600', tinta: '#ffffff', plural: 'blandos' },
    M: { color: '#ffd400', tinta: '#14110a', plural: 'medios' },
    H: { color: '#f1f1f1', tinta: '#111318', plural: 'duros' },
    I: { color: '#2fbf5b', tinta: '#06140b', plural: 'intermedios' },
    W: { color: '#4d94ff', tinta: '#06101f', plural: 'de lluvia extrema' }
  };

  // ---- «Jugar»: la dirección vive solo en config.js -----------------------
  document.querySelectorAll('a[data-jugar]').forEach(function (enlace) {
    enlace.href = window.F1RM_CONFIG.PLAY_URL;
  });

  ScrollCraft.mount(document);

  // El motor mide el espaciador una vez; si la ventana aún no tenía altura, o
  // cuando entran las tipografías, hay que pedirle que vuelva a medir.
  function remedir() { dispatchEvent(new Event('resize')); }
  addEventListener('load', remedir);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remedir);

  // Las capturas no compiten con la primera pantalla: se cargan después.
  addEventListener('load', function () {
    document.querySelectorAll('img[data-src]').forEach(function (img) {
      img.src = img.getAttribute('data-src');
    });
  });

  // ---- geometría del recorrido -------------------------------------------
  var bloques = [].map.call(document.querySelectorAll('[data-sc-copy]'), function (el) {
    var n = el.getAttribute('data-sc-window').split(/\s+/).map(parseFloat);
    return { el: el, desde: n[0], hasta: n[1], velo: el.previousElementSibling, op: '' };
  });
  function bloque(id) { return bloques.filter(function (b) { return b.el.id === id; })[0]; }
  // La carrera termina cuando «Bandera a cuadros» está ya a plena vista.
  var meta = bloque('meta');
  var finCarrera = meta.desde + (meta.hasta - meta.desde) * 0.3;

  function recorrido() { return Math.max(document.documentElement.scrollHeight - innerHeight, 1); }
  function progreso() { return Math.min(Math.max(scrollY / recorrido(), 0), 1); }

  // Enlaces internos: no hay secciones en el flujo, así que se viaja por el recorrido.
  document.querySelectorAll('a[href^="#"]:not([data-jugar])').forEach(function (a) {
    var b = bloque(a.getAttribute('href').slice(1));
    if (!b) return;
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var destino = b.desde === 0 ? 0 : b.hasta >= 1 ? 1 : b.desde + (b.hasta - b.desde) * 0.45;
      scrollTo(0, destino * recorrido());
    });
  });

  // Con el teclado se puede llegar a un bloque que aún no está a la vista: se viaja a él.
  document.addEventListener('focusin', function (e) {
    var el = e.target.closest && e.target.closest('[data-sc-copy]');
    if (!el || parseFloat(el.style.opacity || '0') > 0.85) return;
    var b = bloque(el.id);
    if (!b) return;
    var destino = b.desde === 0 ? 0 : b.hasta >= 1 ? 1 : b.desde + (b.hasta - b.desde) * 0.45;
    scrollTo({ top: destino * recorrido(), behavior: 'instant' });
  });

  // Hitos sobre la barra de tandas, colocados donde empieza cada bloque.
  var hitos = [].map.call(document.querySelectorAll('.hitos a'), function (a) {
    var b = bloque(a.getAttribute('href').slice(1));
    a.parentNode.style.setProperty('--en', (b.desde / finCarrera).toFixed(4));
    return { a: a, b: b };
  });

  // ---- el muro ------------------------------------------------------------
  var elMuro = document.querySelector('.muro');
  var elVuelta = document.querySelector('[data-vuelta]');
  var elBandera = document.querySelector('[data-bandera]');
  var elTandas = document.querySelector('[data-tandas]');
  var elMarcas = document.querySelector('[data-marcas]');
  var elRadio = document.querySelector('[data-radio]');
  var elResumen = document.querySelector('[data-resumen]');
  var botones = [].slice.call(document.querySelectorAll('[data-compuesto]'));

  var tandas = [{ vuelta: 0, c: 'S' }];   // se sale con blandos
  var elegido = 'M';
  var vuelta = 0;
  var carrera = 0;

  function radio(texto) { elRadio.textContent = texto; }

  // La figura de la parada en boxes (js/figura-boxes.js) obedece a este mismo muro.
  var elFigura = document.querySelector('[data-figura="boxes"]');
  var figura = elFigura && window.F1RM_FIGURA_BOXES ? window.F1RM_FIGURA_BOXES.montar(elFigura) : null;

  function pintarTandas() {
    var paradas = tandas.slice(1);
    var cortes = [];
    tandas.forEach(function (t, i) {
      var ini = (t.vuelta / VUELTAS * 100).toFixed(2) + '%';
      var fin = ((tandas[i + 1] ? tandas[i + 1].vuelta : VUELTAS) / VUELTAS * 100).toFixed(2) + '%';
      cortes.push(COMPUESTOS[t.c].color + ' ' + ini + ' ' + fin);
    });
    elTandas.style.setProperty('--tandas', 'linear-gradient(90deg, ' + cortes.join(', ') + ')');

    elMarcas.textContent = '';
    paradas.forEach(function (t) {
      var m = document.createElement('span');
      m.textContent = t.c;
      m.style.left = (t.vuelta / VUELTAS * 100).toFixed(2) + '%';
      m.style.setProperty('--c', COMPUESTOS[t.c].color);
      elMarcas.appendChild(m);
    });

    // El neumático montado tiñe toda la página.
    var actual = COMPUESTOS[tandas[tandas.length - 1].c];
    raiz.style.setProperty('--sc-accent', actual.color);
    raiz.style.setProperty('--sc-accent-ink', actual.tinta);
    raiz.setAttribute('data-compuesto', tandas[tandas.length - 1].c);

    if (!paradas.length) {
      elResumen.textContent = 'Has llegado a meta sin parar, con los blandos de la salida.';
    } else {
      var partes = tandas.map(function (t, i) {
        var sig = tandas[i + 1];
        return COMPUESTOS[t.c].plural + (sig ? ' hasta la vuelta ' + sig.vuelta : ' hasta meta');
      });
      elResumen.textContent = 'Tu carrera, con ' + paradas.length + (paradas.length === 1 ? ' parada: ' : ' paradas: ') + partes.join(', ') + '.';
    }
  }

  botones.forEach(function (b, i) {
    // Grupo de opciones: se entra con Tab y se cambia con las flechas.
    b.addEventListener('keydown', function (e) {
      var paso = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0;
      if (!paso) return;
      e.preventDefault();
      var otro = botones[(i + paso + botones.length) % botones.length];
      otro.focus();
      otro.click();
    });
    b.addEventListener('click', function () {
      elegido = b.getAttribute('data-compuesto');
      botones.forEach(function (o) {
        o.setAttribute('aria-checked', String(o === b));
        o.tabIndex = o === b ? 0 : -1;
      });
      radio('Próxima parada: ' + COMPUESTOS[elegido].plural + '.');
      if (figura) figura.elegir(elegido);
    });
  });

  document.querySelector('[data-box]').addEventListener('click', function () {
    if (vuelta === 0) { radio('Sigues en la parrilla. Baja para empezar la carrera.'); return; }
    if (carrera >= 1) { radio('La carrera ha terminado. Sube para volver a correrla.'); return; }
    // Si se ha vuelto atrás, las paradas posteriores a esta vuelta dejan de valer.
    tandas = tandas.filter(function (t) { return t.vuelta < vuelta; });
    var anterior = tandas[tandas.length - 1].c;
    tandas.push({ vuelta: vuelta, c: elegido });
    pintarTandas();
    var servicio = figura ? figura.parada(elegido, anterior) : 0;
    radio('Vuelta ' + vuelta + ': parada en boxes' + (servicio ? ' en ' + servicio.toFixed(2).replace('.', ',') + ' s' : '') + '. Montas ' + COMPUESTOS[elegido].plural + '.');
  });

  // Pulsar el dibujo es pulsar BOX.
  if (elFigura) elFigura.querySelector('[data-figura-lienzo]').addEventListener('click', function () {
    document.querySelector('[data-box]').click();
  });

  pintarTandas();

  // ---- por fotograma: vuelta, bandera, velos, hito activo ------------------
  var ultima = -1;
  function fotograma() {
    var p = progreso();
    carrera = Math.min(p / finCarrera, 1);
    if (carrera !== ultima) {
      ultima = carrera;
      elTandas.style.setProperty('--carrera', carrera.toFixed(4));
      vuelta = Math.floor(carrera * VUELTAS);
      elVuelta.textContent = vuelta;
      // El verificador de scroll-craft lee aquí lo que este muro pinta de verdad.
      elMuro.setAttribute('data-sc-verify-state', vuelta + ':' + (carrera * 100).toFixed(0));
      var estado = carrera <= 0 ? 'parrilla' : carrera >= 1 ? 'meta' : 'verde';
      if (elBandera.getAttribute('data-estado') !== estado) {
        elBandera.setAttribute('data-estado', estado);
        elBandera.textContent = estado === 'parrilla' ? 'Parrilla' : estado === 'meta' ? 'Meta' : 'Verde';
      }
      hitos.forEach(function (h) {
        h.a.setAttribute('aria-current', String(p >= h.b.desde && p < h.b.hasta + 0.01));
      });
      raiz.classList.toggle('en-boxes', p > bloque('box-box').desde && p < bloque('boxes').hasta);
    }
    // Cada velo sigue la opacidad que el motor le da a su bloque, un poco por
    // delante: cuando el texto ya se lee (0,8), el velo está entero.
    for (var i = 0; i < bloques.length; i++) {
      var op = bloques[i].el.style.opacity;
      if (op !== bloques[i].op) {
        bloques[i].op = op;
        bloques[i].velo.style.opacity = Math.min(1, (parseFloat(op) || 0) / 0.8).toFixed(3);
      }
    }
    requestAnimationFrame(fotograma);
  }
  requestAnimationFrame(fotograma);
})();

//Inicio de la funcion telepromter donde nos garantizará ....

var TelePrompter = (function () {
  //incializamos la variable para almacenar y manipular los botones donde se realizan los eventos del teleprompter.
  var $elm = {};

  var emitTimeout,
    debug = false,
    initialized = false,
    isPlaying = false,
    remote,
    scrollDelay,
    socket,
    modalOpen = false,
    timeout,
    timer,
    timerExp = 10,
    timerGA,
    timerURL,
    version = "v1.2.2";

  var defaultConfig = {
    backgroundColor: "#141414",
    dimControls: true,
    // flipX: false,
    // flipY: false,
    fontSize: 60,
    pageSpeed: 35,
    pageScrollPercent: 0,
    textColor: "#ffffff",
  };

  var config = Object.assign({}, defaultConfig);

  //funcion donde almacenamos las etiquetas de los botones donde haremos click

  function bindEvents() {
    // Cache DOM Elements
    $elm.article = $("article");
    $elm.backgroundColor = $("#background-color");
    $elm.body = $("body");
    $elm.buttonDimControls = $(".button.dim-controls");
    $elm.buttonFlipX = $(".button.flip-x");
    $elm.buttonFlipY = $(".button.flip-y");
    $elm.buttonPlay = $(".button.play");
    $elm.buttonReset = $(".button.reset");
    $elm.closeModal = $(".close-modal");
    $elm.fontSize = $(".font_size");
    $elm.gaInput = $("input[data-ga], textarea[data-ga], select[data-ga]");
    $elm.gaLinks = $("a[data-ga], button[data-ga]");
    $elm.header = $("header");
    $elm.headerContent = $("header h1, header nav");
    $elm.markerOverlay = $(".marker, .overlay");
    $elm.speed = $(".speed");
    $elm.teleprompter = $("#teleprompter");
    $elm.textColor = $("#text-color");
    $elm.window = $(window);

    $elm.backgroundColor.on("change.teleprompter", handleBackgroundColor);
    $elm.buttonDimControls.on("click.teleprompter", handleDim);
    $elm.buttonPlay.on("click.teleprompter", handlePlay);
    $elm.buttonReset.on("click.teleprompter", handleReset);
    $elm.textColor.on("change.teleprompter", handleTextColor);
    $elm.teleprompter.keyup(updateTeleprompter);
  }

  //Inicializamos el telepromter donde manda a llamar la configuracion de los controladores de eventos,
  //establece la configuracion de los cambios que hagamos
  // la interfaz de usuario necesarias.
  function init() {
    if (initialized) {
      return;
    }

    bindEvents();
    initSettings();
    initUI();

    initialized = true;

    if (debug) {
      console.log("[TP]", "Se inicializó el telemprompter");
    }
  }

  /**
   * Inicio del teleprmter.
   */
  function startTeleprompter() {
    // Funcion que chequea si esta iniciado.
    if (isPlaying) {
      return;
    }

    if (socket && remote) {
      socket.emit("clientCommand", "play");
    }

    $elm.teleprompter.attr("contenteditable", false);
    $elm.body.addClass("playing");
    $elm.buttonPlay.removeClass("icon-play").addClass("icon-pause");

    if (config.dimControls) {
      $elm.headerContent.fadeTo("slow", 0.15);
      $elm.markerOverlay.fadeIn("slow");
    }

    timer.startTimer();

    pageScroll();

    isPlaying = true;

    if (debug) {
      console.log("[TP]", "Starting TelePrompter");
    }

    clearTimeout(timerGA);
    timerGA = setTimeout(function () {
      gaEvent("TP", "Starting TelePrompter");
    }, timerExp);
  }

  /**
   * Detiene el telprmter
   */
  function stopTeleprompter() {
    // Chequea si se ha detenido correctamente.
    if (!isPlaying) {
      return;
    }

    if (socket && remote) {
      socket.emit("clientCommand", "stop");
    }

    clearTimeout(scrollDelay);
    $elm.teleprompter.attr("contenteditable", true);

    if (config.dimControls) {
      $elm.headerContent.fadeTo("slow", 1);
      $elm.markerOverlay.fadeOut("slow");
    }

    $elm.buttonPlay.removeClass("icon-pause").addClass("icon-play");
    $elm.body.removeClass("playing");

    timer.stopTimer();

    isPlaying = false;

    if (debug) {
      console.log("[TP]", "Stopping TelePrompter");
    }

    clearTimeout(timerGA);
    timerGA = setTimeout(function () {
      gaEvent("TP", "Stopping TelePrompter");
    }, timerExp);
  }

  /**
   * Actualizar el texto
   * @param {Object} evt
   * @returns Boolean
   */
  function updateTeleprompter(evt) {
    if (evt.keyCode == 27) {
      $elm.teleprompter.blur();
      evt.preventDefault();
      evt.stopPropagation();
      return false;
    }

    localStorage.setItem("teleprompter_text", $elm.teleprompter.html());
    $("p:empty", $elm.teleprompter).remove();

    if (debug) {
      console.log("[TP]", "El texto del teleprompter ha sido actualizado");
    }

    clearTimeout(timerGA);
    timerGA = setTimeout(function () {
      gaEvent("TP", "El texto del teleprompter ha sido actualizado");
    }, timerExp);
  }

  //funcion que comprueba si ha habido cambios anteriores en la configuración almacenada y los aplica en el teleprompter.
  function initSettings() {
    var urlParams = getUrlVars();
    if (urlParams) {
      // Actualiza el color de fondo si está presente; sino lo deja con los valor predeterminado si no hay cambios
      if (urlParams.backgroundColor) {
        config.backgroundColor = decodeURIComponent(urlParams.backgroundColor);
        localStorage.setItem(
          "teleprompter_background_color",
          config.backgroundColor
        );
      } else {
        config.backgroundColor = defaultConfig.backgroundColor;
        localStorage.removeItem("teleprompter_background_color");
      }

      // Actualiza los controles, al contratio los deja por default
      if (urlParams.dimControls) {
        config.dimControls =
          decodeURIComponent(urlParams.dimControls) === "true";
        localStorage.setItem("teleprompter_dim_controls", config.dimControls);
      } else {
        config.dimControls = defaultConfig.dimControls;
        localStorage.removeItem("teleprompter_dim_controls");
      }

      // Actualiza el tamaño de la fuente, sino queda igual
      if (urlParams.fontSize) {
        config.fontSize = parseInt(decodeURIComponent(urlParams.fontSize));
        localStorage.setItem("teleprompter_font_size", config.fontSize);
      } else {
        config.fontSize = defaultConfig.fontSize;
        localStorage.removeItem("teleprompter_font_size");
      }

      // Actualiza la velocidad de lectura, sino queda igual
      if (urlParams.pageSpeed) {
        config.pageSpeed = parseInt(decodeURIComponent(urlParams.pageSpeed));
        localStorage.setItem("teleprompter_speed", config.pageSpeed);
      } else {
        config.pageSpeed = defaultConfig.pageSpeed;
        localStorage.removeItem("teleprompter_speed");
      }

      //Actualiza si hay cambio de color en el texto presentado, sino queda igual
      if (urlParams.textColor) {
        config.textColor = decodeURIComponent(urlParams.textColor);
        localStorage.setItem("teleprompter_text_color", config.textColor);
      } else {
        config.textColor = defaultConfig.textColor;
        localStorage.removeItem("teleprompter_text_color");
      }
    }

    // Hace chequeo si han habido cambios el antes y despues y quedan guardados.
    if (localStorage.getItem("teleprompter_background_color")) {
      config.backgroundColor = localStorage.getItem(
        "teleprompter_background_color"
      );

      // Actualiza el UI
      $elm.backgroundColor.val(config.backgroundColor);
      $elm.article.css("background-color", config.backgroundColor);
      $elm.body.css("background-color", config.backgroundColor);
      $elm.teleprompter.css("background-color", config.backgroundColor);
    } else {
      cleanTeleprompter();
    }

    if (localStorage.getItem("teleprompter_dim_controls")) {
      config.dimControls =
        localStorage.getItem("teleprompter_dim_controls") === "true";

      if (config.dimControls) {
        $elm.buttonDimControls
          .removeClass("icon-eye-open")
          .addClass("icon-eye-close");
      } else {
        $elm.buttonDimControls
          .removeClass("icon-eye-close")
          .addClass("icon-eye-open");
      }
    }

    if (localStorage.getItem("teleprompter_font_size")) {
      config.fontSize = localStorage.getItem("teleprompter_font_size");
    }

    if (localStorage.getItem("teleprompter_speed")) {
      config.pageSpeed = localStorage.getItem("teleprompter_speed");
    }

    if (localStorage.getItem("teleprompter_text")) {
      $elm.teleprompter.html(localStorage.getItem("teleprompter_text"));
    }

    if (localStorage.getItem("teleprompter_text_color")) {
      config.textColor = localStorage.getItem("teleprompter_text_color");
      $elm.textColor.val(config.textColor);
      $elm.teleprompter.css("color", config.textColor);
    }

    if (debug) {
      console.log(
        "[TP]",
        "Settings Initialized",
        urlParams ? urlParams : "( No URL Params )"
      );
    }

    clearTimeout(timerGA);
    timerGA = setTimeout(function () {}, timerExp);
    gaEvent(
      "TP",
      "Settings Initialized",
      urlParams ? "Custom URL Params" : "No URL Params"
    );

 }

  function initUI() {
    // Inicializa un temporizador con una duración 10,000 milisegundos (10 segundos).
    timer = $(".clock").timer({
      stopVal: 10000,
      onChange: function (time) {
        if (socket) {
          socket.emit("clientCommand", "updateTime", time);
        }
      },
    });

    // Anima el desplazamiento del artículo principal al inicio
    $elm.article.stop().animate(
      {
        scrollTop: 0,
      },
      100,
      "linear",
      function () {
        $elm.article.clearQueue();
      }
    );

    $elm.markerOverlay.fadeOut(0);
    $elm.teleprompter.css({
      "padding-bottom":
        Math.ceil($elm.window.height() - $elm.header.height()) + "px",
    });

    // Controles deslizantes de tamaño de fuente y velocidad.
    $elm.fontSize.slider({
      min: 12,
      max: 100,
      value: config.fontSize,
      orientation: "horizontal",
      range: "min",
      animate: true,

      slide: function () {
        updateFontSize(true);
      },
      change: function () {
        updateFontSize(true);
      },
    });

    $elm.speed.slider({
      min: 0,
      max: 50,
      value: config.pageSpeed,
      orientation: "horizontal",
      range: "min",
      animate: true,
      slide: function () {
        updateSpeed(true);
      },
      change: function () {
        updateSpeed(true);
      },
    });

    // Run initial configuration on sliders
    if (config.fontSize !== defaultConfig.fontSize) {
      updateFontSize(false);
    }

    if (config.pageSpeed !== defaultConfig.pageSpeed) {
      updateSpeed(false);
    }

    // Elimina los párrafos vacíos del teleprompter.
    $("p:empty", $elm.teleprompter).remove();

    $elm.teleprompter.addClass("ready");

    if (debug) {
      console.log("[TP]", "UI Incializada");
    }
  }

  

  //Limpia la pantalla del telepromter
  function cleanTeleprompter() {
    var text = $elm.teleprompter.html();
    text = text.replace(/<br>+/g, "@@").replace(/@@@@/g, "</p><p>");
    text = text.replace(/@@/g, "<br>");
    text = text.replace(/([a-z])\. ([A-Z])/g, "$1.&nbsp;&nbsp; $2");
    text = text.replace(/<p><\/p>/g, "");

    if (text && text.substr(0, 3) !== "<p>") {
      text = "<p>" + text + "</p>";
    }

    $elm.teleprompter.html(text);
    $("p:empty", $elm.teleprompter).remove();

   
  }

  //Maneja el cambio del color de fondo en el teleprompter
  function handleBackgroundColor() {
    //  Obtiene el valor del color de fondo seleccionado.
    config.backgroundColor = $elm.backgroundColor.val();

    $elm.teleprompter.css("background-color", config.backgroundColor);
    $elm.article.css("background-color", config.backgroundColor);
    $elm.body.css("background-color", config.backgroundColor);
    localStorage.setItem(
      "teleprompter_background_color",
      config.backgroundColor
    );

    if (socket && remote) {
      clearTimeout(emitTimeout);
      emitTimeout = setTimeout(function () {
        socket.emit("clientCommand", "updateConfig", config);
      }, timerExp);
    }

    if (debug) {
      console.log("[TP]", "Background Color Changed:", config.backgroundColor);
    }

    clearTimeout(timerGA);
    timerGA = setTimeout(function () {}, timerExp);
    gaEvent("TP", "Background Color Changed", config.backgroundColor);

    // Update URL Params
    clearTimeout(timerURL);
    timerURL = setTimeout(updateURL, timerExp);
    updateURL();
  }

  function updateURL() {
    var custom = Object.assign({}, config);
    var keys = Object.keys(custom);

    keys.forEach(function (key) {
      if (custom[key] === defaultConfig[key]) {
        delete custom[key];
      }
    });

    if (Object.keys(custom).length > 0) {
      var urlParams = new URLSearchParams(custom);
      window.history.pushState(custom, "TelePrompter", "/?" + urlParams);
    } else {
      window.history.pushState(null, "TelePrompter", "/");
    }

    if (debug) {
      console.log("[TP]", "URL Updated:", custom);
    }  
  }

  /**
   * Cambio de color de texto
   */
  function handleTextColor() {
    config.textColor = $elm.textColor.val();

    $elm.teleprompter.css("color", config.textColor);
    localStorage.setItem("teleprompter_text_color", config.textColor);

    if (socket && remote) {
      clearTimeout(emitTimeout);
      emitTimeout = setTimeout(function () {
        socket.emit("clientCommand", "updateConfig", config);
      }, timerExp);
    }

    if (debug) {
      console.log("[TP]", "Text Color Changed:", config.textColor);
    }

    clearTimeout(timerGA);
    timerGA = setTimeout(function () {
      gaEvent("TP", "Text Color Changed", config.textColor);
    }, timerExp);

    // Update URL Params
    clearTimeout(timerURL);
    timerURL = setTimeout(updateURL, timerExp);
    updateURL();
  }

  /**
   * Bton de play que inicializa la animacion del lectura y pausa.
   */
  function handlePlay() {
    if (!isPlaying) {
      startTeleprompter();
    } else {
      stopTeleprompter();
    }
  }

  /**
   * Reseteo de texto.
   */
  function handleReset() {
    stopTeleprompter();
    timer.resetTimer();

    config.pageScrollPercent = 0;

    $elm.article.stop().animate(
      {
        scrollTop: 0,
      },
      100,
      "linear",
      function () {
        $elm.article.clearQueue();
      }
    );

    if (socket && remote) {
      socket.emit("clientCommand", "updateTime", "00:00:00");
      clearTimeout(emitTimeout);
      emitTimeout = setTimeout(function () {
        socket.emit("clientCommand", "updateConfig", config);
      }, timerExp);
    }

    if (debug) {
      console.log("[TP]", "Reset Button Pressed");
    }
  }

  /**
   * Scroll del teleprompter
   */
  function pageScroll() {
    var offset = 1;
    var animate = 0;

    if (config.pageSpeed == 0) {
      $elm.article.stop().clearQueue();
      clearTimeout(scrollDelay);
      scrollDelay = setTimeout(pageScroll, 500);
      return;
    }

    clearTimeout(scrollDelay);
    scrollDelay = setTimeout(pageScroll, Math.floor(50 - config.pageSpeed));

    if ($elm.teleprompter.hasClass("flip-y")) {
      $elm.article.stop().animate(
        {
          scrollTop: "-=" + offset + "px",
        },
        animate,
        "linear",
        function () {
          $elm.article.clearQueue();
        }
      );

      // Si esta al final del documento, se detiene y regresa.
      if ($elm.article.scrollTop() === 0) {
        stopTeleprompter();
        setTimeout(function () {
          $elm.article.stop().animate(
            {
              scrollTop: $elm.teleprompter.height() + 100,
            },
            500,
            "swing",
            function () {
              $elm.article.clearQueue();
            }
          );
        }, 500);
      }
    } else {
      $elm.article.stop().animate(
        {
          scrollTop: "+=" + offset + "px",
        },
        animate,
        "linear",
        function () {
          $elm.article.clearQueue();
        }
      );

      // Si esta al final del docmento lo deteiene.
      if (
        $elm.article.scrollTop() >=
        $elm.article[0].scrollHeight - $elm.window.height() - 100
      ) {
        stopTeleprompter();
        setTimeout(function () {
          $elm.article.stop().animate(
            {
              scrollTop: 0,
            },
            500,
            "swing",
            function () {
              $elm.article.clearQueue();
            }
          );
        }, 500);
      }
    }

    // Update pageScrollPercent
    clearTimeout(timeout);
    timeout = setTimeout(function () {
      $elm.win = $elm.article[0];
      var scrollHeight = $elm.win.scrollHeight;
      var scrollTop = $elm.win.scrollTop;
      var clientHeight = $elm.win.clientHeight;

      config.pageScrollPercent = Math.round(
        (scrollTop / (scrollHeight - clientHeight) + Number.EPSILON) * 100
      );

      if (socket && remote) {
        clearTimeout(emitTimeout);
        emitTimeout = setTimeout(function () {
          socket.emit("clientCommand", "updateConfig", config);
        }, timerExp);
      }
    }, animate);
  }

  //Funcion que  se encarga de actualizar el tamaño de fuente del teleprompter
  function updateFontSize(save, skipUpdate) {
    config.fontSize = $elm.fontSize.slider("value");

    $elm.teleprompter.css({
      "font-size": config.fontSize + "px",
      "line-height": Math.ceil(config.fontSize * 1.5) + "px",
      "padding-bottom":
        Math.ceil($elm.window.height() - $elm.header.height()) + "px",
    });

    $("p", $elm.teleprompter).css({
      "padding-bottom": Math.ceil(config.fontSize * 0.25) + "px",
      "margin-bottom": Math.ceil(config.fontSize * 0.25) + "px",
    });

    $("label.font_size_label > span").text("(" + config.fontSize + ")");

    if (save) {
      localStorage.setItem("teleprompter_font_size", config.fontSize);
    }

    if (socket && remote && !skipUpdate) {
      clearTimeout(emitTimeout);
      emitTimeout = setTimeout(function () {
        socket.emit("clientCommand", "updateConfig", config);
      }, timerExp);
    }

    if (debug) {
      console.log("[TP]", "Font Size Changed:", config.fontSize);
    }

    clearTimeout(timerGA);
    timerGA = setTimeout(function () {
      gaEvent("TP", "Font Size Changed", config.fontSize);
    }, timerExp);

    // Update URL Params
    clearTimeout(timerURL);
    timerURL = setTimeout(updateURL, timerExp);
    updateURL();
  }

  function gaEvent(category, action, label, value) {
    if (typeof gtag !== "undefined") {
      gtag("event", action, {
        event_category: category,
        event_label: label,
        value: value,
      });
    }

    if (debug) {
      console.log("[GA]", category, action, label, value);
    }
  }

  function getUrlVars() {
    var paramCount = 0;
    var vars = {};

    window.location.href.replace(
      /[?&]+([^=&]+)=([^&]*)/gi,
      function (m, key, value) {
        paramCount++;
        vars[key] = value;
      }
    );

    if (debug) {
      console.log("[TP]", "URL Params:", paramCount > 0 ? vars : null);
    }

    return paramCount > 0 ? vars : null;
  }

  /**
   * Manage Speed Change
   * @param {Boolean} save
   * @param {Boolean} skipUpdate
   */
  function updateSpeed(save, skipUpdate) {
    config.pageSpeed = $elm.speed.slider("value");
    $("label.speed_label > span").text("(" + $elm.speed.slider("value") + ")");

    if (save) {
      localStorage.setItem("teleprompter_speed", $elm.speed.slider("value"));
    }

    if (socket && remote && !skipUpdate) {
      clearTimeout(emitTimeout);
      emitTimeout = setTimeout(function () {
        socket.emit("clientCommand", "updateConfig", config);
      }, timerExp);
    }

    if (debug) {
      console.log("[TP]", "Page Speed Changed:", config.pageSpeed);
    }

    clearTimeout(timerGA);
    timerGA = setTimeout(function () {
      gaEvent("TP", "Page Speed Changed", config.pageSpeed);
    }, timerExp);

    // Update URL Params
    clearTimeout(timerURL);
    timerURL = setTimeout(updateURL, timerExp);
    updateURL();
  }

  /**
   *
   * @param {Object} evt
   * @param {Boolean} skipUpdate
   */

  function handleDim(evt, skipUpdate) {
    if (config.dimControls) {
      config.dimControls = false;
      $elm.buttonDimControls
        .removeClass("icon-eye-close")
        .addClass("icon-eye-open");
      $elm.headerContent.fadeTo("slow", 1);
      $elm.markerOverlay.fadeOut("slow");
    } else {
      config.dimControls = true;
      $elm.buttonDimControls
        .removeClass("icon-eye-open")
        .addClass("icon-eye-close");

      if (isPlaying) {
        $elm.headerContent.fadeTo("slow", 0.15);
        $elm.markerOverlay.fadeIn("slow");
      }
    }

    localStorage.setItem("teleprompter_dim_controls", config.dimControls);

    if (socket && remote && !skipUpdate) {
      clearTimeout(emitTimeout);
      emitTimeout = setTimeout(function () {
        socket.emit("clientCommand", "updateConfig", config);
      }, timerExp);
    }

    if (debug) {
      console.log("[TP]", "Dim Control Changed:", config.dimControls);
    }

    clearTimeout(timerGA);
    timerGA = setTimeout(function () {
      gaEvent("TP", "Dim Control Changed", config.dimControls);
    }, timerExp);

    // Update URL Params
    clearTimeout(timerURL);
    timerURL = setTimeout(updateURL, timerExp);
  }

  /**
   * Get App Config
   * @param {String} key
   * @returns Object
   */
  function getConfig(key) {
    return key ? config[key] : config;
  }

  return {
    version: version,
    init: init,
    getConfig: getConfig,
    start: startTeleprompter,
    stop: stopTeleprompter,
    reset: handleReset,
    setDebug: function (bool) {
      debug = !!bool;
      return this;
    },
    setSpeed: function (speed) {
      speed = Math.min(50, Math.max(0, speed));
      $elm.speed.slider("value", parseInt(speed));
      return this;
    },
    setFontSize: function (size) {
      size = Math.min(100, Math.max(12, size));
      $elm.fontSize.slider("value", parseInt(size));
      return this;
    },
    setDim: function (bool) {
      config.dimControls = !bool;
      handleDim();
      return this;
    },
  };
})();

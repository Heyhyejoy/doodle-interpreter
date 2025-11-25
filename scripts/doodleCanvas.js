

(function () {
  const canvas = document.getElementById("doodle-canvas");
  const ctx = canvas.getContext("2d");

  const colorPicker = document.getElementById("color-picker");
  const widthSlider = document.getElementById("stroke-width");
  const widthLabel = document.getElementById("stroke-width-label");
  const clearBtn = document.getElementById("clear-btn");

  const state = {
    strokes: [],
    drawing: false,
    currentStroke: null,
  };

  window.doodleState = state;


  window.doodleCanvas = {
    canvas,
    loadStrokes,
    clearCanvas,
  };


  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    redrawAll();
  }

  function redrawAll() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    state.strokes.forEach((stroke) => {
      drawStroke(stroke);
    });
  }

  function drawStroke(stroke) {
    const pts = stroke.points;
    if (!pts || pts.length === 0) return;

    ctx.strokeStyle = stroke.color || "#000000";
    ctx.lineWidth = stroke.width || 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
  }

  function notifyDoodleChanged() {
    if (typeof window.onDoodleChanged === "function") {
      const copy = state.strokes.map((s) => ({
        color: s.color,
        width: s.width,
        points: s.points.map((p) => ({ x: p.x, y: p.y })),
      }));
      window.onDoodleChanged(copy);
    }
  }

  function getCanvasPos(evt) {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if (evt.touches && evt.touches.length > 0) {
      clientX = evt.touches[0].clientX;
      clientY = evt.touches[0].clientY;
    } else {
      clientX = evt.clientX;
      clientY = evt.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function startStroke(evt) {
    evt.preventDefault();
    const pos = getCanvasPos(evt);
    state.drawing = true;

    const stroke = {
      color: colorPicker ? colorPicker.value : "#000000",
      width: widthSlider ? Number(widthSlider.value) || 4 : 4,
      points: [pos],
    };
    state.currentStroke = stroke;
    state.strokes.push(stroke);

    drawStroke(stroke);
  }

  function moveStroke(evt) {
    if (!state.drawing || !state.currentStroke) return;
    evt.preventDefault();

    const pos = getCanvasPos(evt);
    const pts = state.currentStroke.points;
    pts.push(pos);

    const len = pts.length;
    if (len < 2) return;

    ctx.strokeStyle = state.currentStroke.color;
    ctx.lineWidth = state.currentStroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(pts[len - 2].x, pts[len - 2].y);
    ctx.lineTo(pts[len - 1].x, pts[len - 1].y);
    ctx.stroke();
  }

  function endStroke(evt) {
    if (!state.drawing) return;
    evt.preventDefault();
    state.drawing = false;
    state.currentStroke = null;
    notifyDoodleChanged();
  }

  function clearCanvas() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    state.strokes = [];
    state.currentStroke = null;
    notifyDoodleChanged();
  }

  function loadStrokes(strokes) {
    state.strokes =
      strokes && Array.isArray(strokes)
        ? strokes.map((s) => ({
            color: s.color || "#000000",
            width: s.width || 4,
            points: (s.points || []).map((p) => ({
              x: p.x,
              y: p.y,
            })),
          }))
        : [];

    redrawAll();
  }


  if (widthSlider && widthLabel) {
    widthLabel.textContent = widthSlider.value + "px";
    widthSlider.addEventListener("input", () => {
      widthLabel.textContent = widthSlider.value + "px";
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", clearCanvas);
  }

  // mouse
  canvas.addEventListener("mousedown", startStroke);
  canvas.addEventListener("mousemove", moveStroke);
  window.addEventListener("mouseup", endStroke);

  // touch
  canvas.addEventListener(
    "touchstart",
    (e) => {
      startStroke(e);
    },
    { passive: false }
  );
  canvas.addEventListener(
    "touchmove",
    (e) => {
      moveStroke(e);
    },
    { passive: false }
  );
  window.addEventListener(
    "touchend",
    (e) => {
      endStroke(e);
    },
    { passive: false }
  );

  // resize
  window.addEventListener("resize", () => {
    resizeCanvas();
  });

  // initial sizing
  resizeCanvas();
})();

// Handles drawing on the canvas and storing strokes

window.doodleState = {
  strokes: [],
  currentStroke: null,
};

window.doodleCanvas = (function () {
  const canvas = document.getElementById("doodle-canvas");
  const ctx = canvas.getContext("2d");

  // Resize canvas 
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    redrawAll();
  }

  // Redraw all saved strokes
  function redrawAll() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "#f9fafb";
    ctx.fillRect(0, 0, rect.width, rect.height);

    window.doodleState.strokes.forEach((stroke) => {
      drawStroke(stroke);
    });
  }

  // Draw a single stroke
  function drawStroke(stroke) {
    if (!stroke.points || stroke.points.length === 0) return;
    const pts = stroke.points;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
  }

  // Start a new stroke
  function startStroke(x, y) {
    const color = document.getElementById("color-picker").value;
    const width = parseInt(
      document.getElementById("stroke-width").value,
      10
    );

    const stroke = {
      color,
      width,
      points: [{ x, y }],
    };
    window.doodleState.currentStroke = stroke;
    window.doodleState.strokes.push(stroke);
  }

  // Keep drawing while pointer moves
  function continueStroke(x, y) {
    const stroke = window.doodleState.currentStroke;
    if (!stroke) return;
    stroke.points.push({ x, y });
    drawStroke(stroke);
  }

  // Finish current stroke
  function endStroke() {
    window.doodleState.currentStroke = null;
  }

  function getCanvasCoords(evt) {
    const rect = canvas.getBoundingClientRect();
    const isTouch = evt.touches && evt.touches.length > 0;
    const clientX = isTouch ? evt.touches[0].clientX : evt.clientX;
    const clientY = isTouch ? evt.touches[0].clientY : evt.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  let drawing = false;

  function pointerDown(evt) {
    evt.preventDefault();
    const { x, y } = getCanvasCoords(evt);
    drawing = true;
    startStroke(x, y);
  }

  function pointerMove(evt) {
    if (!drawing) return;
    evt.preventDefault();
    const { x, y } = getCanvasCoords(evt);
    continueStroke(x, y);
  }

  function pointerUp(evt) {
    if (!drawing) return;
    evt.preventDefault();
    drawing = false;
    endStroke();
  }

  // Mouse events
  canvas.addEventListener("mousedown", pointerDown);
  canvas.addEventListener("mousemove", pointerMove);
  window.addEventListener("mouseup", pointerUp);

  // Touch events
  canvas.addEventListener("touchstart", pointerDown, { passive: false });
  canvas.addEventListener("touchmove", pointerMove, { passive: false });
  window.addEventListener("touchend", pointerUp);

  // Handle window resize
  window.addEventListener("resize", () => {
    const oldStrokes = window.doodleState.strokes;
    resizeCanvas();
    window.doodleState.strokes = oldStrokes;
    redrawAll();
  });

  resizeCanvas();

  // Clear button
  const clearBtn = document.getElementById("clear-canvas-btn");
  clearBtn.addEventListener("click", () => {
    window.doodleState.strokes = [];
    redrawAll();
  });

  const strokeWidthInput = document.getElementById("stroke-width");
  const strokeWidthLabel = document.getElementById("stroke-width-label");
  strokeWidthInput.addEventListener("input", (e) => {
    strokeWidthLabel.textContent = `${e.target.value} px`;
  });

  return {
    canvas,
    redrawAll,
  };
})();

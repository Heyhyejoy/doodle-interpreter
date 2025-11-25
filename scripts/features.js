// Stroke feature extraction, simple shape detection, and doodle summarization

function getBounds(points) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  points.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function analyzeStrokes(strokes, canvasWidth, canvasHeight) {
  if (!strokes || strokes.length === 0) {
    return {
      hasStrokes: false,
      colors: [],
      strokeCount: 0,
      totalLength: 0,
      totalPoints: 0,
      avgX: canvasWidth / 2,
      avgY: canvasHeight / 2,
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      dominantArea: "center",
      complexity: "minimal",
      energy: "calm",
      directionChanges: 0,
    };
  }

  const colors = new Set();
  let strokeCount = strokes.length;
  let totalLength = 0;
  let totalPoints = 0;
  let sumX = 0;
  let sumY = 0;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let directionChanges = 0;
  let previousAngle = null;

  strokes.forEach((s) => {
    colors.add(s.color);
    const pts = s.points;
    if (pts.length < 2) return;

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      sumX += p.x;
      sumY += p.y;
      totalPoints++;

      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;

      if (i > 0) {
        const dx = p.x - pts[i - 1].x;
        const dy = p.y - pts[i - 1].y;
        const segLen = Math.sqrt(dx * dx + dy * dy);
        totalLength += segLen;

        const angle = Math.atan2(dy, dx);
        if (previousAngle !== null) {
          const diff = Math.abs(angle - previousAngle);
          if (diff > Math.PI / 4) {
            directionChanges++;
          }
        }
        previousAngle = angle;
      }
    }
  });

  const avgX = totalPoints > 0 ? sumX / totalPoints : canvasWidth / 2;
  const avgY = totalPoints > 0 ? sumY / totalPoints : canvasHeight / 2;

  let dominantArea = "center";
  if (avgY < canvasHeight * 0.33) {
    dominantArea = "top";
  } else if (avgY > canvasHeight * 0.66) {
    dominantArea = "bottom";
  }

  let complexity = "minimal";
  if (strokeCount > 15 || directionChanges > 40) {
    complexity = "very busy";
  } else if (strokeCount > 7 || directionChanges > 20) {
    complexity = "moderately busy";
  }

  let energy = "calm";
  if (totalLength > canvasWidth * 5) {
    energy = "energetic";
  } else if (totalLength > canvasWidth * 2.5) {
    energy = "dynamic";
  }

  return {
    hasStrokes: true,
    colors: Array.from(colors),
    strokeCount,
    totalLength,
    totalPoints,
    avgX,
    avgY,
    minX,
    maxX,
    minY,
    maxY,
    dominantArea,
    complexity,
    energy,
    directionChanges,
  };
}

// ---------- basic helpers ----------

function isClosedStroke(points, threshold = 20) {
  if (points.length < 4) return false;
  const first = points[0];
  const last = points[points.length - 1];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < threshold;
}

function countDirectionChanges(pts) {
  let prevAngle = null;
  let changes = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    const angle = Math.atan2(dy, dx);
    if (prevAngle !== null) {
      const diff = Math.abs(angle - prevAngle);
      if (diff > Math.PI / 6) changes++;
    }
    prevAngle = angle;
  }
  return changes;
}

// circle-like detection

function detectCircleLike(points) {
  if (points.length < 8) return false;

  const closedEnough = isClosedStroke(points, 45);
  if (!closedEnough) return false;

  const b = getBounds(points);
  const { w, h, minX, maxX, minY, maxY } = b;
  if (w < 20 || h < 20) return false;

  const aspect = w / (h || 1);
  if (aspect < 0.6 || aspect > 1.4) return false;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const distances = points.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return Math.sqrt(dx * dx + dy * dy);
  });

  const avg = distances.reduce((a, b) => a + b, 0) / distances.length;
  const variance =
    distances.reduce((acc, d) => acc + Math.pow(d - avg, 2), 0) /
    distances.length;
  const std = Math.sqrt(variance);

  return std / (avg || 1) < 0.55;
}

// heart-like detection

function detectHeartLike(points) {
  if (!isClosedStroke(points, 45)) return false;

  const b = getBounds(points);
  const { w, h, minX, maxX, minY, maxY } = b;
  if (w < 20 || h < 30) return false;

  const aspect = w / (h || 1);
  if (aspect < 0.5 || aspect > 1.1) return false;

  const cx = (minX + maxX) / 2;

  // bottom point near center
  let bottomPoint = null;
  points.forEach((p) => {
    if (Math.abs(p.x - cx) < w * 0.25) {
      if (!bottomPoint || p.y > bottomPoint.y) {
        bottomPoint = p;
      }
    }
  });

  if (!bottomPoint) return false;
  if (bottomPoint.y < minY + h * 0.6) return false;

  let topLeftCount = 0;
  let topRightCount = 0;
  const topThreshold = minY + h * 0.4;
  points.forEach((p) => {
    if (p.y < topThreshold) {
      if (p.x < cx) topLeftCount++;
      else topRightCount++;
    }
  });

  return topLeftCount > 5 && topRightCount > 5;
}

// ---------- line-like detection ----------

function detectLineLike(points) {
  if (points.length < 2) return false;

  const first = points[0];
  const last = points[points.length - 1];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 40) return false;

  const denom = length || 1;
  let maxDist = 0;
  points.forEach((p) => {
    const num =
      Math.abs(dy * p.x - dx * p.y + last.x * first.y - last.y * first.x);
    const d = num / denom;
    if (d > maxDist) maxDist = d;
  });

  return maxDist < 8;
}


function findFaceOutline(strokes) {
  let biggestCircle = null;

  strokes.forEach((s) => {
    const pts = s.points;
    if (!detectCircleLike(pts)) return;
    const b = getBounds(pts);
    const size = b.w * b.h;
    if (!biggestCircle || size > biggestCircle.size) {
      biggestCircle = {
        ...b,
        stroke: s,
        size,
      };
    }
  });

  return biggestCircle;
}

function detectEyes(strokes, face) {
  if (!face) return [];

  const eyes = [];
  strokes.forEach((s) => {
    const pts = s.points;
    if (!detectCircleLike(pts)) return;

    const b = getBounds(pts);
    if (b.w > face.w * 0.3 || b.h > face.h * 0.3) return;

    const centerX = (b.minX + b.maxX) / 2;
    const centerY = (b.minY + b.maxY) / 2;

    if (centerY < face.minY + face.h * 0.5) {
      eyes.push({ x: centerX, y: centerY, bounds: b });
    }
  });

  return eyes.length >= 2 ? eyes : [];
}

function detectMouth(strokes, face) {
  if (!face) return null;

  for (const s of strokes) {
    const pts = s.points;
    const b = getBounds(pts);

    if (detectCircleLike(pts)) continue;

    const centerY = (b.minY + b.maxY) / 2;
    if (centerY < face.minY + face.h * 0.55) continue;

    if (b.w < face.w * 0.3) continue;
    if (b.w < b.h * 2) continue;

    const changes = countDirectionChanges(pts);
    if (changes < 2 || changes > 30) continue;

    return { bounds: b, stroke: s };
  }

  return null;
}


function detectShapes(strokes) {
  const shapes = [];

  strokes.forEach((stroke) => {
    const pts = stroke.points;
    if (!pts || pts.length < 4) return;

    // heart 먼저, 그다음 circle, 마지막 line
    if (detectHeartLike(pts)) {
      shapes.push({ type: "heart-like", color: stroke.color });
    } else if (detectCircleLike(pts)) {
      shapes.push({ type: "circle-like", color: stroke.color });
    } else if (detectLineLike(pts)) {
      shapes.push({ type: "line", color: stroke.color });
    }
  });

  const smiley = detectSmileyFace(strokes);
  if (smiley) {
    shapes.push({ type: "smiley-face", color: null });
  }

  return shapes;
}

// ---------- Summarizer for LLM prompt ----------

function summarizeDoodle(strokes, canvasWidth, canvasHeight) {
  const m = analyzeStrokes(strokes, canvasWidth, canvasHeight);
  if (!m.hasStrokes) return "No strokes drawn.";

  const colorList = m.colors.length > 0 ? m.colors.join(", ") : "none";
  const shapes = detectShapes(strokes);

  let shapeSummary = "No specific shapes confidently detected.";
  if (shapes.length > 0) {
    const counts = shapes.reduce((acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1;
      return acc;
    }, {});
    const parts = Object.entries(counts).map(
      ([type, count]) => `${count} × ${type}`
    );
    shapeSummary = parts.join(", ");
  }

  const summary = `
Colors used (raw hex): ${colorList}
Stroke count: ${m.strokeCount}
Overall complexity: ${m.complexity}
Line energy: ${m.energy}
Dominant area on canvas: ${m.dominantArea}
Direction changes (sharp turns): ${m.directionChanges}
Detected shapes (rough heuristic): ${shapeSummary}
`;

  return summary.trim();
}

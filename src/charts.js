// Premium Sparkline and Interactive Chart Renderer using HTML5 Canvas
// Highly polished, zero-dependency, and fully responsive.

export function renderSparkline(canvas, historyData, range = '5Y', theme = 'light', onHover = null) {
  if (!canvas || !historyData || historyData.length === 0) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Filter history based on range
  const filteredData = filterDataByRange(historyData, range);
  if (filteredData.length === 0) return;

  // Setup high-DPI canvas resolution
  setupCanvasDPI(canvas, ctx);

  const width = canvas.width;
  const height = canvas.height;
  const paddingLeft = 10;
  const paddingRight = 10;
  const paddingTop = 15;
  const paddingBottom = 15;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Find min and max values for scaling
  const values = filteredData.map(d => d.value);
  let maxVal = Math.max(...values);
  let minVal = Math.min(...values);

  // If min and max are the same, pad them
  if (maxVal === minVal) {
    maxVal += 1;
    minVal -= 1;
  } else {
    // Add small buffer to top and bottom (10% of range)
    const valRange = maxVal - minVal;
    maxVal += valRange * 0.1;
    minVal -= valRange * 0.1;
  }

  // Get coordinates for each data point
  const points = filteredData.map((d, index) => {
    const x = paddingLeft + (index / (filteredData.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((d.value - minVal) / (maxVal - minVal)) * chartHeight;
    return { x, y, val: d.value, date: d.date };
  });

  // Color theme setup
  const isDark = theme === 'dark';
  const lineColor = isDark ? '#6366f1' : '#4f46e5'; // Indigo primary
  const gradientStart = isDark ? 'rgba(99, 102, 241, 0.25)' : 'rgba(79, 70, 229, 0.15)';
  const gradientEnd = isDark ? 'rgba(99, 102, 241, 0.0)' : 'rgba(79, 70, 229, 0.0)';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)';
  const dotColor = isDark ? '#22d3ee' : '#06b6d4'; // Cyan accent
  const guideLineColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';

  let activeIndex = -1;

  // Draw function
  function draw() {
    ctx.clearRect(0, 0, width, height);

    // 1. Draw horizontal grid lines (zero line, min, max, mid)
    drawGridLines(ctx, width, height, minVal, maxVal, paddingTop, paddingBottom, chartHeight, gridColor);

    // 2. Draw historical line
    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    points.forEach((pt, idx) => {
      if (idx === 0) {
        ctx.moveTo(pt.x, pt.y);
      } else {
        // Curve to make it look smooth (bezier)
        const prev = points[idx - 1];
        const xc = (prev.x + pt.x) / 2;
        const yc = (prev.y + pt.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, xc, yc);
      }
    });
    // Finish curve to last point
    if (points.length > 1) {
      const last = points[points.length - 1];
      const secondLast = points[points.length - 2];
      ctx.lineTo(last.x, last.y);
    }
    ctx.stroke();

    // 3. Draw gradient fill underneath
    ctx.beginPath();
    ctx.moveTo(points[0].x, paddingTop + chartHeight);
    points.forEach((pt, idx) => {
      if (idx === 0) {
        ctx.lineTo(pt.x, pt.y);
      } else {
        const prev = points[idx - 1];
        const xc = (prev.x + pt.x) / 2;
        const yc = (prev.y + pt.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, xc, yc);
      }
    });
    if (points.length > 1) {
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
    }
    ctx.lineTo(points[points.length - 1].x, paddingTop + chartHeight);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartHeight);
    gradient.addColorStop(0, gradientStart);
    gradient.addColorStop(1, gradientEnd);
    ctx.fillStyle = gradient;
    ctx.fill();

    // 4. Draw active interactive overlay (if mouse is hovering)
    if (activeIndex >= 0 && activeIndex < points.length) {
      const activePt = points[activeIndex];

      // Draw vertical guide line
      ctx.beginPath();
      ctx.strokeStyle = guideLineColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.moveTo(activePt.x, paddingTop);
      ctx.lineTo(activePt.x, paddingTop + chartHeight);
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash

      // Draw interactive pulsing outer ring
      ctx.beginPath();
      ctx.arc(activePt.x, activePt.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? 'rgba(34, 211, 244, 0.3)' : 'rgba(6, 182, 212, 0.25)';
      ctx.fill();

      // Draw interactive solid inner dot
      ctx.beginPath();
      ctx.arc(activePt.x, activePt.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = dotColor;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    } else {
      // Draw a subtle dot on the very last data point by default
      const lastPt = points[points.length - 1];
      ctx.beginPath();
      ctx.arc(lastPt.x, lastPt.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();
    }
  }

  // Draw first frame
  draw();

  // Mouse interactivity handlers
  function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    // Scale event coordinates to canvas space
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    
    // Find closest point by X coordinate
    let closestIndex = 0;
    let minDiff = Infinity;

    points.forEach((pt, idx) => {
      const diff = Math.abs(pt.x - mouseX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = idx;
      }
    });

    if (closestIndex !== activeIndex) {
      activeIndex = closestIndex;
      draw();
      
      if (onHover) {
        onHover({
          date: points[activeIndex].date,
          value: points[activeIndex].val
        });
      }
    }
  }

  function handleMouseLeave() {
    if (activeIndex !== -1) {
      activeIndex = -1;
      draw();
      if (onHover) {
        onHover(null); // Reset to latest
      }
    }
  }

  // Bind event listeners to canvas
  canvas.removeEventListener('mousemove', canvas._mouseMoveHandler);
  canvas.removeEventListener('mouseleave', canvas._mouseLeaveHandler);

  canvas._mouseMoveHandler = handleMouseMove;
  canvas._mouseLeaveHandler = handleMouseLeave;

  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseleave', handleMouseLeave);
}

// Clean helper to slice data based on range
function filterDataByRange(history, range) {
  if (range === 'MAX' || range === 'ALL') {
    return history;
  }

  const latestDateStr = history[history.length - 1].date;
  const latestDate = new Date(latestDateStr);
  const cutoffDate = new Date(latestDate);

  if (range === '1Y') {
    cutoffDate.setFullYear(latestDate.getFullYear() - 1);
  } else if (range === '5Y') {
    cutoffDate.setFullYear(latestDate.getFullYear() - 5);
  }

  return history.filter(item => new Date(item.date) >= cutoffDate);
}

// Setup DPI canvas scaling for crisp UI lines
function setupCanvasDPI(canvas, ctx) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  
  ctx.scale(dpr, dpr);
  
  // Set back styling width/height
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
}

// Helper to draw horizontal lines
function drawGridLines(ctx, width, height, min, max, paddingTop, paddingBottom, chartHeight, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  
  // Calculate zero line if cross zero
  if (min < 0 && max > 0) {
    const zeroY = paddingTop + chartHeight - ((0 - min) / (max - min)) * chartHeight;
    ctx.beginPath();
    ctx.setLineDash([2, 2]);
    ctx.moveTo(0, zeroY);
    ctx.lineTo(width, zeroY);
    ctx.stroke();
  }

  // Draw minor bounds lines (top, middle, bottom)
  const lineYValues = [
    paddingTop,
    paddingTop + chartHeight / 2,
    paddingTop + chartHeight
  ];

  ctx.beginPath();
  ctx.setLineDash([]);
  lineYValues.forEach(y => {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  });
  ctx.stroke();
  ctx.restore();
}

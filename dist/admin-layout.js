(() => {
  const layout = document.querySelector('.editor-layout');
  const divider = document.getElementById('paneDivider');
  const editor = document.getElementById('editorPanel');
  const preferenceKey = 'mgtu-admin-pane-width';
  const saved = MGTU_read(preferenceKey, null);
  let desiredWidth = typeof saved === 'number' && Number.isFinite(saved) ? saved : null;
  let drag = null;
  let lastLayoutWidth = 0;

  function bounds() {
    const available = layout.clientWidth - divider.offsetWidth;
    return {
      available,
      min: Math.min(280, available * .4),
      max: available - Math.min(300, available * .4)
    };
  }

  function applyWidth() {
    if (window.innerWidth <= 760) return;
    const {available, min, max} = bounds();
    const width = Math.max(min, Math.min(max, desiredWidth ?? Math.min(420, available * .4)));
    layout.style.setProperty('--editor-pane-width', `${width}px`);
    divider.setAttribute('aria-valuemin', Math.round(min));
    divider.setAttribute('aria-valuemax', Math.round(max));
    divider.setAttribute('aria-valuenow', Math.round(width));
    divider.setAttribute('aria-valuetext', `Настройки: ${Math.round(width)} пикселей; предпросмотр: ${Math.round(available - width)} пикселей`);
  }

  function finishDrag(event) {
    if (!drag || (event?.pointerId != null && event.pointerId !== drag.id)) return;
    const pointerId = drag.id;
    drag = null;
    document.body.classList.remove('resizing-panes');
    if (divider.hasPointerCapture(pointerId)) divider.releasePointerCapture(pointerId);
    MGTU_write(preferenceKey, desiredWidth);
  }

  divider.addEventListener('pointerdown', event => {
    if (event.button !== 0 || window.innerWidth <= 760) return;
    event.preventDefault();
    drag = {id: event.pointerId, x: event.clientX, width: editor.getBoundingClientRect().width};
    divider.focus({preventScroll: true});
    divider.setPointerCapture(event.pointerId);
    document.body.classList.add('resizing-panes');
  });
  divider.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const {min, max} = bounds();
    desiredWidth = Math.max(min, Math.min(max, drag.width + event.clientX - drag.x));
    applyWidth();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(name => divider.addEventListener(name, finishDrag));
  window.addEventListener('blur', () => finishDrag());

  function resetWidth() {
    desiredWidth = null;
    applyWidth();
    MGTU_write(preferenceKey, null);
  }
  divider.addEventListener('dblclick', resetWidth);
  divider.addEventListener('keydown', event => {
    if (window.innerWidth <= 760) return;
    const {min, max} = bounds();
    const step = event.shiftKey ? 40 : 16;
    if (event.key === 'ArrowLeft') desiredWidth = editor.getBoundingClientRect().width - step;
    else if (event.key === 'ArrowRight') desiredWidth = editor.getBoundingClientRect().width + step;
    else if (event.key === 'Home') desiredWidth = min;
    else if (event.key === 'End') desiredWidth = max;
    else if (event.key === 'Enter') { event.preventDefault(); resetWidth(); return; }
    else return;
    event.preventDefault();
    desiredWidth = Math.max(min, Math.min(max, desiredWidth));
    applyWidth();
    MGTU_write(preferenceKey, desiredWidth);
  });

  new ResizeObserver(() => {
    if (layout.clientWidth === lastLayoutWidth) return;
    lastLayoutWidth = layout.clientWidth;
    applyWidth();
  }).observe(layout);
  applyWidth();
})();

export const flushSurroundingMarkers = (element: HTMLElement, marker: string) => {
  const leftMarker = element.previousElementSibling;
  if (
    leftMarker?.tagName === 'SPAN'
    && leftMarker.classList.contains('md-marker')
    && leftMarker.textContent === marker
  ) {
    leftMarker.textContent = '';
  }
  const rightMarker = element.nextElementSibling;
  if (
    rightMarker?.tagName === 'SPAN'
    && rightMarker.classList.contains('md-marker')
    && rightMarker.textContent === marker
  ) {
    rightMarker.textContent = '';
  }
};

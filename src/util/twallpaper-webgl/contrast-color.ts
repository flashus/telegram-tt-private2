export const contrastColor = (color: string): string => {
  // Remove # if present
  const hex = color.replace('#', '');

  // Convert hex to RGB
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Increase contrast by making dark colors darker and light colors lighter
  const contrastFactor = 0.3; // Adjust this value to control contrast intensity

  let newR = r;
  let newG = g;
  let newB = b;

  if (luminance > 0.5) {
    // For light colors, make them lighter
    newR = Math.min(255, Math.round(r * (1 + contrastFactor)));
    newG = Math.min(255, Math.round(g * (1 + contrastFactor)));
    newB = Math.min(255, Math.round(b * (1 + contrastFactor)));
  } else {
    // For dark colors, make them darker
    newR = Math.round(r * (1 - contrastFactor));
    newG = Math.round(g * (1 - contrastFactor));
    newB = Math.round(b * (1 - contrastFactor));
  }

  // Convert back to hex
  const newHex = `#${newR.toString(16).padStart(2, '0')}`
    + `${newG.toString(16).padStart(2, '0')}`
    + `${newB.toString(16).padStart(2, '0')}`;

  return newHex;
};

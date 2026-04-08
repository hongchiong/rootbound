export function intToHexColor(int) {
  return '#' + int.toString(16).padStart(6, '0');
}

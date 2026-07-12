import sharp from "sharp";
// Icono: martillo/mazo simplificado sobre azul institucional, esquinas suaves.
const svg = (size, padded=false) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="${padded ? 0 : 96}" fill="#3555b8"/>
  <g transform="translate(256 250) scale(${padded ? 0.72 : 0.92}) translate(-256 -250)">
    <g stroke="#ffffff" stroke-width="34" stroke-linecap="round" fill="none">
      <path d="M198 142 L318 262"/>
      <path d="M162 178 L234 106"/>
      <path d="M282 298 L354 226"/>
      <path d="M258 222 L120 360"/>
    </g>
    <rect x="240" y="368" width="180" height="34" rx="17" fill="#ffffff"/>
  </g>
</svg>`;
await sharp(Buffer.from(svg(512))).png().toFile("public/icons/icon-512.png");
await sharp(Buffer.from(svg(512))).resize(192,192).png().toFile("public/icons/icon-192.png");
await sharp(Buffer.from(svg(512, true))).png().toFile("public/icons/icon-512-maskable.png");
console.log("icons ok");

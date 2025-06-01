// ------------------------------
// 1. Map initialization
// ------------------------------
const map = L.map('map').setView([43.7, -79.4], 12);
L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    minZoom: 1,
    maxZoom: 19,
    detectRetina: true
  }
).addTo(map);

// ------------------------------
// 2. Data holders & layers
// ------------------------------
const markersLayer = L.layerGroup().addTo(map);
let circleLayer;
const errorDiv = document.getElementById('error');
let facilitiesData = null;
let fsaCentroids = [];
// Load FSA centroids (single fetch, correct path)
fetch('../data/fsa_centroids.json')
  .then(res => res.json())
  .then(json => { fsaCentroids = json.features; })
  .catch(() => alert('Failed to load FSA centroids'));

// Parks & Community Centres GeoJSON (correct path)
fetch('../data/Parks and Recreation Facilities - 4326.geojson')
  .then(res => res.json())
  .then(json => { facilitiesData = json; })
  .catch(() => alert('Failed to load facilities data'));

// ------------------------------
// 4. Search & plot function
// ------------------------------
function searchPostalCode() {
  // 4.1 Clear previous error
  errorDiv.textContent = '';

  // 4.2 Read & normalize input
  const raw = document.getElementById('postalInput').value.trim().toUpperCase();
  if (!raw) return;
  const fsa = raw.replace(/\s+/g, '').slice(0, 3);

  // 4.3 Lookup FSA in local centroids
  const feat = fsaCentroids.find(f => f.properties.FSA === fsa);
  if (!feat) {
    errorDiv.textContent = 'Invalid Toronto postal code';
    return;
  }

  // 4.4 Get center point
  const [lon, lat] = feat.geometry.coordinates;
  const center = L.latLng(lat, lon);

  // 4.5 Clear old layers
  markersLayer.clearLayers();
  if (circleLayer) map.removeLayer(circleLayer);

  // 4.6 Draw 2 km circle & zoom to it
  circleLayer = L.circle(center, { radius: 2000, color: 'green', fill: false })
    .addTo(map);
  map.fitBounds(circleLayer.getBounds());

  // 4.7 Plot facilities within the circle
  facilitiesData.features.forEach(f => {
    // unwrap MultiPoint vs Point
    const coords = f.geometry.type === 'MultiPoint'
      ? f.geometry.coordinates[0]
      : f.geometry.coordinates;
    const [lon0, lat0] = coords;

    // skip if outside 2 km
    if (map.distance(center, [lat0, lon0]) > 2000) return;

    // style by type
    const color = f.properties.TYPE.toLowerCase().includes('park') ? 'blue' : 'red';

    // add marker with popup
    L.circleMarker([lat0, lon0], {
      radius: 6,
      color,
      fillColor: color,
      fillOpacity: 1
    })
    .bindPopup(`
      <h3>${
        f.properties.URL
          ? `<a href="${f.properties.URL}" target="_blank">${f.properties.ASSET_NAME}</a>`
          : f.properties.ASSET_NAME
      }</h3>
      <p><strong>Amenities:</strong> ${f.properties.AMENITIES}</p>
      <p><strong>Kids friendly:</strong> ${
        /kids|playground/i.test(f.properties.AMENITIES) ? 'Yes' : 'No'
      }</p>
      <p><strong>Dogs friendly:</strong> ${
        /dog/i.test(f.properties.AMENITIES) ? 'Yes' : 'No'
      }</p>
      ${
        f.properties.PHONE && f.properties.PHONE !== 'None'
          ? `<p><strong>Phone:</strong> ${f.properties.PHONE}</p>`
          : ``
      }
    `)
    .addTo(markersLayer);
  });
}

// ------------------------------
// 5. Wire up UI events
// ------------------------------
document.getElementById('searchBtn').addEventListener('click', searchPostalCode);
document.getElementById('postalInput').addEventListener('keyup', e => {
  if (e.key === 'Enter') searchPostalCode();
});

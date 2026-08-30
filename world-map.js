/**
 * ULTRON 2 — INTERACTIVE GEOSPATIAL & REAL-TIME WEATHER RADAR
 * Integrates Leaflet (CartoDB Dark Matter) + Nominatim Reverse Geocoder + Open-Meteo Weather API
 */

class UltronGeoRadar {
  constructor(mapContainerId) {
    this.containerId = mapContainerId;
    this.map = null;
    this.marker = null;
    this.currentLocationData = null;

    this.coordsEl = document.getElementById('map-target-coords');
    this.nameEl = document.getElementById('map-target-name');
    this.weatherContainer = document.getElementById('map-weather-telemetry');
    this.tempEl = document.getElementById('wt-temp');
    this.condEl = document.getElementById('wt-condition');
    this.windEl = document.getElementById('wt-wind');
    this.humidEl = document.getElementById('wt-humidity');
    this.insertBtn = document.getElementById('btn-insert-coords-prompt');

    try {
      this.init();
    } catch (e) {
      console.warn("Leaflet map initialized with fallback:", e);
    }
  }

  init() {
    const mapElement = document.getElementById(this.containerId);
    if (!mapElement || typeof L === 'undefined') return;

    // 1. Initialize Leaflet Map
    this.map = L.map(this.containerId, {
      center: [20, 0],
      zoom: 2,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: true
    });

    // 2. CartoDB Dark Matter Tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB &copy; OpenStreetMap contributors',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(this.map);

    // 3. Custom Monochrome SVG Marker Icon
    const customPinIcon = L.divIcon({
      className: 'custom-geo-pin',
      html: `<div style="width:14px; height:14px; background:#FFFFFF; border:2px solid #000000; border-radius:50%; box-shadow:0 0 10px #FFFFFF;"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    // 4. Map Click Handler
    this.map.on('click', async (e) => {
      try {
        const { lat, lng } = e.latlng;

        if (this.marker) {
          this.marker.setLatLng([lat, lng]);
        } else {
          this.marker = L.marker([lat, lng], { icon: customPinIcon }).addTo(this.map);
        }

        if (this.coordsEl) this.coordsEl.textContent = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
        if (this.nameEl) this.nameEl.textContent = "Resolving telemetry...";
        if (this.weatherContainer) {
          this.weatherContainer.style.display = 'none';
          this.weatherContainer.classList.add('hidden');
        }

        await Promise.all([
          this.reverseGeocode(lat, lng),
          this.fetchRealtimeWeather(lat, lng)
        ]);
      } catch (err) {}
    });

    // 5. Inject Location into Prompt Listener
    this.insertBtn?.addEventListener('click', () => {
      if (!this.currentLocationData) return;
      const promptInput = document.getElementById('prompt-textarea');
      if (promptInput) {
        const snippet = `[Location Context: ${this.currentLocationData.name} (${this.currentLocationData.coords}) | Weather: ${this.currentLocationData.weatherSummary || 'N/A'}] `;
        promptInput.value = snippet + promptInput.value;
        promptInput.focus();
      }
    });
  }

  async reverseGeocode(lat, lng) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      
      const city = data.address.city || data.address.town || data.address.village || data.address.county || "Unknown Location";
      const country = data.address.country || "Global Region";
      const fullLocation = `${city}, ${country}`;

      if (this.nameEl) this.nameEl.textContent = fullLocation;

      this.currentLocationData = {
        name: fullLocation,
        coords: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        weatherSummary: ""
      };
    } catch (err) {
      if (this.nameEl) this.nameEl.textContent = `Lat: ${lat.toFixed(2)}, Lon: ${lng.toFixed(2)}`;
      this.currentLocationData = {
        name: `Lat: ${lat.toFixed(2)}, Lon: ${lng.toFixed(2)}`,
        coords: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        weatherSummary: ""
      };
    }
  }

  async fetchRealtimeWeather(lat, lng) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`;
      const res = await fetch(url);
      const data = await res.json();

      if (data && data.current) {
        const cur = data.current;
        const conditionDesc = this.mapWmoCodeToText(cur.weather_code);

        if (this.tempEl) this.tempEl.textContent = `${cur.temperature_2m} °C`;
        if (this.condEl) this.condEl.textContent = conditionDesc;
        if (this.windEl) this.windEl.textContent = `${cur.wind_speed_10m} km/h`;
        if (this.humidEl) this.humidEl.textContent = `${cur.relative_humidity_2m}%`;

        if (this.weatherContainer) {
          this.weatherContainer.style.display = 'block';
          this.weatherContainer.classList.remove('hidden');
        }

        if (this.currentLocationData) {
          this.currentLocationData.weatherSummary = `${cur.temperature_2m}°C, ${conditionDesc}, Wind ${cur.wind_speed_10m}km/h`;
        }

        if (this.marker) {
          this.marker.bindPopup(`
            <div style="font-size:11px; line-height:1.4;">
              <strong style="color:#FFF;">${this.currentLocationData ? this.currentLocationData.name : 'Target'}</strong><br/>
              <span style="color:#A1A1AA;">Temp:</span> ${cur.temperature_2m} °C<br/>
              <span style="color:#A1A1AA;">Status:</span> ${conditionDesc}
            </div>
          `).openPopup();
        }
      }
    } catch (err) {}
  }

  mapWmoCodeToText(code) {
    const map = {
      0: "Clear Sky",
      1: "Mainly Clear",
      2: "Partly Cloudy",
      3: "Overcast",
      45: "Fog",
      48: "Depositing Rime Fog",
      51: "Light Drizzle",
      53: "Moderate Drizzle",
      55: "Dense Drizzle",
      61: "Slight Rain",
      63: "Moderate Rain",
      65: "Heavy Rain",
      71: "Slight Snow",
      73: "Moderate Snow",
      75: "Heavy Snow",
      95: "Thunderstorm"
    };
    return map[code] || "Variable Cloudiness";
  }

  invalidateSize() {
    if (this.map) {
      setTimeout(() => {
        try { this.map.invalidateSize(); } catch (e) {}
      }, 100);
    }
  }
}

// Global hook with safety check
let ultronMapRadar = null;
document.addEventListener('DOMContentLoaded', () => {
  try {
    ultronMapRadar = new UltronGeoRadar('leaflet-map');

    const btnMapToggle = document.getElementById('btn-open-map-toggle');
    const btnCloseMap = document.getElementById('btn-close-map');
    const geospatialPanel = document.getElementById('geospatial-panel');

    const togglePanel = () => {
      if (!geospatialPanel) return;
      const isHidden = geospatialPanel.style.display === 'none' || geospatialPanel.classList.contains('hidden');
      if (isHidden) {
        geospatialPanel.style.display = 'block';
        geospatialPanel.classList.remove('hidden');
        ultronMapRadar?.invalidateSize();
      } else {
        geospatialPanel.style.display = 'none';
        geospatialPanel.classList.add('hidden');
      }
    };

    btnMapToggle?.addEventListener('click', togglePanel);
    btnCloseMap?.addEventListener('click', togglePanel);
  } catch (e) {
    console.warn("Map bootstrap handled safely:", e);
  }
});

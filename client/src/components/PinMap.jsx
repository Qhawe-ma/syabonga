import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const KRANSKOP = [-28.971, 30.86];

function dropIcon() {
  return L.divIcon({
    className: 'drop-pin',
    html: '<span></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 20]
  });
}

function dotIcon(kind) {
  return L.divIcon({
    className: 'map-dot ' + kind,
    html: '<span></span>',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}

export function mapsUrl(lat, lng) {
  return 'https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng + '&travelmode=driving';
}

export function formatPin(lat, lng) {
  if (lat == null || lng == null) return '';
  const ns = lat < 0 ? 'S' : 'N';
  const ew = lng < 0 ? 'W' : 'E';
  return Math.abs(lat).toFixed(5) + '° ' + ns + ', ' + Math.abs(lng).toFixed(5) + '° ' + ew;
}

function zoomFor(accuracy, current) {
  if (accuracy == null || accuracy <= 0) return Math.max(current, 16);
  if (accuracy <= 25) return 18;
  if (accuracy <= 80) return 17;
  if (accuracy <= 300) return 15;
  if (accuracy <= 1000) return 14;
  return 13;
}

export default function PinMap({ lat, lng, accuracy, shop, driver, onPick, follow }) {
  const el = useRef(null);
  const mapRef = useRef(null);
  const dropRef = useRef(null);
  const ringRef = useRef(null);
  const driverRef = useRef(null);
  const shopRef = useRef(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    const start = lat != null && lng != null ? [lat, lng] : (shop?.lat ? [Number(shop.lat), Number(shop.lng)] : KRANSKOP);
    const map = L.map(el.current, { zoomControl: true }).setView(start, lat != null ? 16 : 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    if (onPickRef.current) {
      map.on('click', function (event) {
        onPickRef.current({ lat: event.latlng.lat, lng: event.latlng.lng, accuracy: null });
      });
    }
    mapRef.current = map;
    const fit = function () { map.invalidateSize(); };
    const timer = setTimeout(fit, 250);
    return function () {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      dropRef.current = null;
      ringRef.current = null;
      driverRef.current = null;
      shopRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || shop?.lat == null || shop?.lng == null) return;
    if (shopRef.current) shopRef.current.remove();
    shopRef.current = L.marker([Number(shop.lat), Number(shop.lng)], { icon: dotIcon('shop'), keyboard: false })
      .addTo(map)
      .bindTooltip('Siyabonga shop');
  }, [shop]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (dropRef.current) {
      dropRef.current.remove();
      dropRef.current = null;
    }
    if (ringRef.current) {
      ringRef.current.remove();
      ringRef.current = null;
    }
    if (lat == null || lng == null) return;
    if (accuracy > 0) {
      ringRef.current = L.circle([lat, lng], {
        radius: accuracy,
        color: '#0b3d91',
        weight: 1,
        fillColor: '#2f6fed',
        fillOpacity: 0.18,
        interactive: false
      }).addTo(map);
    }
    const label = formatPin(lat, lng) + (accuracy > 0 ? ' · within ' + Math.round(accuracy) + ' m' : '');
    dropRef.current = L.marker([lat, lng], { icon: dropIcon(), keyboard: false, zIndexOffset: 400 })
      .addTo(map)
      .bindTooltip(label || 'Drop-off', { permanent: true, direction: 'top', offset: [0, -18], className: 'pin-label' });
    if (follow !== false) map.setView([lat, lng], zoomFor(accuracy, map.getZoom()));
  }, [lat, lng, accuracy, follow]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (driverRef.current) {
      driverRef.current.remove();
      driverRef.current = null;
    }
    if (!driver || driver.lat == null || driver.lng == null) return;
    driverRef.current = L.marker([driver.lat, driver.lng], { icon: dotIcon('driver'), keyboard: false, zIndexOffset: 500 })
      .addTo(map)
      .bindTooltip(driver.name || 'Driver');
  }, [driver]);

  return <div className="pinmap" ref={el} />;
}

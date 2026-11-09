import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Navigation,
  MapPin,
  Clock,
  Fuel,
  ExternalLink,
  Car,
  Compass,
  Layers,
  LocateFixed,
  Maximize2,
  Radio,
  Users,
  X,
  Crosshair,
  Activity,
  MessageCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { getNavigationLinks, getMissionTotalKm, fetchRouteOSRM } from '../utils/geo';
import { apiGetActiveGpsLocations, apiSendGpsLocation, apiStopGpsLocation } from '../utils/api';
import { confirmDialog, alertDialog } from '../utils/dialog';

// Ícones personalizados SVG para Leaflet
const createBaseIcon = () => {
  return L.divIcon({
    className: 'custom-leaflet-marker base-marker',
    html: `
      <div class="marker-base-pulse"></div>
      <div class="marker-base-pulse-outer"></div>
      <div class="marker-base-pin">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
      </div>
      <div class="marker-label">SEDE / BASE</div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -24],
  });
};

const createMissionIcon = (index, status) => {
  const isCompleted = status === 'Concluída' || status === 'Finalizado' || status === 'Finalizada';
  const isExecuting = status === 'Em Execução';
  const isPrep = status === 'Em Preparo' || status === 'Em Deslocamento' || status === 'Saiu';
  const colorClass = isCompleted
    ? 'marker-success'
    : isExecuting
      ? 'marker-danger'
      : isPrep
        ? 'marker-warning'
        : 'marker-primary';

  return L.divIcon({
    className: `custom-leaflet-marker mission-marker ${colorClass}`,
    html: `
      <div class="marker-mission-pin">
        <span>${index + 1}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20],
  });
};

export default function MapView({
  baseLocation,
  missions = [],
  selectedMissionId,
  onSelectMission,
  onOpenNewMissionAtCoord,
  theme = 'dark',
  userRole = 'admin',
}) {
  const canViewFinancials = userRole === 'admin' || userRole === 'manager';
  const canViewStaffGps = userRole === 'admin' || userRole === 'manager';
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const routePolylineRef = useRef(null);
  // Padrão: 'streets' (Cidade) no modo claro, 'dark' (Modo Escuro) no modo escuro
  const [mapLayerType, setMapLayerType] = useState(() => (theme === 'light' ? 'streets' : 'dark'));

  const tileLayerRef = useRef(null);
  const fetchingMissionsRef = useRef(new Set());
  const gpsMarkersGroupRef = useRef(null);
  const [activeGpsLocations, setActiveGpsLocations] = useState([]);
  const [isGpsRadarOpen, setIsGpsRadarOpen] = useState(false);
  const [showStaffGpsMarkers, setShowStaffGpsMarkers] = useState(true);
  const [isSharingGps, setIsSharingGps] = useState(false);
  const gpsWatchIdRef = useRef(null);
  const hasInitialFitRef = useRef(false);
  const prevSelectedMissionIdRef = useRef(undefined);

  // Sincroniza a camada padrão do mapa sempre que o tema da aplicação mudar
  useEffect(() => {
    setMapLayerType(theme === 'light' ? 'streets' : 'dark');
  }, [theme]);

  // Inicializa mapa Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      if (mapContainerRef.current._leaflet_id) {
        delete mapContainerRef.current._leaflet_id;
      }

      const initialLat = baseLocation?.lat || 2.825358;
      const initialLon = baseLocation?.lon || -60.731062;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLon],
        zoom: 13,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Provedores de mapa gratuitos e estáveis sem necessidade de chave de API
      const tileUrl =
        mapLayerType === 'satellite'
          ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

      const tileLayer = L.tileLayer(tileUrl, {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; Esri',
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;

      // Evento de clique no mapa para cadastrar missão naquela coordenada
      map.on('click', (e) => {
        if (onOpenNewMissionAtCoord) {
          onOpenNewMissionAtCoord(e.latlng.lat, e.latlng.lng);
        }
      });

      // Marca que o usuário manipulou o mapa para não resetar nem desfazer o zoom com atualizações em tempo real
      map.on('movestart', () => {
        hasInitialFitRef.current = true;
      });
      map.on('zoomstart', () => {
        hasInitialFitRef.current = true;
      });

      // Garante redimensionamento correto do mapa no container
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize({ pan: false });
        }
      }, 250);

      mapInstanceRef.current = map;
    }

    return () => {
      // Limpeza segura ao desmontar
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn('Erro seguro na desmontagem do Leaflet:', e);
        }
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
        markersLayerRef.current = null;
        routePolylineRef.current = null;
      }
    };
  }, []);

  // Altera estilo do TileLayer quando mapLayerType muda
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;

    if (mapLayerType === 'satellite') {
      tileLayerRef.current.setUrl('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');
    } else {
      tileLayerRef.current.setUrl('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    }

    // Invalida tamanho para renderização perfeita e sem sobreposições
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ pan: false });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [mapLayerType]);

  // Atualiza Marcadores e Traçado da Rota Selecionada
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    // 1. Marcador da Base
    if (baseLocation && baseLocation.lat && baseLocation.lon) {
      const bLat = Number(baseLocation.lat);
      const bLon = Number(baseLocation.lon);
      if (!isNaN(bLat) && !isNaN(bLon)) {
        const baseMarker = L.marker([bLat, bLon], {
          icon: createBaseIcon(),
        }).addTo(markersGroup);

        baseMarker.bindPopup(`
          <div className="map-popup">
            <div className="popup-title">🏢 ${baseLocation.name || 'Sede MegaFilmes'}</div>
            <p className="popup-text">${baseLocation.address || 'Ponto de Partida e Retorno de Frotas'}</p>
            <div className="popup-coords">${bLat.toFixed(5)}, ${bLon.toFixed(5)}</div>
          </div>
        `);
      }
    }

    // 2. Marcadores das Missões
    const bounds = [];
    if (baseLocation && !isNaN(Number(baseLocation.lat)) && !isNaN(Number(baseLocation.lon))) {
      bounds.push([Number(baseLocation.lat), Number(baseLocation.lon)]);
    }

    missions.forEach((m, idx) => {
      const mLat = Number(m.lat);
      const mLon = Number(m.lon);
      if (isNaN(mLat) || isNaN(mLon) || mLat === 0) return;
      bounds.push([mLat, mLon]);

      const marker = L.marker([mLat, mLon], {
        icon: createMissionIcon(idx, m.missionStatus),
      }).addTo(markersGroup);

      marker.on('click', () => {
        if (onSelectMission) onSelectMission(m.id);
      });

      const totalKm = getMissionTotalKm(m);
      const totalMin = m.roundTripDurationMinutes || (m.drivingDurationMinutes || 0) * 2;
      const isDone =
        m.missionStatus === 'Concluída' ||
        m.missionStatus === 'Finalizado' ||
        m.missionStatus === 'Finalizada';
      const isExec = m.missionStatus === 'Em Execução';

      marker.bindPopup(`
        <div className="map-popup">
          <div className="popup-badge ${isDone ? 'badge-success' : isExec ? 'badge-danger' : 'badge-warning'}">
            ${m.missionStatus || 'Agendada'}
          </div>
          <h4 className="popup-title">${m.description}</h4>
          <p className="popup-subtitle">📍 ${m.locationName || m.address || 'Local'}</p>
          <div className="popup-grid">
            <div><strong>Data:</strong> ${m.date || '--'}</div>
            <div><strong>Horário:</strong> ${m.departureTime || '--'} -> ${m.returnTimeEstimated || m.arrivalTimeEstimated || '--'}</div>
            <div><strong>Equipe:</strong> ${m.teamNamesDisplay || '--'}${Array.isArray(m.guests) && m.guests.length > 0 ? ` + 👤 ${m.guests.map(g => typeof g === 'string' ? g : g.name).join(', ')} (Convidado)` : ''}</div>
            <div><strong>Viatura:</strong> ${m.vehicleNameDisplay || 'Não definida'}${m.driverName ? ` • 🛞 ${m.driverName}` : ''}</div>
            <div><strong>Distância (Ida/Volta):</strong> ${totalKm} km (${m.distanceKm || 0} km cada trecho)</div>
            <div><strong>Tempo (Ida/Volta):</strong> ~${totalMin} min (~${m.drivingDurationMinutes || 0} min por trecho)</div>
            <div><strong>Combustível Est.:</strong> ${m.estimatedFuelLiters || 0} L (R$ ${Number(m.estimatedFuelCost || 0).toFixed(2)})</div>
          </div>
        </div>
      `);
    });

    // 3. Camada de Rotas Viárias (estilo Waze / Google Maps)
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }

    const routesGroup = L.layerGroup().addTo(map);
    routePolylineRef.current = routesGroup;

    // Desenha rotas secundárias sutis para as demais missões que possuem coordenadas
    missions.forEach((m) => {
      if (m.id === selectedMissionId) return;
      if (Array.isArray(m.routeCoordinates) && m.routeCoordinates.length > 2) {
        L.polyline(m.routeCoordinates, {
          color: '#06b6d4',
          weight: 3,
          opacity: 0.3,
          lineCap: 'round',
          lineJoin: 'round',
        })
          .on('click', () => {
            if (onSelectMission) onSelectMission(m.id);
          })
          .addTo(routesGroup);
      }
    });

    const isNewMissionSelected = Boolean(
      selectedMissionId && selectedMissionId !== prevSelectedMissionIdRef.current
    );
    prevSelectedMissionIdRef.current = selectedMissionId;

    const activeMission = missions.find((m) => m.id === selectedMissionId);
    if (activeMission && baseLocation?.lat && activeMission.lat) {
      const renderActiveRoute = (coords, returnCoords = []) => {
        if (!coords || !Array.isArray(coords) || coords.length === 0) return;

        // Borda escura (casing) estilo Google Maps / Waze para destacar a rua
        L.polyline(coords, {
          color: '#0b0f19',
          weight: 9,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(routesGroup);

        // Linha principal de IDA (Dourado vibrante)
        const mainPoly = L.polyline(coords, {
          color: '#f59e0b',
          weight: 5,
          opacity: 0.98,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(routesGroup);

        // Se for Ida e Volta e houver trajeto de retorno pelas vias de mão única, desenha em Ciano tracejado
        if (activeMission.isRoundTrip && returnCoords && returnCoords.length > 2) {
          L.polyline(returnCoords, {
            color: '#06b6d4',
            weight: 3.5,
            opacity: 0.8,
            dashArray: '6, 8',
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(routesGroup);
        }

        // SÓ ajusta o enquadramento se o usuário tiver explicitamente clicado em uma nova missão!
        // Não desfaz o zoom ou movimentação manual que o usuário realizou no mapa.
        if (isNewMissionSelected) {
          try {
            const polyBounds = mainPoly.getBounds();
            if (polyBounds.isValid()) {
              map.fitBounds(polyBounds, { padding: [50, 50], maxZoom: 15 });
            }
          } catch (e) {
            console.warn('Erro ao ajustar enquadramento da rota:', e);
          }
        }
      };

      if (activeMission.routeCoordinates && activeMission.routeCoordinates.length > 1) {
        renderActiveRoute(activeMission.routeCoordinates, activeMission.returnCoordinates);
      } else if (!fetchingMissionsRef.current.has(activeMission.id)) {
        fetchingMissionsRef.current.add(activeMission.id);
        fetchRouteOSRM(baseLocation.lat, baseLocation.lon, activeMission.lat, activeMission.lon)
          .then((res) => {
            if (res && res.coordinates && res.coordinates.length > 1) {
              renderActiveRoute(res.coordinates, res.returnCoordinates);
            }
          })
          .catch((err) => {
            console.warn('Não foi possível obter rota instantânea:', err);
          });
      }
    } else if (bounds.length > 1 && !hasInitialFitRef.current) {
      // SÓ ajusta o enquadramento geral na PRIMEIRA vez que o mapa é montado
      // Preserva 100% o zoom e posicionamento manual do usuário nas atualizações seguintes
      hasInitialFitRef.current = true;
      try {
        const latLngBounds = L.latLngBounds(bounds);
        if (latLngBounds.isValid()) {
          map.fitBounds(latLngBounds, { padding: [50, 50], maxZoom: 14 });
        }
      } catch (e) {
        console.warn('Erro ao ajustar enquadramento do mapa:', e);
      }
    }
  }, [missions, baseLocation, selectedMissionId]);

  // Cálculo de distância haversine em metros entre duas coordenadas
  const getDistanceMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Polling de Posições GPS ativas dos operadores em campo (a cada 10s)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!gpsMarkersGroupRef.current) {
      gpsMarkersGroupRef.current = L.layerGroup().addTo(map);
    }

    // Regra: Apenas Administradores e Gestores têm acesso a ver posições de colaboradores em campo
    if (!canViewStaffGps) {
      if (gpsMarkersGroupRef.current) {
        gpsMarkersGroupRef.current.clearLayers();
      }
      setActiveGpsLocations([]);
      return;
    }

    const fetchGpsPositions = async () => {
      try {
        const res = await apiGetActiveGpsLocations();
        if (!res.success || !Array.isArray(res.locations)) return;

        // Regra de Governança: Filtra para garantir que administradores/gestores nunca apareçam no radar ou mapa
        const validLocations = res.locations.filter((loc) => {
          const name = (loc.memberName || '').toLowerCase().trim();
          const role = (loc.memberRole || '').toLowerCase().trim();
          if (role === 'admin' || role === 'gestor' || role === 'administrador') return false;
          if (name.includes('histanley') || name.includes('rodrigo') || name.includes('guedes') || name === 'hgama') return false;
          return true;
        });

        setActiveGpsLocations(validLocations);

        if (gpsMarkersGroupRef.current) {
          gpsMarkersGroupRef.current.clearLayers();
        }

        // Filtro de exibição no mapa: se o usuário desativou a exibição no mapa, não desenha os pins
        if (!showStaffGpsMarkers) {
          return;
        }

        // Agrupamento (Clustering) de colaboradores no mesmo lugar (distância <= 75 metros)
        const clusters = [];
        const visited = new Set();
        for (let i = 0; i < validLocations.length; i++) {
          if (visited.has(i)) continue;
          const group = [validLocations[i]];
          visited.add(i);
          for (let j = i + 1; j < validLocations.length; j++) {
            if (visited.has(j)) continue;
            const dist = getDistanceMeters(validLocations[i].lat, validLocations[i].lon, validLocations[j].lat, validLocations[j].lon);
            if (dist <= 75) {
              group.push(validLocations[j]);
              visited.add(j);
            }
          }
          clusters.push(group);
        }

        // Renderiza cada grupo ou pin individual
        clusters.forEach((group) => {
          // Se houver 3 ou mais colaboradores juntos: renderiza ícone de grupo com contador
          if (group.length >= 3) {
            const avgLat = group.reduce((acc, c) => acc + c.lat, 0) / group.length;
            const avgLon = group.reduce((acc, c) => acc + c.lon, 0) / group.length;

            const clusterIcon = L.divIcon({
              className: 'custom-staff-cluster-marker',
              html: `
                <div class="staff-cluster-pulse"></div>
                <div class="staff-cluster-badge">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                  <span class="cluster-count">${group.length}</span>
                </div>
              `,
              iconSize: [44, 44],
              iconAnchor: [22, 22],
              popupAnchor: [0, -24],
            });

            const clusterMarker = L.marker([avgLat, avgLon], { icon: clusterIcon });

            const membersListHtml = group.map((loc) => {
              const speedKmh = Math.round(Number(loc.speed || 0) * 3.6);
              const isMoving = speedKmh > 3;
              const statusText = isMoving ? `${speedKmh} km/h` : 'Parado';
              const initials = (loc.memberName || 'C').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
              const avatarInner = loc.memberPhoto
                ? `<img src="${loc.memberPhoto}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" alt="" />`
                : `<span style="font-weight:800;font-size:11px;color:#fff;">${initials}</span>`;
              const phoneDigits = (loc.memberPhone || '').replace(/\D/g, '');
              const whatsappBtn = phoneDigits
                ? `<a href="https://wa.me/55${phoneDigits}" target="_blank" rel="noreferrer" style="padding:4px 8px;border-radius:6px;background:#25d366;color:#fff;text-decoration:none;font-weight:600;font-size:0.72rem;display:inline-flex;align-items:center;gap:3px;flex-shrink:0;">💬 WhatsApp</a>`
                : '';
              const missionTag = loc.missionTitle
                ? `<div style="font-size:0.7rem;color:#f59e0b;margin-top:2px;font-weight:600;">🎯 ${loc.missionTitle}</div>`
                : '';

              return `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);">
                  <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                    <div style="width:32px;height:32px;border-radius:50%;background:#06b6d4;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
                      ${avatarInner}
                    </div>
                    <div style="min-width:0;">
                      <strong style="font-size:0.83rem;display:block;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${loc.memberName}</strong>
                      <span style="font-size:0.7rem;opacity:0.75;display:block;">${loc.memberRole || 'Colaborador'} • <span style="color:${isMoving ? '#10b981' : '#f59e0b'};font-weight:600;">${statusText}</span></span>
                      ${missionTag}
                    </div>
                  </div>
                  <div>
                    ${whatsappBtn}
                  </div>
                </div>
              `;
            }).join('');

            const clusterPopupHtml = `
              <div style="min-width:270px;max-width:320px;font-family:inherit;padding:4px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.12);">
                  <span style="padding:3px 8px;border-radius:12px;background:rgba(245,158,11,0.2);color:#f59e0b;font-weight:800;font-size:0.78rem;">
                    👥 ${group.length} Colaboradores Juntos
                  </span>
                  <span style="font-size:0.7rem;opacity:0.6;">Mesmo Ponto</span>
                </div>
                <div style="max-height:240px;overflow-y:auto;padding-right:4px;">
                  ${membersListHtml}
                </div>
              </div>
            `;

            clusterMarker.bindPopup(clusterPopupHtml);
            clusterMarker.addTo(gpsMarkersGroupRef.current);
          } else {
            // Menos de 3 colaboradores: exibe cada um com seu pin individual
            group.forEach((loc) => {
              if (!loc.lat || !loc.lon) return;

              const speedKmh = Math.round(Number(loc.speed || 0) * 3.6);
              const isMoving = speedKmh > 3;
              const statusText = isMoving ? `${speedKmh} km/h` : 'Parado';
              const initials = (loc.memberName || 'C').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

              const avatarInner = loc.memberPhoto
                ? `<img src="${loc.memberPhoto}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" alt="" />`
                : `<span style="font-weight:800;font-size:12px;color:#fff;">${initials}</span>`;

              const staffIcon = L.divIcon({
                className: 'custom-staff-live-marker',
                html: `
                  <div class="staff-radar-pulse ${isMoving ? 'pulse-moving' : 'pulse-standing'}"></div>
                  <div class="staff-radar-circle ${isMoving ? 'is-moving' : 'is-stopped'}">
                    ${avatarInner}
                    <div class="staff-status-dot ${isMoving ? 'is-moving' : 'is-stopped'}"></div>
                  </div>
                  <div class="staff-radar-tag">
                    <span class="staff-tag-name">${(loc.memberName || '').split(' ')[0]}</span>
                    <span class="staff-tag-speed ${isMoving ? 'speed-fast' : 'speed-stop'}">${statusText}</span>
                  </div>
                `,
                iconSize: [44, 44],
                iconAnchor: [22, 22],
                popupAnchor: [0, -24],
              });

              const mPin = L.marker([loc.lat, loc.lon], { icon: staffIcon });

              const batteryBadge = loc.batteryPercent !== null
                ? `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:10px;background:rgba(255,255,255,0.08);font-size:0.75rem;">🔋 ${loc.batteryPercent}%</span>`
                : '';

              const phoneDigits = (loc.memberPhone || '').replace(/\D/g, '');
              const whatsappBtn = phoneDigits
                ? `<a href="https://wa.me/55${phoneDigits}" target="_blank" rel="noreferrer" style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:6px;background:#25d366;color:#fff;text-decoration:none;font-weight:600;font-size:0.75rem;">💬 WhatsApp</a>`
                : '';

              const missionInfo = loc.missionTitle
                ? `<div style="margin:8px 0;padding:8px;background:rgba(255,255,255,0.06);border-radius:6px;border-left:3px solid #f59e0b;font-size:0.75rem;">
                    <div style="opacity:0.6;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.5px;">Missão Vinculada</div>
                    <strong style="color:#f59e0b;display:block;margin-top:2px;">${loc.missionTitle}</strong>
                  </div>`
                : '';

              const popupHtml = `
                <div style="min-width:220px;font-family:inherit;padding:4px;">
                  <div style="display:flex;align-items:center;gap:9px;margin-bottom:6px;">
                    <div style="width:38px;height:38px;border-radius:50%;overflow:hidden;background:#06b6d4;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;border:2px solid #06b6d4;">
                      ${avatarInner}
                    </div>
                    <div>
                      <h4 style="margin:0;font-size:0.92rem;font-weight:700;line-height:1.2;">${loc.memberName}</h4>
                      <div style="font-size:0.72rem;opacity:0.75;margin-top:2px;">${loc.memberRole || 'Colaborador'} • ${loc.memberCompany || 'MegaFilmes'}</div>
                    </div>
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;margin:8px 0;flex-wrap:wrap;">
                    <span style="padding:2px 8px;border-radius:12px;background:rgba(6,182,212,0.18);color:#06b6d4;font-weight:700;font-size:0.72rem;">📍 GPS Ao Vivo</span>
                    <span style="font-size:0.75rem;font-weight:600;opacity:0.9;">${statusText}</span>
                    ${batteryBadge}
                  </div>
                  ${missionInfo}
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.1);">
                    <small style="opacity:0.55;font-size:0.68rem;">Precisão: ±${Math.round(loc.accuracy || 5)}m</small>
                    ${whatsappBtn}
                  </div>
                </div>
              `;

              mPin.bindPopup(popupHtml);
              mPin.addTo(gpsMarkersGroupRef.current);
            });
          }
        });
      } catch (err) {
        // silencioso
      }
    };

    fetchGpsPositions();
    const interval = setInterval(fetchGpsPositions, 10000);
    return () => clearInterval(interval);
  }, [canViewStaffGps, showStaffGpsMarkers]);

  // Alternador de Compartilhamento Consentido de GPS (LGPD / Privacidade)
  const handleToggleGpsSharing = async () => {
    if (isSharingGps) {
      if (gpsWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        gpsWatchIdRef.current = null;
      }
      setIsSharingGps(false);
      apiStopGpsLocation().catch(() => {});
      await alertDialog({
        title: 'GPS Desativado',
        message: 'Compartilhamento de localização GPS encerrado com sucesso.',
        variant: 'info',
      });
    } else {
      if (!('geolocation' in navigator)) {
        await alertDialog({
          title: 'GPS Indisponível',
          message: 'Seu dispositivo ou navegador não suporta geolocalização.',
          variant: 'warning',
        });
        return;
      }

      const confirmed = await confirmDialog({
        title: 'Compartilhamento de GPS',
        message: 'Deseja ativar o compartilhamento de sua localização GPS durante a missão?',
        description: 'Suas coordenadas serão transmitidas com consentimento para a central e desativadas automaticamente ao finalizar.',
        confirmText: 'Ativar GPS',
        cancelText: 'Cancelar',
        variant: 'info',
      });

      if (confirmed) {
        setIsSharingGps(true);
        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude, speed, heading, accuracy } = pos.coords;
            apiSendGpsLocation({
              lat: latitude,
              lon: longitude,
              speed: speed || 0,
              heading: heading || 0,
              accuracy: accuracy || 0,
              missionId: selectedMissionId || null,
              isActive: true
            }).catch(() => {});
          },
          (err) => {
            console.warn('Erro ao obter GPS:', err);
            setIsSharingGps(false);
            alertDialog({
              title: 'Erro de Permissão',
              message: 'Não foi possível obter a localização. Verifique as permissões de GPS no seu navegador.',
              variant: 'warning',
            });
          },
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
        );
        gpsWatchIdRef.current = watchId;
      }
    }
  };

  const activeMission = missions.find((m) => m.id === selectedMissionId);
  const navLinks = activeMission && baseLocation
    ? getNavigationLinks(baseLocation.lat, baseLocation.lon, activeMission.lat, activeMission.lon)
    : null;

  return (
    <div className="map-view-wrapper">
      {/* Barra Superior Flutuante do Mapa */}
      <div className="map-floating-header">
        <div className="map-title-box">
          <div className="pulse-dot"></div>
          <div>
            <span className="map-title">Monitoramento de Frotas & Missões</span>
            <span className="map-subtitle">MegaFilmes & Mega Print - Rotas e Deslocamentos</span>
          </div>
        </div>

        <div className="map-header-controls">
          <button
            className={`map-control-btn ${mapLayerType === 'streets' ? 'active' : ''}`}
            onClick={() => setMapLayerType('streets')}
            title="Visualização Limpa / Colorida"
          >
            <Compass size={14} /> Cidade
          </button>
          <button
            className={`map-control-btn ${mapLayerType === 'dark' ? 'active' : ''}`}
            onClick={() => setMapLayerType('dark')}
            title="Visualização Escura Noturna"
          >
            <Layers size={14} /> Modo Escuro
          </button>
          <button
            className={`map-control-btn ${mapLayerType === 'satellite' ? 'active' : ''}`}
            onClick={() => setMapLayerType('satellite')}
            title="Visualização Satélite"
          >
            <Maximize2 size={14} /> Satélite
          </button>

          <button
            className="map-control-btn btn-recenter"
            onClick={() => {
              if (mapInstanceRef.current && baseLocation?.lat) {
                mapInstanceRef.current.setView([baseLocation.lat, baseLocation.lon], 14, { animate: true });
              }
            }}
            title="Centralizar na Base"
          >
            <LocateFixed size={14} /> Base Sede
          </button>

          {/* Filtro para Permitir ou Ocultar Colaboradores no Mapa (Apenas Administrador e Gestor) */}
          {canViewStaffGps && (
            <button
              type="button"
              className={`map-control-btn ${showStaffGpsMarkers ? 'active' : ''}`}
              onClick={() => setShowStaffGpsMarkers((prev) => !prev)}
              title={showStaffGpsMarkers ? 'Ocultar marcadores de colaboradores no mapa' : 'Exibir marcadores de colaboradores no mapa'}
            >
              {showStaffGpsMarkers ? <Eye size={14} /> : <EyeOff size={14} />}
              <span>{showStaffGpsMarkers ? 'GPS Equipe: Visível' : 'GPS Equipe: Oculto'}</span>
            </button>
          )}

          {/* Botão Radar GPS em Tempo Real da Equipe (Apenas Administrador e Gestor) */}
          {canViewStaffGps && (
            <button
              type="button"
              className={`map-control-btn gps-radar-toggle-btn ${isGpsRadarOpen ? 'active' : ''} ${activeGpsLocations.length > 0 ? 'has-online' : ''}`}
              onClick={() => setIsGpsRadarOpen((prev) => !prev)}
              title="Ver lista de colaboradores com GPS transmitindo em tempo real"
            >
              <span className={`radar-indicator-dot ${activeGpsLocations.length > 0 ? 'is-pulsing' : ''}`} />
              <span>📡 {activeGpsLocations.length} em Campo</span>
            </button>
          )}

          {/* Colaboradores de campo: Indicador visual de GPS automático ativo */}
          {!canViewStaffGps && (
            <div
              className="map-control-btn active-pulse-green"
              style={{ borderColor: '#10b981', color: '#10b981', cursor: 'default' }}
              title="Sua localização está sendo compartilhada automaticamente com a central"
            >
              <Radio size={14} />
              <span>GPS Automático Ativo</span>
            </div>
          )}
        </div>
      </div>

      {/* Painel Flutuante do Radar GPS de Colaboradores em Campo (Apenas Administrador e Gestor) */}
      {canViewStaffGps && isGpsRadarOpen && (
        <div className="map-gps-radar-panel">
          <div className="mrp-header">
            <div className="mrp-title">
              <span className="radar-indicator-dot is-pulsing"></span>
              <strong>Radar GPS • Colaboradores Ao Vivo</strong>
              <span className="mrp-count-badge">{activeGpsLocations.length}</span>
            </div>
            <button
              type="button"
              className="mrp-close-btn"
              onClick={() => setIsGpsRadarOpen(false)}
              title="Fechar Radar"
            >
              <X size={15} />
            </button>
          </div>

          {activeGpsLocations.length === 0 ? (
            <div className="mrp-empty">
              <Users size={28} style={{ opacity: 0.35, marginBottom: '6px' }} />
              <div>Nenhum colaborador com GPS ativo no momento.</div>
              <small>
                A localização é transmitida automaticamente em tempo real quando os membros acessam o sistema no smartphone.
              </small>
            </div>
          ) : (
            <div className="mrp-list">
              {activeGpsLocations.map((loc) => {
                const speedKmh = Math.round(Number(loc.speed || 0) * 3.6);
                const isMoving = speedKmh > 3;
                const initials = (loc.memberName || 'C').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
                const phoneDigits = (loc.memberPhone || '').replace(/\D/g, '');

                return (
                  <div
                    key={loc.memberId || loc.id}
                    className="mrp-item"
                    onClick={() => {
                      if (mapInstanceRef.current && loc.lat && loc.lon) {
                        mapInstanceRef.current.flyTo([loc.lat, loc.lon], 16, { animate: true, duration: 1.2 });
                      }
                    }}
                    title="Clique para aproximar no mapa"
                  >
                    <div className="mrp-avatar-box">
                      {loc.memberPhoto ? (
                        <img src={loc.memberPhoto} alt={loc.memberName} className="mrp-avatar-img" />
                      ) : (
                        <span className="mrp-avatar-initials">{initials}</span>
                      )}
                      <span className={`mrp-live-dot ${isMoving ? 'is-moving' : 'is-stopped'}`} />
                    </div>

                    <div className="mrp-info">
                      <div className="mrp-name">{loc.memberName}</div>
                      <div className="mrp-role">
                        {loc.memberRole || 'Colaborador'} •{' '}
                        <span className={isMoving ? 'mrp-speed-moving' : 'mrp-speed-stopped'}>
                          {isMoving ? `🚗 ${speedKmh} km/h` : '🛑 Parado'}
                        </span>
                      </div>
                      {loc.missionTitle && (
                        <div className="mrp-mission-tag">🎯 {loc.missionTitle}</div>
                      )}
                    </div>

                    <div className="mrp-actions" onClick={(e) => e.stopPropagation()}>
                      {phoneDigits && (
                        <a
                          href={`https://wa.me/55${phoneDigits}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mrp-action-btn mrp-wa"
                          title="Conversar no WhatsApp"
                        >
                          <MessageCircle size={14} />
                        </a>
                      )}
                      <button
                        type="button"
                        className="mrp-action-btn mrp-fly"
                        onClick={() => {
                          if (mapInstanceRef.current && loc.lat && loc.lon) {
                            mapInstanceRef.current.flyTo([loc.lat, loc.lon], 16, { animate: true, duration: 1.2 });
                          }
                        }}
                        title="Focalizar no mapa"
                      >
                        <Crosshair size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Container Leaflet */}
      <div ref={mapContainerRef} className={`leaflet-map-canvas tile-mode-${mapLayerType}`} />

      {/* Dica de clique rápido para cadastrar */}
      <div className="map-instruction-pill">
        💡 <em>Dica:</em> Clique em qualquer ponto do mapa para criar uma missão com as coordenadas exatas!
      </div>

      {/* Card Flutuante de Detalhes da Missão Selecionada */}
      {activeMission && (
        <div className="map-mission-floating-card">
          <div className="card-top-bar">
            <span
              className={`mission-tag-status tag-${(activeMission.missionStatus || 'Agendada')
                .toLowerCase()
                .replace(/\s+/g, '-')}`}
            >
              <span className="status-indicator-dot"></span>
              {activeMission.missionStatus || 'Agendada'}
            </span>
            <button className="card-close-btn" onClick={() => onSelectMission(null)} title="Fechar Detalhes">
              ✕
            </button>
          </div>

          <h3 className="card-mission-title">{activeMission.description}</h3>
          <div className="card-mission-location">
            <MapPin size={15} className="icon-accent" />
            <span>{activeMission.locationName || activeMission.address}</span>
          </div>

          <div className="card-metrics-grid">
            <div className="metric-item">
              <div className="metric-label">
                <Navigation size={13} /> Distância (Ida e Volta)
              </div>
              <div className="metric-value">
                {getMissionTotalKm(activeMission)} km
                <span className="metric-sub">
                  ({activeMission.distanceKm || 0} km ida + {activeMission.returnDistanceKm || activeMission.distanceKm || 0} km volta)
                </span>
              </div>
            </div>

            <div className="metric-item">
              <div className="metric-label">
                <Clock size={13} /> Tempo (Ida e Volta)
              </div>
              <div className="metric-value">
                ~{activeMission.roundTripDurationMinutes || (activeMission.drivingDurationMinutes || 0) * 2} min
                <span className="metric-sub">
                  (~{activeMission.drivingDurationMinutes || 0} min/trecho • Saída: {activeMission.departureTime})
                </span>
              </div>
            </div>

            <div className="metric-item">
              <div className="metric-label">
                <Car size={13} /> Viatura & Motorista
              </div>
              <div className="metric-value">
                {activeMission.vehicleNameDisplay || 'Não alocada'}
                {activeMission.driverName && (
                  <span className="metric-sub" style={{ color: 'var(--accent-cyan)' }}>
                    🛞 Motorista: {activeMission.driverName}
                  </span>
                )}
              </div>
            </div>

            {canViewFinancials && (
              <div className="metric-item">
                <div className="metric-label">
                  <Fuel size={13} /> Combustível
                </div>
                <div className="metric-value highlight-fuel">
                  {activeMission.estimatedFuelLiters || 0} L
                  <span className="metric-sub">R$ {activeMission.estimatedFuelCost || '0.00'}</span>
                </div>
              </div>
            )}
          </div>

          <div className="card-team-info">
            <span className="team-label">Equipe Escalada:</span>
            <span className="team-names">{activeMission.teamNamesDisplay || 'Nenhum membro atribuído'}</span>
          </div>

          {navLinks && (
            <div className="card-nav-actions">
              <a
                href={navLinks.googleMaps}
                target="_blank"
                rel="noreferrer"
                className="btn-nav-external google-maps"
              >
                <ExternalLink size={14} /> Abrir Google Maps
              </a>
              <a
                href={navLinks.waze}
                target="_blank"
                rel="noreferrer"
                className="btn-nav-external waze"
              >
                <ExternalLink size={14} /> Abrir Waze
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

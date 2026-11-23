import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import {
  X,
  MapPin,
  Search,
  Crosshair,
  Building,
  Check,
  Loader,
  Navigation,
  Compass,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  searchAddressNominatim,
  reverseGeocodeNominatim,
  formatAddressWithCoordinates,
} from '../utils/geo';
import { getNativePosition } from '../utils/nativeBridge';

// Ícone personalizado moderno para o marcador no Map Picker
const createPickerPinIcon = () => {
  return L.divIcon({
    className: 'custom-leaflet-marker picker-pin-marker',
    html: `
      <div class="mmp-pin-glow"></div>
      <div class="mmp-pin-body">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="#F59E0B" stroke="#0F172A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3.5" fill="#FFFFFF"></circle>
        </svg>
      </div>
      <div class="mmp-pin-label">PONTO DA MISSÃO</div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 42],
    popupAnchor: [0, -42],
  });
};

export default function MissionMapPickerModal({
  isOpen,
  onClose,
  initialLat = null,
  initialLon = null,
  initialAddress = '',
  initialLocationName = '',
  baseLocation = null,
  onConfirmCoordinates,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  // Coordenadas padrão de Boa Vista / Base MegaFilmes
  const defaultCenter = useMemo(() => {
    if (initialLat && initialLon) {
      return [parseFloat(initialLat), parseFloat(initialLon)];
    }
    if (baseLocation && baseLocation.lat && baseLocation.lng) {
      return [parseFloat(baseLocation.lat), parseFloat(baseLocation.lng)];
    }
    // Default Boa Vista - RR
    return [2.8235, -60.6758];
  }, [initialLat, initialLon, baseLocation]);

  const [currentCoords, setCurrentCoords] = useState({
    lat: initialLat ? parseFloat(initialLat) : defaultCenter[0],
    lon: initialLon ? parseFloat(initialLon) : defaultCenter[1],
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [reverseAddress, setReverseAddress] = useState(initialAddress || '');
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isLocatingUser, setIsLocatingUser] = useState(false);

  // Inicializa o mapa Leaflet quando o modal abre
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [currentCoords.lat, currentCoords.lon],
        zoom: 16,
        zoomControl: true,
      });
      mapInstanceRef.current = map;

      // Camada de tiles OpenStreetMap padrão com contraste suave
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // Marcador da Base (se disponível)
      if (baseLocation && baseLocation.lat && baseLocation.lng) {
        const baseIcon = L.divIcon({
          className: 'custom-leaflet-marker base-mini-marker',
          html: `<div class="mmp-base-pin" title="Base MegaFilmes">🏢</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        L.marker([baseLocation.lat, baseLocation.lng], { icon: baseIcon })
          .addTo(map)
          .bindTooltip('Base / Sede MegaFilmes', { permanent: false, direction: 'top' });
      }

      // Marcador interativo principal (arrastável)
      const marker = L.marker([currentCoords.lat, currentCoords.lon], {
        icon: createPickerPinIcon(),
        draggable: true,
        autoPan: true,
      }).addTo(map);
      markerRef.current = marker;

      // Evento de arrastar marcador
      marker.on('dragend', async () => {
        const pos = marker.getLatLng();
        handleUpdatePoint(pos.lat, pos.lng);
      });

      // Evento de clique em qualquer ponto do mapa
      map.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        handleUpdatePoint(lat, lng);
      });

      // Força recalcular tamanho no container
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen]);

  // Atualiza ponto de coordenadas e busca endereço reverso
  const handleUpdatePoint = async (lat, lon) => {
    setCurrentCoords({ lat, lon });
    setIsReverseGeocoding(true);
    const res = await reverseGeocodeNominatim(lat, lon);
    if (res && res.shortName) {
      setReverseAddress(res.shortName);
    } else if (res && res.name) {
      setReverseAddress(res.name.split(',').slice(0, 3).join(','));
    }
    setIsReverseGeocoding(false);
  };

  // Busca rápida de endereço pelo input interno do mapa
  const handleMapSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const results = await searchAddressNominatim(searchQuery);
    setSearchResults(results);
    setIsSearching(false);
    if (results.length === 1) {
      handleSelectSearchResult(results[0]);
    }
  };

  // Seleciona resultado da busca interna
  const handleSelectSearchResult = (item) => {
    if (!mapInstanceRef.current || !markerRef.current) return;
    const lat = item.lat;
    const lon = item.lon;
    mapInstanceRef.current.flyTo([lat, lon], 17, { animate: true, duration: 1 });
    markerRef.current.setLatLng([lat, lon]);
    setCurrentCoords({ lat, lon });
    setReverseAddress(item.shortName || item.name);
    setSearchResults([]);
    setSearchQuery('');
  };

  // Obter localização atual do dispositivo via GPS Nativo / Web
  const handleLocateMe = async () => {
    setIsLocatingUser(true);
    try {
      const pos = await getNativePosition();
      const latitude = Number(pos.lat);
      const longitude = Number(pos.lon);
      if (mapInstanceRef.current && markerRef.current) {
        mapInstanceRef.current.flyTo([latitude, longitude], 17, { animate: true, duration: 1 });
        markerRef.current.setLatLng([latitude, longitude]);
        handleUpdatePoint(latitude, longitude);
      }
    } catch (err) {
      console.warn('Erro ao obter GPS atual:', err);
      alert('Não foi possível capturar sua posição atual. Verifique se o GPS e as permissões de localização estão ativos.');
    } finally {
      setIsLocatingUser(false);
    }
  };

  // Ir para a Base
  const handleFlyToBase = () => {
    if (!baseLocation || !baseLocation.lat || !baseLocation.lng) return;
    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.flyTo([baseLocation.lat, baseLocation.lng], 16, { animate: true, duration: 0.8 });
      markerRef.current.setLatLng([baseLocation.lat, baseLocation.lng]);
      handleUpdatePoint(baseLocation.lat, baseLocation.lng);
    }
  };

  // Confirma e aplica as coordenadas na missão
  const handleConfirm = () => {
    const latFixed = parseFloat(currentCoords.lat).toFixed(6);
    const lonFixed = parseFloat(currentCoords.lon).toFixed(6);

    // Formata o endereço completo garantindo as coordenadas integradas
    const formattedAddress = formatAddressWithCoordinates(
      reverseAddress || initialAddress || 'Local Personalizado no Mapa',
      latFixed,
      lonFixed
    );

    if (onConfirmCoordinates) {
      onConfirmCoordinates({
        lat: latFixed,
        lon: lonFixed,
        address: formattedAddress,
        shortName: reverseAddress || initialLocationName || 'Local Personalizado',
      });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="mmp-backdrop" onClick={onClose}>
      <div className="mmp-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho do Modal */}
        <header className="mmp-modal-header">
          <div className="mmp-header-left">
            <div className="mmp-header-icon-wrap">
              <MapPin size={20} className="text-amber" />
            </div>
            <div>
              <h3 className="mmp-modal-title">Buscar no Mapa &amp; Personalizar Coordenadas GPS</h3>
              <p className="mmp-modal-subtitle">
                Clique em qualquer ponto do mapa ou arraste o marcador amarelo para fixar a localização exata da missão.
              </p>
            </div>
          </div>
          <button type="button" className="mmp-btn-close" onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </header>

        {/* Barra Superior de Busca e Ferramentas do Mapa */}
        <div className="mmp-toolbar">
          <form className="mmp-search-form" onSubmit={handleMapSearch}>
            <div className="mmp-search-input-wrap">
              <Search size={15} className="mmp-search-icon" />
              <input
                type="text"
                placeholder="Pesquisar rua, bairro, praça ou ponto de referência..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="mmp-clear-btn"
                  onClick={() => setSearchQuery('')}
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="mmp-search-submit-btn"
              disabled={isSearching || !searchQuery.trim()}
            >
              {isSearching ? <Loader size={14} className="spin" /> : <Search size={14} />}
              <span>{isSearching ? 'Localizando...' : 'Localizar'}</span>
            </button>
          </form>

          <div className="mmp-quick-actions">
            <button
              type="button"
              className="mmp-tool-btn"
              onClick={handleLocateMe}
              disabled={isLocatingUser}
              title="Centralizar na minha localização GPS atual"
            >
              {isLocatingUser ? <Loader size={14} className="spin" /> : <Crosshair size={14} />}
              <span>Meu GPS</span>
            </button>
            {baseLocation && (
              <button
                type="button"
                className="mmp-tool-btn"
                onClick={handleFlyToBase}
                title="Centralizar na Base MegaFilmes"
              >
                <Building size={14} />
                <span>Base</span>
              </button>
            )}
          </div>
        </div>

        {/* Dropdown de Resultados da Pesquisa Interna */}
        {searchResults.length > 0 && (
          <div className="mmp-search-dropdown">
            <div className="mmp-dropdown-header">
              Locais sugeridos (clique para posicionar o marcador):
            </div>
            {searchResults.map((res, i) => (
              <div
                key={i}
                className="mmp-dropdown-item"
                onClick={() => handleSelectSearchResult(res)}
              >
                <MapPin size={14} className="text-amber" />
                <div className="mmp-dropdown-text">
                  <strong>{res.shortName || res.name.split(',')[0]}</strong>
                  <span>{res.name}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Container do Mapa Leaflet */}
        <div className="mmp-map-viewport">
          <div ref={mapContainerRef} className="mmp-leaflet-container" />

          {/* Dica Flutuante Interativa */}
          <div className="mmp-floating-hint">
            <HelpCircle size={13} />
            <span>Dica: Clique ou arraste o marcador amarelo para o ponto desejado</span>
          </div>
        </div>

        {/* Painel Inferior de Coordenadas e Endereço Identificado */}
        <div className="mmp-footer-info">
          <div className="mmp-coords-strip">
            <div className="mmp-coord-badge">
              <span className="lbl">LATITUDE:</span>
              <span className="val">{Number(currentCoords.lat).toFixed(6)}</span>
            </div>
            <div className="mmp-coord-badge">
              <span className="lbl">LONGITUDE:</span>
              <span className="val">{Number(currentCoords.lon).toFixed(6)}</span>
            </div>
            <div className="mmp-address-preview">
              <span className="lbl">ENDEREÇO IDENTIFICADO:</span>
              <span className="val">
                {isReverseGeocoding ? (
                  <span className="text-muted">
                    <Loader size={12} className="spin inline-icon" /> Buscando endereço...
                  </span>
                ) : (
                  reverseAddress || 'Ponto personalizado sem logradouro oficial'
                )}
              </span>
            </div>
          </div>

          <div className="mmp-actions-footer">
            <button type="button" className="btn-secondary mmp-btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primary mmp-btn-confirm"
              onClick={handleConfirm}
            >
              <Check size={16} />
              <span>Fixar Coordenadas &amp; Aplicar na Missão</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

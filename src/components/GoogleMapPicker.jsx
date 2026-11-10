import { useState, useEffect, useCallback, useRef } from 'react';
import { Modal, Input, Button, message, Space, Spin } from 'antd';
import { EnvironmentOutlined, SearchOutlined } from '@ant-design/icons';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// CSS for Google Places Autocomplete dropdown
const autocompleteStyles = `
  .pac-container {
    background-color: #fff;
    position: absolute !important;
    z-index: 10000 !important;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    border: 1px solid #d9d9d9;
    margin-top: 4px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }
  .pac-container:after {
    display: none;
  }
  .pac-item {
    padding: 10px 12px;
    cursor: pointer;
    border-bottom: 1px solid #f0f0f0;
    font-size: 14px;
    line-height: 1.5;
  }
  .pac-item:hover {
    background-color: #f5f5f5;
  }
  .pac-item:last-child {
    border-bottom: none;
  }
  .pac-icon {
    margin-right: 8px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%231890ff'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/%3E%3C/svg%3E");
    background-size: 20px;
    width: 20px;
    height: 20px;
  }
  .pac-item-query {
    font-weight: 600;
    color: #262626;
  }
  .pac-matched {
    font-weight: 700;
    color: #1890ff;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = autocompleteStyles;
  document.head.appendChild(styleSheet);
}

const GoogleMapPicker = ({ open, onCancel, onSelect, initialLocation, title = 'Select Location on Map' }) => {
  const [map, setMap] = useState(null);
  const [marker, setMarker] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(initialLocation || null);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const mapRef = useRef(null);
  const autocompleteRef = useRef(null);
  const searchInputRef = useRef(null);

  // Initialize Google Maps
  useEffect(() => {
    if (!open || !GOOGLE_MAPS_API_KEY) return;

    const loadGoogleMaps = async () => {
      // Check if Google Maps is already loaded
      if (window.google && window.google.maps) {
        initializeMap();
        return;
      }

      // Load Google Maps script
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = initializeMap;
      script.onerror = () => {
        message.error('Failed to load Google Maps');
        setLoading(false);
      };
      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, [open]);

  const initializeMap = useCallback(() => {
    if (!mapRef.current) return;

    const defaultCenter = initialLocation 
      ? { lat: initialLocation.lat, lng: initialLocation.lng }
      : { lat: 12.9716, lng: 77.5946 }; // Bangalore as default

    const mapInstance = new window.google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: 15,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true,
    });

    setMap(mapInstance);

    // Create marker
    const markerInstance = new window.google.maps.Marker({
      position: defaultCenter,
      map: mapInstance,
      draggable: true,
      animation: window.google.maps.Animation.DROP,
    });

    setMarker(markerInstance);

    // Set initial location
    if (initialLocation) {
      setSelectedLocation(initialLocation);
      setAddress(initialLocation.address || '');
      reverseGeocode(initialLocation.lat, initialLocation.lng);
    } else {
      // Try to get user's current location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const pos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            mapInstance.setCenter(pos);
            markerInstance.setPosition(pos);
            setSelectedLocation(pos);
            reverseGeocode(pos.lat, pos.lng);
          },
          () => {
            // Use default location if geolocation fails
            setSelectedLocation(defaultCenter);
            reverseGeocode(defaultCenter.lat, defaultCenter.lng);
          }
        );
      }
    }

    // Click event on map
    mapInstance.addListener('click', (event) => {
      const clickedPos = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng(),
      };
      markerInstance.setPosition(clickedPos);
      setSelectedLocation(clickedPos);
      reverseGeocode(clickedPos.lat, clickedPos.lng);
    });

    // Drag event on marker
    markerInstance.addListener('dragend', (event) => {
      const draggedPos = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng(),
      };
      setSelectedLocation(draggedPos);
      reverseGeocode(draggedPos.lat, draggedPos.lng);
    });

    // Initialize autocomplete - FIXED: Wait for input element to be ready
    setTimeout(() => {
      if (searchInputRef.current && searchInputRef.current.input) {
        const inputElement = searchInputRef.current.input;
        
        const autocomplete = new window.google.maps.places.Autocomplete(inputElement, {
          fields: ['formatted_address', 'geometry', 'name'],
          componentRestrictions: { country: 'in' }, // Restrict to India
        });

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place.geometry && place.geometry.location) {
            const newPos = {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            };
            mapInstance.setCenter(newPos);
            mapInstance.setZoom(17);
            markerInstance.setPosition(newPos);
            setSelectedLocation(newPos);
            setAddress(place.formatted_address || place.name || '');
            setSearchQuery(''); // Clear search after selection
          }
        });

        autocompleteRef.current = autocomplete;
      }
    }, 100);

    setLoading(false);
  }, [initialLocation]);

  const reverseGeocode = async (lat, lng) => {
    if (!window.google) return;

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results[0]) {
        setAddress(results[0].formatted_address);
      }
    });
  };

  const handleConfirm = () => {
    if (!selectedLocation) {
      message.warning('Please select a location on the map');
      return;
    }

    onSelect({
      lat: selectedLocation.lat,
      lng: selectedLocation.lng,
      address: address,
    });
  };

  const handleSearch = () => {
    if (!searchQuery || !map) return;

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: searchQuery }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const newPos = {
          lat: results[0].geometry.location.lat(),
          lng: results[0].geometry.location.lng(),
        };
        map.setCenter(newPos);
        map.setZoom(17);
        marker.setPosition(newPos);
        setSelectedLocation(newPos);
        setAddress(results[0].formatted_address);
      } else {
        message.error('Location not found');
      }
    });
  };

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <Modal
        title={title}
        open={open}
        onCancel={onCancel}
        footer={null}
        width={800}
      >
        <div className="text-center py-8 text-red-500">
          <p>Google Maps API key is not configured.</p>
          <p className="text-sm mt-2">Please add VITE_GOOGLE_MAPS_API_KEY to your .env file</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={handleConfirm}
      okText="Confirm Location"
      width={900}
      bodyStyle={{ padding: 0 }}
      style={{ top: 20 }}
    >
      <div className="flex flex-col h-[600px]">
        {/* Search Bar */}
        <div className="p-4 border-b bg-gray-50">
          <div className="mb-3">
            <Input
              ref={searchInputRef}
              placeholder="Search for a place or address... (Start typing for suggestions)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              prefix={<SearchOutlined />}
              size="large"
              allowClear
              className="w-full"
              autoComplete="off"
            />
            <div className="text-xs text-gray-500 mt-1">
              💡 Tip: Type an address and select from dropdown suggestions
            </div>
          </div>
          
          {selectedLocation && (
            <div className="mt-3 text-sm">
              <div className="flex items-start gap-2">
                <EnvironmentOutlined className="text-blue-600 mt-1" />
                <div className="flex-1">
                  <div className="font-medium text-gray-700">Selected Location:</div>
                  <div className="text-gray-600 mt-1">{address || 'Getting address...'}</div>
                  <div className="text-gray-400 text-xs mt-1 font-mono">
                    {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
              <Spin size="large" tip="Loading map..." />
            </div>
          )}
          <div ref={mapRef} className="w-full h-full" />
        </div>

        {/* Instructions */}
        <div className="p-3 bg-blue-50 border-t text-sm text-blue-700">
          <div className="flex items-center justify-between">
            <div>
              <strong>💡 Tips:</strong> Type to search, click map, or drag marker. Address auto-fills.
            </div>
            {selectedLocation && (
              <div className="text-xs text-green-600 font-medium">
                ✓ Location selected
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default GoogleMapPicker;

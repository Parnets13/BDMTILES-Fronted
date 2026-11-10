import { useEffect, useRef } from 'react';
import { Input } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';

const { TextArea } = Input;

/**
 * Google Places Autocomplete Address Input Component
 * 
 * @param {Object} props
 * @param {string} props.value - Current address value
 * @param {function} props.onChange - Callback when address changes
 * @param {string} props.placeholder - Input placeholder
 * @param {number} props.rows - Number of rows for TextArea (default: 2)
 * @param {boolean} props.disabled - Disabled state
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.singleLine - Use Input instead of TextArea (default: false)
 * @param {function} props.onPlaceSelected - Callback with full place object
 */
const GoogleAddressInput = ({
  value,
  onChange,
  placeholder = 'Start typing address for suggestions...',
  rows = 2,
  disabled = false,
  className = '',
  singleLine = false,
  onPlaceSelected,
  ...rest
}) => {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);

  useEffect(() => {
    // Only initialize if Google Maps is loaded and not already initialized
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      console.warn('Google Maps API not loaded yet');
      return;
    }

    if (autocompleteRef.current) {
      return; // Already initialized
    }

    // Small delay to ensure Ant Design ref is ready
    const timer = setTimeout(() => {
      let inputElement;
      
      if (singleLine) {
        // For regular Input component
        inputElement = inputRef.current?.input;
      } else {
        // For TextArea component
        inputElement = inputRef.current?.resizableTextArea?.textArea;
      }

      if (!inputElement) {
        console.warn('Input element not found for Google Places Autocomplete');
        return;
      }

      try {
        // Initialize Google Places Autocomplete
        const autocomplete = new window.google.maps.places.Autocomplete(inputElement, {
          componentRestrictions: { country: 'in' }, // Restrict to India
          fields: ['formatted_address', 'address_components', 'geometry', 'name'],
          types: ['address'], // Only show addresses, not businesses
        });

        // Inject CSS to ensure dropdown appears above modals
        if (!document.getElementById('google-autocomplete-styles')) {
          const style = document.createElement('style');
          style.id = 'google-autocomplete-styles';
          style.innerHTML = `
            .pac-container {
              z-index: 10000 !important;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
              border-radius: 4px;
              margin-top: 4px;
            }
            .pac-item {
              padding: 8px 12px;
              cursor: pointer;
              font-size: 13px;
            }
            .pac-item:hover {
              background-color: #f5f5f5;
            }
            .pac-icon {
              margin-top: 4px;
            }
          `;
          document.head.appendChild(style);
        }

        // Listen for place selection
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          
          if (place.formatted_address) {
            // Update the value via onChange
            if (onChange) {
              onChange({ target: { value: place.formatted_address } });
            }

            // Call optional callback with full place data
            if (onPlaceSelected) {
              const addressComponents = {};
              
              if (place.address_components) {
                place.address_components.forEach(component => {
                  const types = component.types;
                  if (types.includes('locality')) {
                    addressComponents.city = component.long_name;
                  }
                  if (types.includes('administrative_area_level_1')) {
                    addressComponents.state = component.long_name;
                  }
                  if (types.includes('postal_code')) {
                    addressComponents.pinCode = component.long_name;
                  }
                  if (types.includes('country')) {
                    addressComponents.country = component.long_name;
                  }
                });
              }

              onPlaceSelected({
                address: place.formatted_address,
                name: place.name,
                coordinates: place.geometry?.location ? {
                  lat: place.geometry.location.lat(),
                  lng: place.geometry.location.lng(),
                } : null,
                ...addressComponents,
              });
            }
          }
        });

        autocompleteRef.current = autocomplete;
      } catch (error) {
        console.error('Error initializing Google Places Autocomplete:', error);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [singleLine, onChange, onPlaceSelected]);

  // Render based on singleLine prop
  if (singleLine) {
    return (
      <Input
        ref={inputRef}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        prefix={<EnvironmentOutlined className="text-gray-400" />}
        {...rest}
      />
    );
  }

  return (
    <TextArea
      ref={inputRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className={className}
      {...rest}
    />
  );
};

export default GoogleAddressInput;

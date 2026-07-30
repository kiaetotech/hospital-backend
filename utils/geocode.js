async function geocodeAddress(address, city) {
  try {
    const fullAddress = `${address}, ${city}, India`;
    const encodedAddress = encodeURIComponent(fullAddress);
    const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1`);
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon)
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

module.exports = geocodeAddress;
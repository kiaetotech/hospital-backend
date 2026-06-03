// POST /api/diagnostics/compare-package
router.post('/compare-package', async (req, res) => {
  try {
    const { testIds, lat, lng } = req.body;
    
    const tests = await TestMaster.find({ _id: { $in: testIds } });
    const pricing = await TestPricing.find({ test_id: { $in: testIds }, is_active: true })
      .populate('provider_id', 'provider_name rating total_reviews city location is_home_collection_available');
    
    const providerMap = new Map();
    for (const p of pricing) {
      const providerId = p.provider_id._id.toString();
      if (!providerMap.has(providerId)) {
        providerMap.set(providerId, {
          provider_name: p.provider_id.provider_name,
          rating: p.provider_id.rating,
          total_reviews: p.provider_id.total_reviews,
          home_collection: p.provider_id.is_home_collection_available || false,
          location: p.provider_id.location,
          total_price: 0,
          individual_prices: {},
          tests_found: []
        });
      }
      const entry = providerMap.get(providerId);
      entry.total_price += p.discounted_price;
      entry.individual_prices[p.test_id] = p.discounted_price;
      entry.tests_found.push(p.test_id.toString());
    }
    
    const testIdStrings = testIds.map(id => id.toString());
    let completeProviders = Array.from(providerMap.values())
      .filter(p => testIdStrings.every(tid => p.tests_found.includes(tid)));
    
    // Calculate distance if location provided
    if (lat && lng) {
      completeProviders = completeProviders.map(p => {
        if (p.location && p.location.lat) {
          const distance = calculateDistance(lat, lng, p.location.lat, p.location.lng);
          return { ...p, distance: distance.toFixed(1) };
        }
        return { ...p, distance: null };
      });
    }
    
    res.json({ success: true, tests, providers: completeProviders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
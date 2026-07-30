const mongoose = require('mongoose');
const InsurancePlan = require('../models/InsurancePlan');

class RecommendationService {
  constructor() {
    this.weights = {
      price: 0.25,
      coverage: 0.20,
      network: 0.15,
      claimSettlement: 0.15,
      features: 0.15,
      popularity: 0.10
    };
  }

  /**
   * Calculate plan score based on user profile
   */
  calculateScore(plan, userProfile, weights = this.weights) {
    let score = 0;

    // 1. Price Score (lower premium = higher score)
    const priceScore = this.calculatePriceScore(plan, userProfile);
    score += priceScore * weights.price;

    // 2. Coverage Score
    const coverageScore = this.calculateCoverageScore(plan, userProfile);
    score += coverageScore * weights.coverage;

    // 3. Network Score
    const networkScore = this.calculateNetworkScore(plan, userProfile);
    score += networkScore * weights.network;

    // 4. Claim Settlement Score
    const claimScore = this.calculateClaimScore(plan);
    score += claimScore * weights.claimSettlement;

    // 5. Features Score
    const featuresScore = this.calculateFeaturesScore(plan, userProfile);
    score += featuresScore * weights.features;

    // 6. Popularity Score
    const popularityScore = this.calculatePopularityScore(plan);
    score += popularityScore * weights.popularity;

    return Math.round(score * 100) / 100;
  }

  /**
   * Calculate price score
   */
  calculatePriceScore(plan, userProfile) {
    const premium = plan.personalizedPremium || plan.basePremium;
    const userBudget = userProfile.budget || 50000; // Default budget per year
    
    if (premium <= userBudget * 0.7) {
      return 1.0;
    } else if (premium <= userBudget) {
      return 0.7;
    } else if (premium <= userBudget * 1.3) {
      return 0.4;
    } else {
      return 0.1;
    }
  }

  /**
   * Calculate coverage score
   */
  calculateCoverageScore(plan, userProfile) {
    const sumInsured = plan.sumInsured?.default || 500000;
    const minCoverage = userProfile.minCoverage || 200000;
    
    if (sumInsured >= minCoverage * 2) {
      return 1.0;
    } else if (sumInsured >= minCoverage) {
      return 0.7;
    } else {
      return 0.3;
    }
  }

  /**
   * Calculate network score
   */
  calculateNetworkScore(plan, userProfile) {
    const networkCount = plan.totalNetworkHospitals || 0;
    const userLocation = userProfile.pincode || '110001';
    
    // Check if plan has hospitals in user's area
    const hasLocalNetwork = plan.networkHospitals?.some(h => 
      h.pincode === userLocation
    ) || false;
    
    if (networkCount > 10000 && hasLocalNetwork) {
      return 1.0;
    } else if (networkCount > 5000) {
      return 0.7;
    } else if (networkCount > 1000) {
      return 0.4;
    } else {
      return 0.2;
    }
  }

  /**
   * Calculate claim settlement score
   */
  calculateClaimScore(plan) {
    const ratio = plan.claimProcess?.claimSettlementRatio || 95;
    
    if (ratio >= 95) {
      return 1.0;
    } else if (ratio >= 90) {
      return 0.8;
    } else if (ratio >= 85) {
      return 0.6;
    } else if (ratio >= 80) {
      return 0.4;
    } else {
      return 0.2;
    }
  }

  /**
   * Calculate features score
   */
  calculateFeaturesScore(plan, userProfile) {
    const features = plan.features || [];
    const userNeeds = userProfile.requiredFeatures || [];
    
    let matchedFeatures = 0;
    userNeeds.forEach(need => {
      if (features.some(f => f.title.toLowerCase().includes(need.toLowerCase()))) {
        matchedFeatures++;
      }
    });
    
    if (userNeeds.length === 0) return 0.5;
    return matchedFeatures / userNeeds.length;
  }

  /**
   * Calculate popularity score
   */
  calculatePopularityScore(plan) {
    const views = plan.views || 0;
    const applications = plan.applications || 0;
    const conversions = plan.conversions || 0;
    
    const popularity = views + applications * 2 + conversions * 5;
    const maxPopularity = 10000;
    
    return Math.min(popularity / maxPopularity, 1);
  }

  /**
   * Get personalized plan recommendations
   */
  async getRecommendations(userProfile, limit = 10) {
    try {
      // Fetch all active plans
      const plans = await InsurancePlan.find({ 
        isActive: true 
      }).populate('companyId', 'name companyLogo');

      // Score each plan
      const scoredPlans = plans.map(plan => {
        const planObj = plan.toObject();
        const score = this.calculateScore(plan, userProfile);
        
        // Add matching factors
        const matchingFactors = [];
        if (userProfile.planType && plan.planType === userProfile.planType) {
          matchingFactors.push('plan_type_match');
        }
        if (userProfile.age >= plan.minEntryAge && userProfile.age <= plan.maxEntryAge) {
          matchingFactors.push('age_match');
        }
        if (userProfile.membersCount > 1 && plan.planType === 'family_floater') {
          matchingFactors.push('family_floater');
        }
        
        return {
          ...planObj,
          score: score,
          matchingFactors: matchingFactors,
          matchPercentage: Math.round(score * 100)
        };
      });

      // Sort by score descending
      scoredPlans.sort((a, b) => b.score - a.score);

      // Get top recommendations
      const recommendations = scoredPlans.slice(0, limit);

      // Group recommendations
      const groups = this.groupRecommendations(recommendations);

      return {
        success: true,
        data: {
          recommendations: recommendations,
          groups: groups,
          topMatch: recommendations[0] || null,
          count: recommendations.length
        }
      };

    } catch (error) {
      console.error('Recommendation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Group recommendations by type
   */
  groupRecommendations(recommendations) {
    const groups = {
      bestValue: [],
      bestCoverage: [],
      mostPopular: [],
      bestFeatures: []
    };

    recommendations.forEach(plan => {
      if (plan.score > 0.7) groups.bestValue.push(plan);
      if (plan.sumInsured?.default > 1000000) groups.bestCoverage.push(plan);
      if (plan.views > 1000) groups.mostPopular.push(plan);
      if ((plan.features || []).length > 5) groups.bestFeatures.push(plan);
    });

    return groups;
  }

  /**
   * Get trending plans
   */
  async getTrendingPlans(limit = 10) {
    try {
      const plans = await InsurancePlan.find({ 
        isActive: true 
      })
        .sort({ views: -1, applications: -1 })
        .limit(limit)
        .populate('companyId', 'name companyLogo');

      return {
        success: true,
        data: plans
      };

    } catch (error) {
      console.error('Trending plans error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user-based recommendations (collaborative filtering)
   */
  async getUserBasedRecommendations(userId, limit = 10) {
    try {
      // Get user's existing policies
      const userPolicies = await mongoose.model('InsurancePolicy')
        .find({ userId })
        .populate('planId');

      if (userPolicies.length === 0) {
        return this.getPopularPlans(limit);
      }

      // Find similar users (simplified)
      const similarUsers = await mongoose.model('InsurancePolicy')
        .aggregate([
          {
            $match: {
              userId: { $ne: userId },
              planId: { $in: userPolicies.map(p => p.planId) }
            }
          },
          {
            $group: {
              _id: '$userId',
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]);

      if (similarUsers.length === 0) {
        return this.getPopularPlans(limit);
      }

      // Get plans that similar users have
      const similarUserIds = similarUsers.map(u => u._id);
      const recommendedPlans = await mongoose.model('InsurancePolicy')
        .aggregate([
          {
            $match: {
              userId: { $in: similarUserIds },
              planId: { $nin: userPolicies.map(p => p.planId) }
            }
          },
          {
            $group: {
              _id: '$planId',
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } },
          { $limit: limit }
        ]);

      const planIds = recommendedPlans.map(p => p._id);
      const plans = await InsurancePlan.find({
        _id: { $in: planIds },
        isActive: true
      }).populate('companyId', 'name companyLogo');

      return {
        success: true,
        data: plans,
        method: 'collaborative_filtering'
      };

    } catch (error) {
      console.error('User-based recommendations error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get popular plans fallback
   */
  async getPopularPlans(limit = 10) {
    return this.getTrendingPlans(limit);
  }
}

module.exports = new RecommendationService();
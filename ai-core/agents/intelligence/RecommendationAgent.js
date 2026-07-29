// D:\hospital backend\ai-core\agents\intelligence\RecommendationAgent.js

const { AgentRole, AgentStatus } = require('../../../shared/types/AgentTypes');
const { BaseAgent } = require('../base/BaseAgent');

class RecommendationAgent extends BaseAgent {
  constructor(providerManager) {
    super(
      {
        name: 'Recommendation Agent',
        role: AgentRole.RECOMMENDATION,
        capabilities: [
          {
            name: 'personalize_recommendations',
            description: 'Generate personalized recommendations for users',
            priority: 1,
            estimatedLatency: 300,
            requiresAuth: true
          },
          {
            name: 'suggest_hospitals',
            description: 'Suggest hospitals based on user preferences',
            priority: 1,
            estimatedLatency: 200,
            requiresAuth: true
          },
          {
            name: 'suggest_doctors',
            description: 'Suggest doctors based on user needs',
            priority: 1,
            estimatedLatency: 200,
            requiresAuth: true
          },
          {
            name: 'suggest_packages',
            description: 'Suggest health packages and wellness programs',
            priority: 2,
            estimatedLatency: 250,
            requiresAuth: true
          }
        ]
      },
      providerManager
    );

    this.userProfiles = new Map();
    this.initializeUserProfiles();
  }

  initializeUserProfiles() {
    this.userProfiles.set('user1', {
      id: 'user1',
      preferences: ['Cardiology', 'Orthopedics', 'Wellness'],
      pastBookings: ['Apollo Hospital', 'Dr. Rajesh Kumar'],
      location: 'Mumbai',
      age: 45,
      gender: 'Male',
      medicalHistory: ['Hypertension', 'High Cholesterol'],
      engagementScore: 85,
      lastActive: new Date()
    });

    this.userProfiles.set('user2', {
      id: 'user2',
      preferences: ['Dermatology', 'Ayurveda', 'Mental Health'],
      pastBookings: ['SRL Diagnostics', 'Dr. Anjali Sharma'],
      location: 'Delhi',
      age: 32,
      gender: 'Female',
      medicalHistory: ['Skin Allergy', 'Anxiety'],
      engagementScore: 70,
      lastActive: new Date()
    });
  }

  async execute(request) {
    this.setStatus(AgentStatus.BUSY);
    this.setCurrentTask(request.task);

    try {
      if (!this.validateRequest(request)) {
        throw new Error('Invalid request: Missing required fields or capabilities');
      }

      var task = request.task;
      var payload = request.payload;
      this.log('Executing task: ' + task, 'info');

      var result;

      if (task.includes('personalize')) {
        result = await this.personalizeRecommendations(payload);
      } else if (task.includes('hospital')) {
        result = await this.suggestHospitals(payload);
      } else if (task.includes('doctor')) {
        result = await this.suggestDoctors(payload);
      } else if (task.includes('package')) {
        result = await this.suggestPackages(payload);
      } else {
        result = await this.handleComplexQuery(task, payload);
      }

      this.setStatus(AgentStatus.IDLE);
      this.setCurrentTask(null);

      return {
        success: true,
        data: result,
        sourceAgent: this.id,
        processingTime: Date.now() - new Date().getTime()
      };

    } catch (error) {
      this.setStatus(AgentStatus.IDLE);
      this.setCurrentTask(null);
      return this.handleError(error, request);
    }
  }

  async personalizeRecommendations(payload) {
    var userId = payload.userId;
    var limit = payload.limit || 5;

    var userProfile = this.userProfiles.get(userId);
    if (!userProfile) {
      throw new Error('User not found');
    }

    var hospitalSuggestions = await this.suggestHospitals({ userId: userId, limit: 3 });
    var doctorSuggestions = await this.suggestDoctors({ userId: userId, limit: 3 });
    var packageSuggestions = await this.suggestPackages({ userId: userId, limit: 2 });

    var allRecommendations = [];
    var hospRecs = hospitalSuggestions.recommendations || [];
    var docRecs = doctorSuggestions.recommendations || [];
    var pkgRecs = packageSuggestions.recommendations || [];

    for (var i = 0; i < hospRecs.length; i++) allRecommendations.push(hospRecs[i]);
    for (var j = 0; j < docRecs.length; j++) allRecommendations.push(docRecs[j]);
    for (var k = 0; k < pkgRecs.length; k++) allRecommendations.push(pkgRecs[k]);

    allRecommendations.sort(function(a, b) { return b.matchScore - a.matchScore; });

    var prompt = 'User Profile: ' + JSON.stringify(userProfile) + '\n' +
      'Recommendations: ' + JSON.stringify(allRecommendations.slice(0, limit)) + '\n\n' +
      'Provide personalized recommendations for this user.';

    var response = await this.providerManager.generate(prompt);

    return {
      recommendations: allRecommendations.slice(0, limit),
      userProfile: userProfile,
      aiInsights: response.content,
      total: allRecommendations.length,
      timestamp: new Date().toISOString()
    };
  }

  async suggestHospitals(payload) {
    var userId = payload.userId;
    var limit = payload.limit || 5;

    var userProfile = this.userProfiles.get(userId);
    if (!userProfile) {
      throw new Error('User not found');
    }

    var mockHospitals = [
      {
        id: 'h1',
        type: 'Hospital',
        name: 'Apollo Hospital Mumbai',
        description: 'Multi-specialty hospital with excellent cardiology department',
        matchScore: 95,
        reason: 'Matches your preference for cardiology',
        metadata: { rating: 4.8, beds: 500, city: 'Mumbai' }
      },
      {
        id: 'h2',
        type: 'Hospital',
        name: 'Fortis Hospital Mumbai',
        description: 'Best orthopedic and joint replacement center',
        matchScore: 88,
        reason: 'Matches your preference for orthopedics',
        metadata: { rating: 4.6, beds: 300, city: 'Mumbai' }
      },
      {
        id: 'h3',
        type: 'Hospital',
        name: 'AIIMS Delhi',
        description: 'Premier government hospital with all specialties',
        matchScore: 82,
        reason: 'High reputation across all specialties',
        metadata: { rating: 4.9, beds: 2000, city: 'Delhi' }
      }
    ];

    var results = mockHospitals.filter(function(h) {
      return h.metadata.city === userProfile.location;
    });

    if (results.length === 0) {
      results = mockHospitals;
    }

    results.sort(function(a, b) { return b.matchScore - a.matchScore; });

    return {
      recommendations: results.slice(0, limit),
      total: results.length,
      userLocation: userProfile.location
    };
  }

  async suggestDoctors(payload) {
    var userId = payload.userId;
    var limit = payload.limit || 5;

    var userProfile = this.userProfiles.get(userId);
    if (!userProfile) {
      throw new Error('User not found');
    }

    var mockDoctors = [
      {
        id: 'd1',
        type: 'Doctor',
        name: 'Dr. Rajesh Kumar',
        description: 'Senior Cardiologist - 15 years experience',
        matchScore: 92,
        reason: 'Specialist in cardiology, matches your preference',
        metadata: { specialty: 'Cardiology', experience: 15, rating: 4.9 }
      },
      {
        id: 'd2',
        type: 'Doctor',
        name: 'Dr. Priya Sharma',
        description: 'Orthopedic Surgeon - 12 years experience',
        matchScore: 85,
        reason: 'Expert in orthopedic surgery',
        metadata: { specialty: 'Orthopedics', experience: 12, rating: 4.7 }
      },
      {
        id: 'd3',
        type: 'Doctor',
        name: 'Dr. Anjali Sharma',
        description: 'Ayurveda Specialist - 15 years experience',
        matchScore: 78,
        reason: 'Matches your wellness preference',
        metadata: { specialty: 'Ayurveda', experience: 15, rating: 4.9 }
      }
    ];

    var results = mockDoctors;

    if (userProfile.preferences.length > 0) {
      results = results.filter(function(d) {
        return userProfile.preferences.some(function(p) {
          return d.metadata.specialty.toLowerCase().includes(p.toLowerCase());
        });
      });
    }

    if (results.length === 0) {
      results = mockDoctors;
    }

    results.sort(function(a, b) { return b.matchScore - a.matchScore; });

    return {
      recommendations: results.slice(0, limit),
      total: results.length
    };
  }

  async suggestPackages(payload) {
    var userId = payload.userId;
    var limit = payload.limit || 5;

    var userProfile = this.userProfiles.get(userId);
    if (!userProfile) {
      throw new Error('User not found');
    }

    var mockPackages = [
      {
        id: 'p1',
        type: 'Package',
        name: 'Comprehensive Health Checkup',
        description: '50+ tests including cardiac and diabetic screening',
        matchScore: 90,
        reason: 'Matches your age group and health profile',
        metadata: { price: 4999, tests: 50, includes: ['CBC', 'Lipid Profile', 'Thyroid'] }
      },
      {
        id: 'p2',
        type: 'Package',
        name: 'Wellness Ayurveda Program',
        description: '7-day Panchakarma detox and rejuvenation',
        matchScore: 85,
        reason: 'Matches your wellness preference',
        metadata: { price: 15000, duration: '7 days', includes: ['Panchakarma', 'Abhyanga'] }
      },
      {
        id: 'p3',
        type: 'Package',
        name: 'Mental Wellness Program',
        description: '6-week anxiety and stress management program',
        matchScore: 80,
        reason: 'Matches your mental health needs',
        metadata: { price: 18000, duration: '6 weeks', includes: ['CBT', 'Mindfulness'] }
      }
    ];

    var results = mockPackages;

    if (userProfile.preferences.length > 0) {
      results = results.filter(function(p) {
        return userProfile.preferences.some(function(pref) {
          return p.name.toLowerCase().includes(pref.toLowerCase()) ||
            p.description.toLowerCase().includes(pref.toLowerCase());
        });
      });
    }

    if (results.length === 0) {
      results = mockPackages;
    }

    results.sort(function(a, b) { return b.matchScore - a.matchScore; });

    return {
      recommendations: results.slice(0, limit),
      total: results.length
    };
  }

  async handleComplexQuery(task, payload) {
    var prompt = 'Task: ' + task + '\n' +
      'Payload: ' + JSON.stringify(payload) + '\n\n' +
      'User Profiles: ' + JSON.stringify(Array.from(this.userProfiles.entries())) + '\n\n' +
      'Please analyze the query and provide a recommendation.';

    var response = await this.providerManager.generate(prompt);

    return {
      aiResponse: response.content,
      provider: response.provider,
      tokensUsed: response.tokensUsed
    };
  }

  getRequiredCapability(task) {
    if (task.includes('personalize')) {
      return 'personalize_recommendations';
    }
    if (task.includes('hospital')) {
      return 'suggest_hospitals';
    }
    if (task.includes('doctor')) {
      return 'suggest_doctors';
    }
    if (task.includes('package')) {
      return 'suggest_packages';
    }
    return null;
  }
}

module.exports = { RecommendationAgent };
"use strict";
// D:\hospital backend\ai-core\agents\intelligence\RecommendationAgent.ts
Object.defineProperty(exports, "__esModule", { value});
exports.RecommendationAgent = void 0;
const AgentTypes_1 = require("../../../shared/types/AgentTypes");
const BaseAgent_1 = require("../base/BaseAgent");
class RecommendationAgent extends BaseAgent_1.BaseAgent {
    constructor(providerManager) {
        super({
            name: 'Recommendation Agent',
            role_1.AgentRole.RECOMMENDATION,
            capabilities: [
                {
                    name: 'personalize_recommendations',
                    description: 'Generate personalized recommendations for users',
                    priority: 1,
                    estimatedLatency: 300,
                    requiresAuth},
                {
                    name: 'suggest_hospitals',
                    description: 'Suggest hospitals based on user preferences',
                    priority: 1,
                    estimatedLatency: 200,
                    requiresAuth},
                {
                    name: 'suggest_doctors',
                    description: 'Suggest doctors based on user needs',
                    priority: 1,
                    estimatedLatency: 200,
                    requiresAuth},
                {
                    name: 'suggest_packages',
                    description: 'Suggest health packages and wellness programs',
                    priority: 2,
                    estimatedLatency: 250,
                    requiresAuth}
            ]
        }, providerManager);
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
            lastActiveDate()
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
            lastActiveDate()
        });
    }
    async execute(request) {
        this.setStatus(AgentTypes_1.AgentStatus.BUSY);
        this.setCurrentTask(request.task);
        try {
            if (!this.validateRequest(request)) {
                throw new Error('Invalid requestrequired fields or capabilities');
            }
            const { task, payload } = request;
            this.log(`Executing task: ${task}`, 'info');
            let result;
            if (task.includes('personalize')) {
                result = await this.personalizeRecommendations(payload);
            }
            else if (task.includes('hospital')) {
                result = await this.suggestHospitals(payload);
            }
            else if (task.includes('doctor')) {
                result = await this.suggestDoctors(payload);
            }
            else if (task.includes('package')) {
                result = await this.suggestPackages(payload);
            }
            else {
                result = await this.handleComplexQuery(task, payload);
            }
            this.setStatus(AgentTypes_1.AgentStatus.IDLE);
            this.setCurrentTask(undefined);
            return {
                success,
                data,
                sourceAgent.id,
                processingTime.now() - new Date().getTime()
            };
        }
        catch (error) {
            this.setStatus(AgentTypes_1.AgentStatus.IDLE);
            this.setCurrentTask(undefined);
            return this.handleError(error, request);
        }
    }
    async personalizeRecommendations(payload) {
        const { userId, limit = 5 } = payload;
        const userProfile = this.userProfiles.get(userId);
        if (!userProfile) {
            throw new Error('User not found');
        }
        // Get all recommendations
        const hospitalSuggestions = await this.suggestHospitals({ userId, limit: 3 });
        const doctorSuggestions = await this.suggestDoctors({ userId, limit: 3 });
        const packageSuggestions = await this.suggestPackages({ userId, limit: 2 });
        // Combine and sort by match score
        const allRecommendations = [
            ...(hospitalSuggestions.recommendations || []),
            ...(doctorSuggestions.recommendations || []),
            ...(packageSuggestions.recommendations || [])
        ];
        allRecommendations.sort((a, b) => b.matchScore - a.matchScore);
        // Use AI to refine recommendations
        const prompt = `
      User Profile: ${JSON.stringify(userProfile)}
      Recommendations: ${JSON.stringify(allRecommendations.slice(0, limit))}
      
      Provide personalized recommendations for this user.
    `;
        const response = await this.providerManager.generate(prompt);
        return {
            recommendations.slice(0, limit),
            userProfile,
            aiInsights.content,
            total.length,
            timestampDate().toISOString()
        };
    }
    async suggestHospitals(payload) {
        const { userId, limit = 5 } = payload;
        const userProfile = this.userProfiles.get(userId);
        if (!userProfile) {
            throw new Error('User not found');
        }
        const mockHospitals = [
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
        // Filter by location
        let results = mockHospitals.filter(h => h.metadata.city === userProfile.location);
        // If no results in city, show nearby
        if (results.length === 0) {
            results = mockHospitals;
        }
        results.sort((a, b) => b.matchScore - a.matchScore);
        return {
            recommendations.slice(0, limit),
            total.length,
            userLocation.location
        };
    }
    async suggestDoctors(payload) {
        const { userId, limit = 5 } = payload;
        const userProfile = this.userProfiles.get(userId);
        if (!userProfile) {
            throw new Error('User not found');
        }
        const mockDoctors = [
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
        let results = mockDoctors;
        // Filter by user preferences
        if (userProfile.preferences.length > 0) {
            results = results.filter(d => userProfile.preferences.some(p => d.metadata.specialty.toLowerCase().includes(p.toLowerCase())));
        }
        // If no results, show all
        if (results.length === 0) {
            results = mockDoctors;
        }
        results.sort((a, b) => b.matchScore - a.matchScore);
        return {
            recommendations.slice(0, limit),
            total.length
        };
    }
    async suggestPackages(payload) {
        const { userId, limit = 5 } = payload;
        const userProfile = this.userProfiles.get(userId);
        if (!userProfile) {
            throw new Error('User not found');
        }
        const mockPackages = [
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
        let results = mockPackages;
        // Filter by user preferences
        if (userProfile.preferences.length > 0) {
            results = results.filter(p => userProfile.preferences.some(pref => p.name.toLowerCase().includes(pref.toLowerCase()) ||
                p.description.toLowerCase().includes(pref.toLowerCase())));
        }
        if (results.length === 0) {
            results = mockPackages;
        }
        results.sort((a, b) => b.matchScore - a.matchScore);
        return {
            recommendations.slice(0, limit),
            total.length
        };
    }
    async handleComplexQuery(task, payload) {
        const prompt = `
      Task: ${task}
      Payload: ${JSON.stringify(payload)}
      
      User Profiles: ${JSON.stringify(Array.from(this.userProfiles.entries()))}
      
      Please analyze the query and provide a recommendation.
    `;
        const response = await this.providerManager.generate(prompt);
        return {
            aiResponse.content,
            provider.provider,
            tokensUsed.tokensUsed
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
exports.RecommendationAgent = RecommendationAgent;



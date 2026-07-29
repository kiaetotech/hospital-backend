"use strict";
// D:\hospital backend\ai-core\agents\operations\AnalyticsAgent.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsAgent = void 0;
const AgentTypes_1 = require("../../../shared/types/AgentTypes");
const BaseAgent_1 = require("../base/BaseAgent");
class AnalyticsAgent extends BaseAgent_1.BaseAgent {
    constructor(providerManager) {
        super({
            name: 'Analytics Agent',
            role: AgentTypes_1.AgentRole.ANALYTICS,
            capabilities: [
                {
                    name: 'generate_kpi',
                    description: 'Generate and track KPIs',
                    priority: 1,
                    estimatedLatency: 150,
                    requiresAuth: true
                },
                {
                    name: 'generate_report',
                    description: 'Generate analytics reports',
                    priority: 1,
                    estimatedLatency: 300,
                    requiresAuth: true
                },
                {
                    name: 'predict_trend',
                    description: 'Predict future trends',
                    priority: 2,
                    estimatedLatency: 400,
                    requiresAuth: true
                },
                {
                    name: 'analyze_business',
                    description: 'Analyze business health',
                    priority: 2,
                    estimatedLatency: 250,
                    requiresAuth: true
                }
            ]
        }, providerManager);
        this.kpis = [];
        this.reports = [];
        this.predictions = [];
        this.initializeData();
    }
    initializeData() {
        this.kpis = [
            {
                id: 'k1',
                name: 'Monthly Revenue',
                value: 2450000,
                target: 3000000,
                unit: '₹',
                category: 'Revenue',
                trend: 'Up',
                percentageChange: 12.5,
                timestamp: new Date()
            },
            {
                id: 'k2',
                name: 'Active Users',
                value: 12500,
                target: 15000,
                unit: 'users',
                category: 'Growth',
                trend: 'Up',
                percentageChange: 8.3,
                timestamp: new Date()
            },
            {
                id: 'k3',
                name: 'Booking Completion Rate',
                value: 82,
                target: 90,
                unit: '%',
                category: 'Operations',
                trend: 'Stable',
                percentageChange: 0.5,
                timestamp: new Date()
            },
            {
                id: 'k4',
                name: 'Customer Satisfaction',
                value: 4.6,
                target: 4.8,
                unit: 'stars',
                category: 'Satisfaction',
                trend: 'Up',
                percentageChange: 2.2,
                timestamp: new Date()
            }
        ];
        this.predictions = [
            {
                metric: 'Monthly Revenue',
                currentValue: 2450000,
                predictedValue: 2800000,
                confidence: 85,
                timeframe: 'Next Month',
                factors: ['Seasonal increase', 'New partnerships', 'Marketing campaigns']
            },
            {
                metric: 'Active Users',
                currentValue: 12500,
                predictedValue: 14000,
                confidence: 78,
                timeframe: 'Next Month',
                factors: ['User acquisition', 'Referral program', 'New features']
            }
        ];
    }
    async execute(request) {
        this.setStatus(AgentTypes_1.AgentStatus.BUSY);
        this.setCurrentTask(request.task);
        try {
            if (!this.validateRequest(request)) {
                throw new Error('Invalid request: Missing required fields or capabilities');
            }
            const { task, payload } = request;
            this.log(`Executing task: ${task}`, 'info');
            let result;
            if (task.includes('kpi')) {
                result = await this.generateKPI(payload);
            }
            else if (task.includes('report')) {
                result = await this.generateReport(payload);
            }
            else if (task.includes('predict') || task.includes('trend')) {
                result = await this.predictTrend(payload);
            }
            else if (task.includes('business') || task.includes('analyze')) {
                result = await this.analyzeBusiness(payload);
            }
            else {
                result = await this.handleComplexQuery(task, payload);
            }
            this.setStatus(AgentTypes_1.AgentStatus.IDLE);
            this.setCurrentTask(undefined);
            return {
                success: true,
                data: result,
                sourceAgent: this.id,
                processingTime: Date.now() - new Date().getTime()
            };
        }
        catch (error) {
            this.setStatus(AgentTypes_1.AgentStatus.IDLE);
            this.setCurrentTask(undefined);
            return this.handleError(error, request);
        }
    }
    async generateKPI(payload) {
        const { category, kpiId } = payload;
        let targetKPIs = this.kpis;
        if (category) {
            targetKPIs = this.kpis.filter(k => k.category === category);
        }
        if (kpiId) {
            const kpi = this.kpis.find(k => k.id === kpiId);
            if (!kpi) {
                throw new Error('KPI not found');
            }
            targetKPIs = [kpi];
        }
        const formatted = targetKPIs.map(k => ({
            ...k,
            progress: Math.round((k.value / k.target) * 100),
            status: k.value >= k.target ? 'On Target' : 'Below Target'
        }));
        return {
            kpis: formatted,
            total: formatted.length,
            summary: {
                averageProgress: Math.round(formatted.reduce((sum, k) => sum + k.progress, 0) / formatted.length),
                healthyKPIs: formatted.filter(k => k.progress >= 80).length
            }
        };
    }
    async generateReport(payload) {
        const { type, period, reportId } = payload;
        if (reportId) {
            const report = this.reports.find(r => r.id === reportId);
            if (!report) {
                throw new Error('Report not found');
            }
            return { report };
        }
        // Generate new report
        const reportType = type || 'Monthly';
        const reportPeriod = period || new Date().toISOString().slice(0, 7);
        // Gather all KPIs
        const kpiData = await this.generateKPI({});
        // Generate insights using AI
        const prompt = `
      Generate a comprehensive ${reportType} analytics report for ${reportPeriod}.
      
      Current KPIs:
      ${JSON.stringify(kpiData.kpis)}
      
      Provide:
      1. Executive summary
      2. Key trends
      3. Areas of concern
      4. Recommendations
    `;
        const response = await this.providerManager.generate(prompt);
        const report = {
            id: `r${Date.now()}`,
            name: `${reportType} Report - ${reportPeriod}`,
            type: reportType,
            period: reportPeriod,
            data: {
                kpis: kpiData.kpis,
                insights: response.content,
                generatedAt: new Date().toISOString()
            },
            generatedAt: new Date(),
            createdBy: 'Analytics Agent'
        };
        this.reports.push(report);
        return {
            report,
            message: `${reportType} report generated successfully`,
            timestamp: new Date().toISOString()
        };
    }
    async predictTrend(payload) {
        const { metric } = payload;
        let targetPredictions = this.predictions;
        if (metric) {
            targetPredictions = this.predictions.filter(p => p.metric.toLowerCase().includes(metric.toLowerCase()));
        }
        // Use AI to enhance predictions
        if (targetPredictions.length === 0) {
            const prompt = `
        Predict trends for healthcare platform:
        Current metrics: ${JSON.stringify(this.kpis)}
        
        Provide predictions for:
        1. Revenue
        2. User growth
        3. Booking volume
        4. Satisfaction
      `;
            const response = await this.providerManager.generate(prompt);
            return {
                predictions: response.content,
                provider: response.provider,
                tokensUsed: response.tokensUsed,
                timestamp: new Date().toISOString()
            };
        }
        return {
            predictions: targetPredictions,
            summary: {
                total: targetPredictions.length,
                highConfidence: targetPredictions.filter(p => p.confidence > 80).length
            },
            timestamp: new Date().toISOString()
        };
    }
    async analyzeBusiness(payload) {
        const { perspective } = payload;
        // Gather all data
        const kpiData = await this.generateKPI({});
        const trendData = await this.predictTrend({});
        // Build business health assessment
        const kpis = kpiData.kpis;
        const revenueKPI = kpis.find(k => k.name === 'Monthly Revenue');
        const userKPI = kpis.find(k => k.name === 'Active Users');
        const satisfactionKPI = kpis.find(k => k.name === 'Customer Satisfaction');
        const healthScore = [
            revenueKPI?.progress || 0,
            userKPI?.progress || 0,
            satisfactionKPI?.progress || 0
        ].reduce((sum, val) => sum + val, 0) / 3;
        // Generate business insights
        const prompt = `
      Analyze the business health from ${perspective || 'overall'} perspective:
      
      Revenue: ${JSON.stringify(revenueKPI)}
      Users: ${JSON.stringify(userKPI)}
      Satisfaction: ${JSON.stringify(satisfactionKPI)}
      Predictions: ${JSON.stringify(trendData)}
      
      Provide:
      1. Business health assessment
      2. Strengths
      3. Weaknesses
      4. Opportunities
      5. Threats
      6. Strategic recommendations
    `;
        const response = await this.providerManager.generate(prompt);
        return {
            healthScore: Math.round(healthScore),
            healthStatus: healthScore > 80 ? 'Excellent' : healthScore > 60 ? 'Good' : healthScore > 40 ? 'Fair' : 'Critical',
            kpis: kpis,
            predictions: trendData,
            insights: response.content,
            provider: response.provider,
            tokensUsed: response.tokensUsed,
            timestamp: new Date().toISOString()
        };
    }
    async handleComplexQuery(task, payload) {
        const prompt = `
      Task: ${task}
      Payload: ${JSON.stringify(payload)}
      
      Analytics Data:
      KPIs: ${JSON.stringify(this.kpis)}
      Reports: ${JSON.stringify(this.reports)}
      Predictions: ${JSON.stringify(this.predictions)}
      
      Please analyze the query and provide a recommendation.
    `;
        const response = await this.providerManager.generate(prompt);
        return {
            aiResponse: response.content,
            provider: response.provider,
            tokensUsed: response.tokensUsed
        };
    }
    getRequiredCapability(task) {
        if (task.includes('kpi')) {
            return 'generate_kpi';
        }
        if (task.includes('report')) {
            return 'generate_report';
        }
        if (task.includes('predict') || task.includes('trend')) {
            return 'predict_trend';
        }
        if (task.includes('business') || task.includes('analyze')) {
            return 'analyze_business';
        }
        return null;
    }
}
exports.AnalyticsAgent = AnalyticsAgent;

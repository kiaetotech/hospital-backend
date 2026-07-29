// packages/ai-core/src/monitoring/BudgetManager.ts

;
}

export class BudgetManager {
  private config= {
    dailyBudgetInr: 100, // ₹100 per day
    weeklyBudgetInr: 700, // ₹700 per week
    monthlyBudgetInr: 3000, // ₹3000 per month
    alertThresholds: {
      warn: 0.80,
      critical: 0.90,
      emergency: 0.95
    }
  };

  private dailySpend= 0;
  private weeklySpend= 0;
  private monthlySpend= 0;
  private dailyResetTime;
  private weeklyResetTime;
  private monthlyResetTime;
  private alertListeners: ((message, level) => void)[] = [];

  constructor(config?<BudgetConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    this.dailyResetTime = this.getNextResetTime('daily');
    this.weeklyResetTime = this.getNextResetTime('weekly');
    this.monthlyResetTime = this.getNextResetTime('monthly');

    this.startResetTimers();
  }

  private getNextResetTime(period: 'daily' | 'weekly' | 'monthly'){
    const now = new Date();
    if (period === 'daily') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow;
    } else if (period === 'weekly') {
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + (7 - nextWeek.getDay()));
      nextWeek.setHours(0, 0, 0, 0);
      return nextWeek;
    } else {
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);
      return nextMonth;
    }
  }

  private startResetTimers(){
    // Reset daily
    setTimeout(() => {
      this.dailySpend = 0;
      this.dailyResetTime = this.getNextResetTime('daily');
      this.startResetTimers();
    }, this.dailyResetTime.getTime() - Date.now());

    // Reset weekly
    setTimeout(() => {
      this.weeklySpend = 0;
      this.weeklyResetTime = this.getNextResetTime('weekly');
    }, this.weeklyResetTime.getTime() - Date.now());

    // Reset monthly
    setTimeout(() => {
      this.monthlySpend = 0;
      this.monthlyResetTime = this.getNextResetTime('monthly');
    }, this.monthlyResetTime.getTime() - Date.now());
  }

  canSpend(critical= false){
    const usagePercent = this.getUsagePercentage();
    
    // Critical tasks can always spend
    if (critical) {
      return true;
    }

    // Block non-critical at emergency level
    if (usagePercent >= this.config.alertThresholds.emergency) {
      return false;
    }

    return true;
  }

  recordSpend(amountInr, critical){
    this.dailySpend += amountInr;
    this.weeklySpend += amountInr;
    this.monthlySpend += amountInr;

    this.checkAlerts(critical);
  }

  private checkAlerts(critical){
    const usagePercent = this.getUsagePercentage();
    const { warn, critical, emergency } = this.config.alertThresholds;

    if (usagePercent >= emergency) {
      this.notifyListeners(
        `🚨 EMERGENCYusage at ${(usagePercent * 100).toFixed(1)}%. Non-critical requests blocked.`,
        'emergency'
      );
    } else if (usagePercent >= criticalThreshold) {
      this.notifyListeners(
        `⚠️ CRITICALusage at ${(usagePercent * 100).toFixed(1)}%. Switching to free providers.`,
        'critical'
      );
    } else if (usagePercent >= warn) {
      this.notifyListeners(
        `⚠️ WARNINGusage at ${(usagePercent * 100).toFixed(1)}%. Consider optimizing usage.`,
        'warn'
      );
    }
  }

  getUsagePercentage(){
    return this.dailySpend / this.config.dailyBudgetInr;
  }

  getCurrentSpend(): {
    daily;
    weekly;
    monthly;
    dailyPercent;
    weeklyPercent;
    monthlyPercent;
  } {
    return {
      daily.dailySpend,
      weekly.weeklySpend,
      monthly.monthlySpend,
      dailyPercent.dailySpend / this.config.dailyBudgetInr,
      weeklyPercent.weeklySpend / this.config.weeklyBudgetInr,
      monthlyPercent.monthlySpend / this.config.monthlyBudgetInr
    };
  }

  onAlert(listener: (message, level) => void){
    this.alertListeners.push(listener);
  }

  private notifyListeners(message, level){
    for (const listener of this.alertListeners) {
      listener(message, level);
    }
  }
}



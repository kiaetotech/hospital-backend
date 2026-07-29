// D:\hospital backend\ai-core\monitoring\BudgetManager.js

class BudgetManager {
  constructor(config) {
    this.config = {
      dailyBudgetInr: config?.dailyBudgetInr || 100,
      weeklyBudgetInr: config?.weeklyBudgetInr || 700,
      monthlyBudgetInr: config?.monthlyBudgetInr || 3000,
      alertThresholds: {
        warn: 0.80,
        critical: 0.90,
        emergency: 0.95
      }
    };

    this.dailySpend = 0;
    this.weeklySpend = 0;
    this.monthlySpend = 0;
    this.dailyResetTime = this.getNextResetTime('daily');
    this.weeklyResetTime = this.getNextResetTime('weekly');
    this.monthlyResetTime = this.getNextResetTime('monthly');
    this.alertListeners = [];
    this.startResetTimers();
  }

  getNextResetTime(period) {
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

  startResetTimers() {
    const now = Date.now();
    
    setTimeout(() => {
      this.dailySpend = 0;
      this.dailyResetTime = this.getNextResetTime('daily');
      this.startResetTimers();
    }, this.dailyResetTime.getTime() - now);

    setTimeout(() => {
      this.weeklySpend = 0;
      this.weeklyResetTime = this.getNextResetTime('weekly');
    }, this.weeklyResetTime.getTime() - now);

    setTimeout(() => {
      this.monthlySpend = 0;
      this.monthlyResetTime = this.getNextResetTime('monthly');
    }, this.monthlyResetTime.getTime() - now);
  }

  canSpend(critical = false) {
    const usagePercent = this.getUsagePercentage();
    if (critical) {
      return true;
    }
    if (usagePercent >= this.config.alertThresholds.emergency) {
      return false;
    }
    return true;
  }

  recordSpend(amountInr, critical) {
    this.dailySpend += amountInr;
    this.weeklySpend += amountInr;
    this.monthlySpend += amountInr;
    this.checkAlerts(critical);
  }

  checkAlerts(critical) {
    const usagePercent = this.getUsagePercentage();
    const { warn, critical: criticalThreshold, emergency } = this.config.alertThresholds;

    if (usagePercent >= emergency) {
      this.notifyListeners(
        `🚨 EMERGENCY: Budget usage at ${(usagePercent * 100).toFixed(1)}%. Non-critical requests blocked.`,
        'emergency'
      );
    } else if (usagePercent >= criticalThreshold) {
      this.notifyListeners(
        `⚠️ CRITICAL: Budget usage at ${(usagePercent * 100).toFixed(1)}%. Switching to free providers.`,
        'critical'
      );
    } else if (usagePercent >= warn) {
      this.notifyListeners(
        `⚠️ WARNING: Budget usage at ${(usagePercent * 100).toFixed(1)}%. Consider optimizing usage.`,
        'warn'
      );
    }
  }

  getUsagePercentage() {
    return this.dailySpend / this.config.dailyBudgetInr;
  }

  getCurrentSpend() {
    return {
      daily: this.dailySpend,
      weekly: this.weeklySpend,
      monthly: this.monthlySpend,
      dailyPercent: this.dailySpend / this.config.dailyBudgetInr,
      weeklyPercent: this.weeklySpend / this.config.weeklyBudgetInr,
      monthlyPercent: this.monthlySpend / this.config.monthlyBudgetInr
    };
  }

  onAlert(listener) {
    this.alertListeners.push(listener);
  }

  notifyListeners(message, level) {
    for (const listener of this.alertListeners) {
      listener(message, level);
    }
  }
}

module.exports = { BudgetManager };
// packages/ai-core/src/monitoring/BudgetManager.ts

interface BudgetConfig {
  dailyBudgetInr: number;
  weeklyBudgetInr: number;
  monthlyBudgetInr: number;
  alertThresholds: {
    warn: number; // 80%
    critical: number; // 90%
    emergency: number; // 95%
  };
}

export class BudgetManager {
  private config: BudgetConfig = {
    dailyBudgetInr: 100, // ₹100 per day
    weeklyBudgetInr: 700, // ₹700 per week
    monthlyBudgetInr: 3000, // ₹3000 per month
    alertThresholds: {
      warn: 0.80,
      critical: 0.90,
      emergency: 0.95
    }
  };

  private dailySpend: number = 0;
  private weeklySpend: number = 0;
  private monthlySpend: number = 0;
  private dailyResetTime: Date;
  private weeklyResetTime: Date;
  private monthlyResetTime: Date;
  private alertListeners: ((message: string, level: string) => void)[] = [];

  constructor(config?: Partial<BudgetConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    this.dailyResetTime = this.getNextResetTime('daily');
    this.weeklyResetTime = this.getNextResetTime('weekly');
    this.monthlyResetTime = this.getNextResetTime('monthly');

    this.startResetTimers();
  }

  private getNextResetTime(period: 'daily' | 'weekly' | 'monthly'): Date {
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

  private startResetTimers(): void {
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

  canSpend(critical: boolean = false): boolean {
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

  recordSpend(amountInr: number, critical: boolean): void {
    this.dailySpend += amountInr;
    this.weeklySpend += amountInr;
    this.monthlySpend += amountInr;

    this.checkAlerts(critical);
  }

  private checkAlerts(critical: boolean): void {
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

  getUsagePercentage(): number {
    return this.dailySpend / this.config.dailyBudgetInr;
  }

  getCurrentSpend(): {
    daily: number;
    weekly: number;
    monthly: number;
    dailyPercent: number;
    weeklyPercent: number;
    monthlyPercent: number;
  } {
    return {
      daily: this.dailySpend,
      weekly: this.weeklySpend,
      monthly: this.monthlySpend,
      dailyPercent: this.dailySpend / this.config.dailyBudgetInr,
      weeklyPercent: this.weeklySpend / this.config.weeklyBudgetInr,
      monthlyPercent: this.monthlySpend / this.config.monthlyBudgetInr
    };
  }

  onAlert(listener: (message: string, level: string) => void): void {
    this.alertListeners.push(listener);
  }

  private notifyListeners(message: string, level: string): void {
    for (const listener of this.alertListeners) {
      listener(message, level);
    }
  }
}
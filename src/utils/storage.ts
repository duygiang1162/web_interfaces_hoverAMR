import { GoalPoint } from '../types/robot';

// Utility functions cho localStorage
export class StorageService {
  private static readonly GOALS_KEY = 'robot_monitor_goals';

  // Lưu danh sách goal points
  static saveGoals(goals: GoalPoint[]): void {
    try {
      localStorage.setItem(this.GOALS_KEY, JSON.stringify(goals));
    } catch (error) {
      console.error('Không thể lưu goals vào localStorage:', error);
    }
  }

  // Đọc danh sách goal points
  static loadGoals(): GoalPoint[] {
    try {
      const saved = localStorage.getItem(this.GOALS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Không thể đọc goals từ localStorage:', error);
      return [];
    }
  }

  // Thêm goal point mới
  static addGoal(goal: GoalPoint): void {
    const goals = this.loadGoals();
    goals.push(goal);
    this.saveGoals(goals);
  }

  // Xóa goal point
  static removeGoal(goalId: string): void {
    const goals = this.loadGoals();
    const filtered = goals.filter(g => g.id !== goalId);
    this.saveGoals(filtered);
  }

  // Update goal point
  static updateGoal(goalId: string, updates: Partial<GoalPoint>): void {
    const goals = this.loadGoals();
    const index = goals.findIndex(g => g.id === goalId);
    if (index !== -1) {
      goals[index] = { ...goals[index], ...updates };
      this.saveGoals(goals);
    }
  }

  // Clear all goals
  static clearAllGoals(): void {
    localStorage.removeItem(this.GOALS_KEY);
  }
}
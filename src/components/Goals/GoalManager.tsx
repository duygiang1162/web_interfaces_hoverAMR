import React, { useState } from 'react';
import { GoalPoint } from '../../types/robot';
import { StorageService } from '../../utils/storage';
import { Target, Trash2, Edit2, Navigation } from 'lucide-react';

interface GoalManagerProps {
  goals: GoalPoint[];
  onGoalsChange: (goals: GoalPoint[]) => void;
  onSendGoal: (x: number, y: number) => void;
}

export function GoalManager({ goals, onGoalsChange, onSendGoal }: GoalManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Xóa goal
  const handleDeleteGoal = (goalId: string) => {
    StorageService.removeGoal(goalId);
    const updatedGoals = goals.filter(g => g.id !== goalId);
    onGoalsChange(updatedGoals);
  };

  // Bắt đầu edit goal name
  const startEditing = (goal: GoalPoint) => {
    setEditingId(goal.id);
    setEditName(goal.name);
  };

  // Lưu tên goal mới
  const saveGoalName = () => {
    if (editingId && editName.trim()) {
      StorageService.updateGoal(editingId, { name: editName.trim() });
      const updatedGoals = goals.map(g => 
        g.id === editingId ? { ...g, name: editName.trim() } : g
      );
      onGoalsChange(updatedGoals);
    }
    setEditingId(null);
    setEditName('');
  };

  // Hủy edit
  const cancelEditing = () => {
    setEditingId(null);
    setEditName('');
  };

  // Gửi goal đến robot
  const handleSendGoal = (goal: GoalPoint) => {
    onSendGoal(goal.x, goal.y);
  };

  // Clear all goals
  const clearAllGoals = () => {
    if (window.confirm('Bạn có chắc muốn xóa tất cả goal points?')) {
      StorageService.clearAllGoals();
      onGoalsChange([]);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <Target className="mr-2" size={20} />
          Goal Points ({goals.length})
        </h3>
        
        {goals.length > 0 && (
          <button
            onClick={clearAllGoals}
            className="text-red-600 hover:text-red-700 text-sm font-medium"
          >
            Xóa tất cả
          </button>
        )}
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Target className="mx-auto mb-2" size={48} />
          <p>Chưa có goal points nào</p>
          <p className="text-sm">Click vào map để tạo goal mới</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex-1">
                {editingId === goal.id ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveGoalName();
                        if (e.key === 'Escape') cancelEditing();
                      }}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <button
                      onClick={saveGoalName}
                      className="text-green-600 hover:text-green-700 text-sm"
                    >
                      Lưu
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="text-gray-600 hover:text-gray-700 text-sm"
                    >
                      Hủy
                    </button>
                  </div>
                ) : (
                  <div>
                    <h4 className="font-medium text-gray-800">{goal.name}</h4>
                    <p className="text-sm text-gray-600">
                      x: {goal.x.toFixed(2)}, y: {goal.y.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(goal.timestamp).toLocaleString('vi-VN')}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={() => handleSendGoal(goal)}
                  className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-colors"
                  title="Gửi goal này đến robot"
                >
                  <Navigation size={16} />
                </button>
                
                <button
                  onClick={() => startEditing(goal)}
                  className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                  title="Sửa tên"
                >
                  <Edit2 size={16} />
                </button>
                
                <button
                  onClick={() => handleDeleteGoal(goal.id)}
                  className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
                  title="Xóa goal"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-800">
          💡 <strong>Hướng dẫn:</strong> Click vào bất kỳ vị trí nào trên bản đồ để tạo goal point mới.
          Robot sẽ tự động di chuyển đến vị trí đó khi bạn gửi goal.
        </p>
      </div>
    </div>
  );
}
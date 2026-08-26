import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PlusIcon, TrashIcon, PencilIcon, CheckCircleIcon, ExclamationCircleIcon } from '../../components/icons';

interface QuizQuestion {
  id: string;
  round_id: string;
  question_number: number;
  question_text: string;
  question_type: 'SINGLE_ANSWER' | 'MULTI_SELECT';
  points: number;
  image_url?: string;
  options: QuizOption[];
}

interface QuizOption {
  id: string;
  option_label: string;
  option_text: string;
  is_correct: boolean;
  order_index: number;
}

export default function QuizManager() {
  const [rounds, setRounds] = useState<any[]>([]);
  const [selectedRound, setSelectedRound] = useState<string>('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [showForm, setShowForm] = useState(false);
  
  useEffect(() => {
    loadRounds();
  }, []);
  
  useEffect(() => {
    if (selectedRound) {
      loadQuestions();
    }
  }, [selectedRound]);
  
  const loadRounds = async () => {
    try {
      const { data, error } = await supabase
        .from('rounds')
        .select('*')
        .eq('type', 'QUIZ')
        .order('order_index');
      
      if (error) throw error;
      setRounds(data || []);
      
      if (data && data.length > 0) {
        setSelectedRound(data[0].id);
      }
    } catch (err: any) {
      console.error('Error loading rounds:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const loadQuestions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quiz_questions')
        .select(`
          *,
          options:quiz_options(*)
        `)
        .eq('round_id', selectedRound)
        .order('order_index');
      
      if (error) throw error;
      setQuestions(data || []);
    } catch (err: any) {
      console.error('Error loading questions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question? This will also delete all associated options and answers.')) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('quiz_questions')
        .delete()
        .eq('id', questionId);
      
      if (error) throw error;
      await loadQuestions();
    } catch (err: any) {
      console.error('Error deleting question:', err);
      alert(`Error: ${err.message}`);
    }
  };
  
  const handleSaveQuestion = async (question: Partial<QuizQuestion>) => {
    try {
      if (editingQuestion) {
        // Update existing question
        const { error } = await supabase
          .from('quiz_questions')
          .update({
            question_text: question.question_text,
            question_type: question.question_type,
            points: question.points,
            image_url: question.image_url,
          })
          .eq('id', editingQuestion.id);
        
        if (error) throw error;
        
        // Update options
        if (question.options) {
          for (const option of question.options) {
            if (option.id) {
              await supabase
                .from('quiz_options')
                .update({
                  option_text: option.option_text,
                  is_correct: option.is_correct,
                })
                .eq('id', option.id);
            }
          }
        }
      } else {
        // Create new question
        const { data: questionData, error: questionError } = await supabase
          .from('quiz_questions')
          .insert({
            round_id: selectedRound,
            question_number: questions.length + 1,
            question_text: question.question_text,
            question_type: question.question_type,
            points: question.points,
            order_index: questions.length,
            image_url: question.image_url,
          })
          .select()
          .single();
        
        if (questionError) throw questionError;
        
        // Create options
        if (question.options) {
          for (let i = 0; i < question.options.length; i++) {
            const option = question.options[i];
            await supabase
              .from('quiz_options')
              .insert({
                question_id: questionData.id,
                option_label: option.option_label,
                option_text: option.option_text,
                is_correct: option.is_correct,
                order_index: i,
              });
          }
        }
      }
      
      setShowForm(false);
      setEditingQuestion(null);
      await loadQuestions();
    } catch (err: any) {
      console.error('Error saving question:', err);
      alert(`Error: ${err.message}`);
    }
  };
  
  if (loading && rounds.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Quiz Manager</h1>
        <p className="text-gray-600">Manage quiz questions and answers</p>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <ExclamationCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}
      
      {/* Round Selector */}
      <div className="mb-6 flex items-center gap-4">
        <label className="font-medium text-gray-700">Select Round:</label>
        <select
          value={selectedRound}
          onChange={(e) => setSelectedRound(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {rounds.map((round) => (
            <option key={round.id} value={round.id}>
              {round.name}
            </option>
          ))}
        </select>
        
        <button
          onClick={() => {
            setEditingQuestion(null);
            setShowForm(true);
          }}
          className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Add Question
        </button>
      </div>
      
      {/* Questions List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              Questions ({questions.length})
            </h2>
            <div className="text-sm text-gray-600">
              Total Points: {questions.reduce((sum, q) => sum + q.points, 0)}
            </div>
          </div>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : questions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No questions yet. Click "Add Question" to create one.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {questions.map((question) => (
              <div key={question.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                        Q{question.question_number}
                      </span>
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
                        {question.points} pts
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        question.question_type === 'MULTI_SELECT'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {question.question_type === 'MULTI_SELECT' ? 'Multi-Select' : 'Single Answer'}
                      </span>
                    </div>
                    
                    <p className="text-gray-900 mb-3 line-clamp-2">
                      {question.question_text}
                    </p>
                    
                    <div className="space-y-1">
                      {question.options
                        .sort((a, b) => a.order_index - b.order_index)
                        .map((option) => (
                          <div
                            key={option.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            {option.is_correct ? (
                              <CheckCircleIcon className="w-4 h-4 text-green-600" />
                            ) : (
                              <div className="w-4 h-4 border-2 border-gray-300 rounded-full"></div>
                            )}
                            <span className={option.is_correct ? 'text-green-900 font-medium' : 'text-gray-600'}>
                              {option.option_label}. {option.option_text}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingQuestion(question);
                        setShowForm(true);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      title="Edit"
                    >
                      <PencilIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteQuestion(question.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Question Form Modal */}
      {showForm && (
        <QuestionForm
          question={editingQuestion}
          onSave={handleSaveQuestion}
          onCancel={() => {
            setShowForm(false);
            setEditingQuestion(null);
          }}
        />
      )}
    </div>
  );
}

// Question Form Component
function QuestionForm({
  question,
  onSave,
  onCancel,
}: {
  question: QuizQuestion | null;
  onSave: (question: Partial<QuizQuestion>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Partial<QuizQuestion>>(
    question || {
      question_text: '',
      question_type: 'SINGLE_ANSWER',
      points: 1,
      options: [
        { id: '', option_label: 'A', option_text: '', is_correct: false, order_index: 0 },
        { id: '', option_label: 'B', option_text: '', is_correct: false, order_index: 1 },
        { id: '', option_label: 'C', option_text: '', is_correct: false, order_index: 2 },
        { id: '', option_label: 'D', option_text: '', is_correct: false, order_index: 3 },
      ],
    }
  );
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    if (!formData.question_text?.trim()) {
      alert('Please enter a question');
      return;
    }
    
    if (!formData.options || formData.options.length < 2) {
      alert('Please add at least 2 options');
      return;
    }
    
    const hasCorrect = formData.options.some(opt => opt.is_correct);
    if (!hasCorrect) {
      alert('Please mark at least one correct answer');
      return;
    }
    
    onSave(formData);
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              {question ? 'Edit Question' : 'Add New Question'}
            </h2>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Question Text */}
            <div>
              <label className="block font-medium text-gray-700 mb-2">
                Question Text *
              </label>
              <textarea
                value={formData.question_text}
                onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                required
              />
            </div>
            
            {/* Question Type and Points */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-gray-700 mb-2">Type *</label>
                <select
                  value={formData.question_type}
                  onChange={(e) => setFormData({ ...formData, question_type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="SINGLE_ANSWER">Single Answer</option>
                  <option value="MULTI_SELECT">Multi-Select</option>
                </select>
              </div>
              
              <div>
                <label className="block font-medium text-gray-700 mb-2">Points *</label>
                <input
                  type="number"
                  min="1"
                  value={formData.points}
                  onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
            
            {/* Options */}
            <div>
              <label className="block font-medium text-gray-700 mb-3">Options *</label>
              <div className="space-y-3">
                {formData.options?.map((option, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={option.is_correct}
                      onChange={(e) => {
                        const newOptions = [...(formData.options || [])];
                        newOptions[index].is_correct = e.target.checked;
                        setFormData({ ...formData, options: newOptions });
                      }}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="font-bold text-gray-900 w-6">{option.option_label}.</span>
                    <input
                      type="text"
                      value={option.option_text}
                      onChange={(e) => {
                        const newOptions = [...(formData.options || [])];
                        newOptions[index].option_text = e.target.value;
                        setFormData({ ...formData, options: newOptions });
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={`Option ${option.option_label}`}
                      required
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Check the box to mark correct answer(s)
              </p>
            </div>
          </div>
          
          <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              {question ? 'Update Question' : 'Create Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

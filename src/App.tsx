import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, Target, TrendingUp, ArrowLeft, CheckCircle2, XCircle, RefreshCw, Languages, BrainCircuit, BookA, Trophy, BarChart3, Settings } from 'lucide-react';
import { generateQuestion, Question, KeyTerm } from './lib/gemini';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

const TOPICS = [
  { id: 'algebra', name: 'Heart of Algebra', mongolianName: 'Алгебрийн үндэс', icon: '➗' },
  { id: 'data', name: 'Problem Solving & Data', mongolianName: 'Өгөгдөл ба асуудал шийдвэрлэх', icon: '📊' },
  { id: 'advanced', name: 'Passport to Advanced Math', mongolianName: 'Ахисан түвшний математик', icon: '📈' },
  { id: 'geometry', name: 'Geometry & Trigonometry', mongolianName: 'Геометр ба Тригонометр', icon: '📐' },
];

type Difficulty = 'easy' | 'medium' | 'hard';

interface TopicStats {
  attempted: number;
  correct: number;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  currentDifficulty: Difficulty;
}

interface VocabWord extends KeyTerm {
  learned: boolean;
  dateAdded: number;
}

export default function App() {
  const [view, setView] = useState<'dashboard' | 'practice' | 'vocabulary'>('dashboard');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  
  // Progress state
  const [topicStats, setTopicStats] = useState<Record<string, TopicStats>>(() => {
    const initial: Record<string, TopicStats> = {};
    TOPICS.forEach(t => {
      initial[t.id] = { attempted: 0, correct: 0, consecutiveCorrect: 0, consecutiveIncorrect: 0, currentDifficulty: 'easy' };
    });
    return initial;
  });

  const [vocabularyList, setVocabularyList] = useState<VocabWord[]>([]);
  const [targetScore, setTargetScore] = useState(600);
  const [intermediateGoal, setIntermediateGoal] = useState(450);

  // Practice state
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showMongolian, setShowMongolian] = useState(false);

  // Calculate estimated score
  const totalAttempted = Object.values(topicStats).reduce((sum, stat) => sum + stat.attempted, 0);
  const totalCorrect = Object.values(topicStats).reduce((sum, stat) => sum + stat.correct, 0);
  const accuracy = totalAttempted > 0 ? totalCorrect / totalAttempted : 0;
  
  // Difficulty weight: easy (0.8), medium (1.0), hard (1.2)
  const difficultyWeight = useMemo(() => {
    if (totalAttempted === 0) return 1;
    let totalWeight = 0;
    Object.values(topicStats).forEach(stat => {
      if (stat.attempted > 0) {
        const weight = stat.currentDifficulty === 'easy' ? 0.8 : stat.currentDifficulty === 'medium' ? 1.0 : 1.2;
        totalWeight += weight * stat.attempted;
      }
    });
    return totalWeight / totalAttempted;
  }, [topicStats, totalAttempted]);

  const estimatedScore = Math.min(800, Math.max(400, Math.round(400 + (accuracy * 400 * difficultyWeight))));

  // Update intermediate goal automatically
  useEffect(() => {
    if (estimatedScore >= intermediateGoal && intermediateGoal < targetScore) {
      setIntermediateGoal(prev => Math.min(targetScore, prev + 50));
    }
  }, [estimatedScore, intermediateGoal, targetScore]);

  const startPractice = async (topicId: string) => {
    setSelectedTopic(topicId);
    setView('practice');
    await fetchNewQuestion(topicId);
  };

  const fetchNewQuestion = async (topicId: string) => {
    const topic = TOPICS.find(t => t.id === topicId);
    if (!topic) return;

    setLoading(true);
    setQuestion(null);
    setSelectedOption(null);
    setShowExplanation(false);
    setShowMongolian(false);
    
    const difficulty = topicStats[topicId].currentDifficulty;

    try {
      const q = await generateQuestion(topic.name, difficulty);
      setQuestion(q);
    } catch (error) {
      console.error("Failed to fetch question:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (index: number) => {
    if (showExplanation) return;
    setSelectedOption(index);
  };

  const checkAnswer = () => {
    if (selectedOption === null || !question || !selectedTopic) return;
    
    const isCorrect = selectedOption === question.correctAnswerIndex;
    
    // Update Topic Stats & Adaptive Logic
    setTopicStats(prev => {
      const stats = prev[selectedTopic];
      let newDifficulty = stats.currentDifficulty;
      let newConsecutiveCorrect = isCorrect ? stats.consecutiveCorrect + 1 : 0;
      let newConsecutiveIncorrect = !isCorrect ? stats.consecutiveIncorrect + 1 : 0;

      // Adaptive Logic: Adjust difficulty based on streaks
      if (newConsecutiveCorrect >= 2) {
        if (newDifficulty === 'easy') newDifficulty = 'medium';
        else if (newDifficulty === 'medium') newDifficulty = 'hard';
        newConsecutiveCorrect = 0; // Reset streak after level up
      } else if (newConsecutiveIncorrect >= 2) {
        if (newDifficulty === 'hard') newDifficulty = 'medium';
        else if (newDifficulty === 'medium') newDifficulty = 'easy';
        newConsecutiveIncorrect = 0; // Reset streak after level down
      }

      return {
        ...prev,
        [selectedTopic]: {
          attempted: stats.attempted + 1,
          correct: stats.correct + (isCorrect ? 1 : 0),
          consecutiveCorrect: newConsecutiveCorrect,
          consecutiveIncorrect: newConsecutiveIncorrect,
          currentDifficulty: newDifficulty
        }
      };
    });

    // Add new vocabulary words
    if (question.keyTerms) {
      setVocabularyList(prev => {
        const newList = [...prev];
        question.keyTerms.forEach(term => {
          if (!newList.find(v => v.english.toLowerCase() === term.english.toLowerCase())) {
            newList.push({ ...term, learned: false, dateAdded: Date.now() });
          }
        });
        return newList;
      });
    }

    setShowExplanation(true);
  };

  const nextQuestion = () => {
    if (selectedTopic) {
      fetchNewQuestion(selectedTopic);
    }
  };

  const toggleVocabLearned = (english: string) => {
    setVocabularyList(prev => prev.map(v => 
      v.english === english ? { ...v, learned: !v.learned } : v
    ));
  };

  // Chart Data
  const chartData = TOPICS.map(t => ({
    name: t.name.split(' ')[0], // Short name for chart
    accuracy: topicStats[t.id].attempted > 0 
      ? Math.round((topicStats[t.id].correct / topicStats[t.id].attempted) * 100) 
      : 0,
    difficulty: topicStats[t.id].currentDifficulty
  }));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('dashboard')}>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
              {targetScore}
            </div>
            <h1 className="font-bold text-lg hidden sm:block">SAT Math Prep</h1>
          </div>
          
          <div className="flex items-center gap-4 sm:gap-6 text-sm font-medium">
            <button 
              onClick={() => setView('vocabulary')}
              className={cn("flex items-center gap-1.5 transition-colors", view === 'vocabulary' ? "text-blue-600" : "text-slate-600 hover:text-blue-500")}
            >
              <BookA className="w-4 h-4" />
              <span className="hidden sm:inline">Vocabulary</span>
            </button>
            <div className="flex items-center gap-1.5 text-slate-600">
              <Target className="w-4 h-4 text-blue-500" />
              <span className="hidden sm:inline">Goal: {intermediateGoal}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="hidden sm:inline">Est: {estimatedScore}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {view === 'dashboard' ? (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Welcome & Progress Section */}
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm">
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
                    Welcome back! / Тавтай морил!
                  </h2>
                  <p className="text-slate-600 mb-8 max-w-2xl">
                    Your adaptive learning path is ready. We will adjust the difficulty based on your answers to help you reach your {targetScore} goal.
                  </p>
                  
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between text-sm font-medium mb-2">
                        <span className="text-slate-600">Progress to Next Goal ({intermediateGoal})</span>
                        <span className="text-purple-600 font-bold">{estimatedScore} / {targetScore}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden relative">
                          {/* Target Marker */}
                          <div className="absolute top-0 bottom-0 w-0.5 bg-slate-300 z-10" style={{ left: `${((targetScore - 400) / 400) * 100}%` }}></div>
                          {/* Intermediate Goal Marker */}
                          <div className="absolute top-0 bottom-0 w-0.5 bg-purple-300 z-10" style={{ left: `${((intermediateGoal - 400) / 400) * 100}%` }}></div>
                          
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-1000 relative z-0"
                            style={{ width: `${Math.min(100, Math.max(0, ((estimatedScore - 400) / 400) * 100))}%` }}
                          />
                        </div>
                        <Trophy className={cn("w-6 h-6", estimatedScore >= targetScore ? "text-yellow-500" : "text-slate-300")} />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                      <div>
                        <div className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">Questions</div>
                        <div className="text-2xl font-bold text-slate-900">{totalAttempted}</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">Accuracy</div>
                        <div className="text-2xl font-bold text-slate-900">{Math.round(accuracy * 100)}%</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">Vocab Learned</div>
                        <div className="text-2xl font-bold text-slate-900">{vocabularyList.filter(v => v.learned).length}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Performance Chart */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                    Topic Accuracy
                  </h3>
                  <div className="flex-1 min-h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={[0, 100]} />
                        <Tooltip 
                          cursor={{ fill: '#f1f5f9' }}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={
                              entry.difficulty === 'hard' ? '#ef4444' : 
                              entry.difficulty === 'medium' ? '#eab308' : '#3b82f6'
                            } />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4 mt-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Easy</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-yellow-500"></div> Medium</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500"></div> Hard</div>
                  </div>
                </div>
              </div>

              {/* Topics */}
              <div>
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-500" />
                  Learning Path / Сэдэв сонгох
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {TOPICS.map((topic) => {
                    const stats = topicStats[topic.id];
                    const diffColor = stats.currentDifficulty === 'hard' ? 'text-red-600 bg-red-50 border-red-200' :
                                      stats.currentDifficulty === 'medium' ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
                                      'text-blue-600 bg-blue-50 border-blue-200';
                    
                    return (
                      <button
                        key={topic.id}
                        onClick={() => startPractice(topic.id)}
                        className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all text-left group flex flex-col gap-4"
                      >
                        <div className="flex items-start gap-4 w-full">
                          <div className="text-3xl bg-slate-50 w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                            {topic.icon}
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                              {topic.name}
                            </div>
                            <div className="text-sm text-slate-500 mt-1">
                              {topic.mongolianName}
                            </div>
                          </div>
                          <div className={cn("text-xs font-bold px-2 py-1 rounded-md border uppercase tracking-wide", diffColor)}>
                            {stats.currentDifficulty}
                          </div>
                        </div>
                        
                        {/* Topic Progress Bar */}
                        <div className="w-full">
                          <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>Accuracy</span>
                            <span>{stats.attempted > 0 ? Math.round((stats.correct / stats.attempted) * 100) : 0}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${stats.attempted > 0 ? (stats.correct / stats.attempted) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          ) : view === 'vocabulary' ? (
            <motion.div 
              key="vocabulary"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <button 
                  onClick={() => setView('dashboard')}
                  className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Dashboard
                </button>
                <div className="text-sm font-medium text-slate-500">
                  Learned: {vocabularyList.filter(v => v.learned).length} / {vocabularyList.length}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 p-6">
                  <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <BookA className="w-6 h-6 text-blue-500" />
                    SAT Math Vocabulary Builder
                  </h2>
                  <p className="text-slate-600 mt-2">
                    Review the key terms you've encountered in your practice sessions.
                  </p>
                </div>

                <div className="p-6">
                  {vocabularyList.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <BookA className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                      <p>You haven't encountered any vocabulary words yet.</p>
                      <p>Start practicing to build your vocabulary!</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {vocabularyList.sort((a, b) => Number(a.learned) - Number(b.learned) || b.dateAdded - a.dateAdded).map((vocab, idx) => (
                        <div key={idx} className={cn(
                          "p-5 rounded-xl border transition-all",
                          vocab.learned ? "bg-slate-50 border-slate-200 opacity-75" : "bg-white border-blue-100 shadow-sm"
                        )}>
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <div className="flex items-baseline gap-3 mb-1">
                                <h3 className="text-xl font-bold text-slate-900">{vocab.english}</h3>
                                <span className="text-sm font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{vocab.mongolian}</span>
                              </div>
                              <p className="text-slate-700 font-medium mt-3 mb-1">Definition:</p>
                              <p className="text-slate-600 text-sm">{vocab.definition}</p>
                              <p className="text-slate-700 font-medium mt-3 mb-1">Example:</p>
                              <div className="text-slate-600 text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <MarkdownRenderer content={vocab.example} />
                              </div>
                            </div>
                            <button
                              onClick={() => toggleVocabLearned(vocab.english)}
                              className={cn(
                                "shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border",
                                vocab.learned 
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" 
                                  : "bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                              )}
                            >
                              {vocab.learned ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border-2 border-current" />}
                              {vocab.learned ? "Learned" : "Mark Learned"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="practice"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-3xl mx-auto"
            >
              <button 
                onClick={() => setView('dashboard')}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </button>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Practice Header */}
                <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="font-medium text-slate-700">
                      {TOPICS.find(t => t.id === selectedTopic)?.name}
                    </div>
                    {selectedTopic && (
                      <span className={cn(
                        "text-xs font-bold px-2 py-1 rounded-md border uppercase tracking-wide",
                        topicStats[selectedTopic].currentDifficulty === 'hard' ? 'text-red-600 bg-red-50 border-red-200' :
                        topicStats[selectedTopic].currentDifficulty === 'medium' ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
                        'text-blue-600 bg-blue-50 border-blue-200'
                      )}>
                        {topicStats[selectedTopic].currentDifficulty}
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={() => setShowMongolian(!showMongolian)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                      showMongolian ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                    )}
                  >
                    <Languages className="w-4 h-4" />
                    {showMongolian ? "Show English" : "Орчуулах (Translate)"}
                  </button>
                </div>

                {/* Question Content */}
                <div className="p-6 sm:p-8">
                  {loading ? (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-4">
                      <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                      <p>Generating adaptive question... / Асуулт бэлтгэж байна...</p>
                    </div>
                  ) : question ? (
                    <div className="space-y-8">
                      {/* Question Text */}
                      <div className="text-lg text-slate-900">
                        <MarkdownRenderer content={showMongolian ? question.questionMongolian : question.questionEnglish} />
                      </div>

                      {/* Options */}
                      <div className="space-y-3">
                        {question.options.map((opt, idx) => {
                          const isSelected = selectedOption === idx;
                          const isCorrect = idx === question.correctAnswerIndex;
                          const showCorrectness = showExplanation;
                          
                          let optionClass = "border-slate-200 hover:border-blue-300 hover:bg-blue-50";
                          if (isSelected) optionClass = "border-blue-500 bg-blue-50 ring-1 ring-blue-500";
                          if (showCorrectness) {
                            if (isCorrect) optionClass = "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500";
                            else if (isSelected && !isCorrect) optionClass = "border-red-500 bg-red-50 ring-1 ring-red-500";
                            else optionClass = "border-slate-200 opacity-50";
                          }

                          return (
                            <button
                              key={idx}
                              onClick={() => handleOptionSelect(idx)}
                              disabled={showExplanation}
                              className={cn(
                                "w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4",
                                optionClass
                              )}
                            >
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 shrink-0",
                                showCorrectness && isCorrect ? "border-emerald-500 text-emerald-600 bg-emerald-100" :
                                showCorrectness && isSelected && !isCorrect ? "border-red-500 text-red-600 bg-red-100" :
                                isSelected ? "border-blue-500 text-blue-600" : "border-slate-300 text-slate-500"
                              )}>
                                {String.fromCharCode(65 + idx)}
                              </div>
                              <div className="flex-1 overflow-hidden">
                                <MarkdownRenderer content={opt} />
                              </div>
                              {showCorrectness && isCorrect && <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />}
                              {showCorrectness && isSelected && !isCorrect && <XCircle className="w-6 h-6 text-red-500 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>

                      {/* Action Button */}
                      {!showExplanation ? (
                        <button
                          onClick={checkAnswer}
                          disabled={selectedOption === null}
                          className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg transition-colors"
                        >
                          Check Answer / Шалгах
                        </button>
                      ) : (
                        <button
                          onClick={nextQuestion}
                          className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-lg transition-colors"
                        >
                          Next Question / Дараагийн асуулт
                        </button>
                      )}

                      {/* Explanation */}
                      {showExplanation && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-8 pt-8 border-t border-slate-200 space-y-6 overflow-hidden"
                        >
                          <div>
                            <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
                              <BrainCircuit className="w-5 h-5 text-purple-500" />
                              Explanation / Тайлбар
                            </h4>
                            <div className="bg-purple-50 p-5 rounded-xl space-y-4 text-slate-800">
                              <MarkdownRenderer content={showMongolian ? question.explanationMongolian : question.explanationEnglish} />
                            </div>
                          </div>

                          {/* Key Terms */}
                          {question.keyTerms && question.keyTerms.length > 0 && (
                            <div>
                              <h4 className="font-bold text-sm text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <BookA className="w-4 h-4" />
                                New Vocabulary Added
                              </h4>
                              <div className="grid sm:grid-cols-2 gap-3">
                                {question.keyTerms.map((term, idx) => (
                                  <div key={idx} className="bg-slate-100 px-4 py-3 rounded-lg flex justify-between items-center border border-slate-200">
                                    <span className="font-bold text-slate-900">{term.english}</span>
                                    <span className="text-slate-600 text-sm font-medium">{term.mongolian}</span>
                                  </div>
                                ))}
                              </div>
                              <p className="text-xs text-slate-500 mt-2">
                                You can review definitions and examples in the Vocabulary tab.
                              </p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-red-500">
                      Failed to load question. Please try again.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}


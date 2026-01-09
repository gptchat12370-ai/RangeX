import React, { useState } from "react";
import { Plus, GripVertical, Copy, Trash2, Edit, HelpCircle } from "lucide-react@0.263.1";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import { QuestionEditor, Question } from "./QuestionEditor";

interface QuestionsTabProps {
  data: any;
  onChange: (updates: any) => void;
  errors: string[];
}

export function QuestionsTab({ data, onChange, errors }: QuestionsTabProps) {
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const questions: Question[] = data.questions || [];

  const handleAddQuestion = () => {
    setSelectedQuestion(null);
    setIsCreating(true);
  };

  const handleSaveQuestion = (question: Question) => {
    console.log('[QuestionsTab] Saving question:', question);
    if (isCreating) {
      // Adding new question
      const newQuestions = [...questions, question];
      console.log('[QuestionsTab] Adding new question, total questions:', newQuestions.length);
      onChange({ questions: newQuestions });
      setIsCreating(false);
      setSelectedQuestion(null);
    } else {
      // Updating existing question
      const updated = questions.map(q => q.id === question.id ? question : q);
      console.log('[QuestionsTab] Updating question, total questions:', updated.length);
      onChange({ questions: updated });
      setSelectedQuestion(null);
    }
  };

  const handleEditQuestion = (question: Question) => {
    setSelectedQuestion(question);
    setIsCreating(false);
  };

  const handleDeleteQuestion = (id: string) => {
    if (confirm("Are you sure you want to delete this question?")) {
      onChange({ questions: questions.filter(q => q.id !== id) });
      if (selectedQuestion?.id === id) {
        setSelectedQuestion(null);
        setIsCreating(false);
      }
    }
  };

  const handleDuplicateQuestion = (question: Question) => {
    const duplicate: Question = {
      ...question,
      id: `q-${Date.now()}`,
      text: `${question.text} (Copy)`,
    };
    onChange({ questions: [...questions, duplicate] });
  };

  const handleCancel = () => {
    setSelectedQuestion(null);
    setIsCreating(false);
  };

  const getQuestionTypeBadge = (type: string) => {
    const config: Record<string, { label: string; color: string }> = {
      single: { label: "Single Choice", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
      multiple: { label: "Multiple Choice", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
      trueFalse: { label: "True/False", color: "bg-green-500/10 text-green-400 border-green-500/20" },
      shortAnswer: { label: "Short Answer", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
      matching: { label: "Matching", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
      ordering: { label: "Ordering", color: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
    };
    const cfg = config[type] || { label: type, color: "" };
    return (
      <Badge variant="outline" className={cfg.color}>
        {cfg.label}
      </Badge>
    );
  };

  const totalPoints = questions.reduce((sum, q) => sum + (typeof q.points === 'number' ? q.points : 0), 0);

  return (
    <div className="space-y-6">
      {/* Errors */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <ul className="list-disc list-inside">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Summary */}
      <Card className="cyber-border bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">
                {questions.length} Question{questions.length !== 1 ? "s" : ""}
              </p>
              <p className="text-sm text-muted-foreground">
                Total Points: {totalPoints}
              </p>
            </div>
            <Button onClick={handleAddQuestion}>
              <Plus className="mr-2 h-4 w-4" />
              Add Question
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Question List */}
        <div className="lg:col-span-1">
          <Card className="cyber-border">
            <CardHeader>
              <CardTitle>Questions</CardTitle>
              <CardDescription>
                {questions.length === 0 ? "No questions yet" : "Click to edit"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {questions.length === 0 ? (
                <div className="text-center py-12">
                  <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    No questions added yet
                  </p>
                  <Button size="sm" variant="outline" onClick={handleAddQuestion}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Question
                  </Button>
                </div>
              ) : (
                questions.map((question, index) => (
                  <div
                    key={question.id}
                    className={`p-3 rounded-lg border-2 transition-all cursor-pointer group ${
                      selectedQuestion?.id === question.id && !isCreating
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => handleEditQuestion(question)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="cursor-move mt-1 opacity-50 group-hover:opacity-100">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs">
                            Q{index + 1}
                          </Badge>
                          {getQuestionTypeBadge(question.type)}
                        </div>
                        <p className="text-sm font-medium line-clamp-2 mb-1">
                          {question.text || "Untitled Question"}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{question.points} pts</span>
                          {question.maxAttempts && question.maxAttempts > 0 && (
                            <>
                              <span>•</span>
                              <span>{question.maxAttempts} attempts</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateQuestion(question);
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteQuestion(question.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Question Editor */}
        <div className="lg:col-span-2">
          {selectedQuestion || isCreating ? (
            <QuestionEditor
              question={selectedQuestion}
              onSave={handleSaveQuestion}
              onCancel={handleCancel}
            />
          ) : (
            <Card className="cyber-border">
              <CardContent className="pt-6 text-center py-16">
                <Edit className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  Select a question to edit or create a new one
                </p>
                <Button onClick={handleAddQuestion}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Question
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

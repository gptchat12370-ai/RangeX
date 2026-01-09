import React, { useState, useEffect } from "react";
import { Plus, X, Check } from "lucide-react@0.263.1";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Switch } from "../ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

export interface Question {
  id: string;
  type: "single" | "multiple" | "trueFalse" | "shortAnswer" | "matching" | "ordering";
  text: string;
  points: number;
  maxAttempts?: number;
  validationMode?: "immediate" | "onSubmit";
  options?: Array<{ id: string; text: string; isCorrect: boolean }>;
  correctAnswer?: boolean;
  acceptedAnswers?: string[];
  useRegex?: boolean;
  caseSensitive?: boolean;
  matchingPairs?: Array<{ id: string; left: string; right: string }>;
  orderingItems?: Array<{ id: string; text: string; correctOrder: number }>;
}

interface QuestionEditorProps {
  question: Question | null;
  onSave: (question: Question) => void;
  onCancel: () => void;
}

export function QuestionEditor({ question, onSave, onCancel }: QuestionEditorProps) {
  const [formData, setFormData] = useState<Question>(
    question || {
      id: `q-${Date.now()}`,
      type: "single",
      text: "",
      points: 10,
      maxAttempts: 3,
      validationMode: "immediate",
    }
  );

  useEffect(() => {
    if (question) {
      // Ensure all required nested structures exist
      const loadedQuestion: Question = {
        ...question,
        text: question.text || "",
        points: question.points || 10,
        maxAttempts: question.maxAttempts || 3,
        validationMode: question.validationMode || "immediate",
        options: question.options || (question.type === "single" || question.type === "multiple" ? [
          { id: `opt-${Date.now()}-1`, text: "", isCorrect: false },
          { id: `opt-${Date.now()}-2`, text: "", isCorrect: false },
        ] : undefined),
        acceptedAnswers: question.acceptedAnswers || (question.type === "shortAnswer" ? [] : undefined),
        matchingPairs: question.matchingPairs || (question.type === "matching" ? [] : undefined),
        orderingItems: question.orderingItems || (question.type === "ordering" ? [] : undefined),
        correctAnswer: question.correctAnswer !== undefined ? question.correctAnswer : (question.type === "trueFalse" ? true : undefined),
      };
      setFormData(loadedQuestion);
    } else {
      // Reset to default for new question with minimum required items
      setFormData({
        id: `q-${Date.now()}`,
        type: "single",
        text: "",
        points: 10,
        maxAttempts: 3,
        validationMode: "immediate",
        options: [
          { id: `opt-${Date.now()}-1`, text: "", isCorrect: false },
          { id: `opt-${Date.now()}-2`, text: "", isCorrect: false },
        ],
      });
    }
  }, [question]);

  const updateFormData = (updates: Partial<Question>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleAddOption = () => {
    const options = formData.options || [];
    updateFormData({
      options: [...options, { id: `opt-${Date.now()}`, text: "", isCorrect: false }],
    });
  };

  const handleUpdateOption = (index: number, updates: Partial<{ text: string; isCorrect: boolean }>) => {
    const options = [...(formData.options || [])];
    options[index] = { ...options[index], ...updates };
    updateFormData({ options });
  };

  const handleRemoveOption = (index: number) => {
    const options = [...(formData.options || [])];
    const minOptions = formData.type === "multiple" ? 3 : 2;
    if (options.length <= minOptions) {
      return; // Prevent deletion below minimum
    }
    options.splice(index, 1);
    updateFormData({ options });
  };

  const handleAddAcceptedAnswer = (answer: string) => {
    if (!answer?.trim()) return;
    const answers = formData.acceptedAnswers || [];
    const newAnswers = [...answers, answer.trim()];
    updateFormData({ acceptedAnswers: newAnswers });
  };

  const handleRemoveAcceptedAnswer = (index: number) => {
    const answers = [...(formData.acceptedAnswers || [])];
    answers.splice(index, 1);
    updateFormData({ acceptedAnswers: answers });
  };

  const isValid = () => {
    if (!formData.text?.trim()) {
      return false;
    }
    if (formData.points <= 0) {
      return false;
    }

    switch (formData.type) {
      case "single":
        const singleOpts = formData.options || [];
        if (singleOpts.length < 2) return false;
        if (!singleOpts.every(o => o.text?.trim())) return false;
        if (!singleOpts.some(o => o.isCorrect)) return false;
        break;
      case "multiple":
        const multiOpts = formData.options || [];
        if (multiOpts.length < 3) return false;
        if (!multiOpts.every(o => o.text?.trim())) return false;
        if (!multiOpts.some(o => o.isCorrect)) return false;
        break;
      case "shortAnswer":
        if (!formData.acceptedAnswers || formData.acceptedAnswers.length === 0) {
          return false;
        }
        break;
      case "matching":
        const pairs = formData.matchingPairs || [];
        if (pairs.length < 2) return false;
        if (!pairs.every(p => p.left?.trim() && p.right?.trim())) return false;
        break;
      case "ordering":
        const items = formData.orderingItems || [];
        if (items.length < 2) return false;
        if (!items.every(i => i.text?.trim())) return false;
        break;
    }

    return true;
  };

  const handleSave = () => {
    if (isValid()) {
      onSave(formData);
    }
  };

  return (
    <Card className="cyber-border">
      <CardHeader>
        <CardTitle>
          {question ? "Edit Question" : "New Question"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Question Text */}
        <div className="space-y-2">
          <Label htmlFor="question-text" className="text-sm font-semibold">
            Question Text <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="question-text"
            value={formData.text}
            onChange={(e) => updateFormData({ text: e.target.value })}
            placeholder="Enter your question..."
            rows={3}
          />
        </div>

        {/* Question Type */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">
            Question Type <span className="text-red-500">*</span>
          </Label>
          <Select value={formData.type} onValueChange={(value: any) => {
            const newData: Partial<Question> = { type: value };
            // Initialize with minimum required items based on type
            if (value === "single") {
              newData.options = [
                { id: `opt-${Date.now()}-1`, text: "", isCorrect: false },
                { id: `opt-${Date.now()}-2`, text: "", isCorrect: false },
              ];
            } else if (value === "multiple") {
              newData.options = [
                { id: `opt-${Date.now()}-1`, text: "", isCorrect: false },
                { id: `opt-${Date.now()}-2`, text: "", isCorrect: false },
                { id: `opt-${Date.now()}-3`, text: "", isCorrect: false },
              ];
            } else if (value === "matching") {
              newData.matchingPairs = [
                { id: `pair-${Date.now()}-1`, left: "", right: "" },
                { id: `pair-${Date.now()}-2`, left: "", right: "" },
              ];
            } else if (value === "ordering") {
              newData.orderingItems = [
                { id: `item-${Date.now()}-1`, text: "", correctOrder: 1 },
                { id: `item-${Date.now()}-2`, text: "", correctOrder: 2 },
              ];
            } else if (value === "shortAnswer") {
              newData.acceptedAnswers = [];
            }
            updateFormData(newData);
          }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single Choice</SelectItem>
              <SelectItem value="multiple">Multiple Choice</SelectItem>
              <SelectItem value="trueFalse">True/False</SelectItem>
              <SelectItem value="shortAnswer">Short Answer</SelectItem>
              <SelectItem value="matching">Matching</SelectItem>
              <SelectItem value="ordering">Ordering</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Points & Max Attempts */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="points" className="text-sm font-semibold">
              Points <span className="text-red-500">*</span>
            </Label>
            <Input
              id="points"
              type="number"
              min="1"
              value={formData.points}
              onChange={(e) => updateFormData({ points: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxAttempts" className="text-sm font-semibold">
              Max Attempts (0 = unlimited)
            </Label>
            <Input
              id="maxAttempts"
              type="number"
              min="0"
              value={formData.maxAttempts || 0}
              onChange={(e) => updateFormData({ maxAttempts: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>

        {/* Validation Mode */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Validation Mode</Label>
          <RadioGroup
            value={formData.validationMode || "immediate"}
            onValueChange={(value: any) => updateFormData({ validationMode: value })}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="immediate" id="immediate" />
              <Label htmlFor="immediate" className="cursor-pointer">
                Immediate feedback
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="onSubmit" id="onSubmit" />
              <Label htmlFor="onSubmit" className="cursor-pointer">
                On final submission only
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Type-Specific UI */}
        {(formData.type === "single" || formData.type === "multiple") && (
          <div className="space-y-3">
            <Label className="text-sm font-semibold">
              Options <span className="text-red-500">*</span>
            </Label>
            {formData.type === "single" ? (
              <RadioGroup
                value={formData.options?.find(o => o.isCorrect)?.id || ""}
                onValueChange={(value) => {
                  const opts = formData.options?.map(o => ({
                    ...o,
                    isCorrect: o.id === value,
                  })) || [];
                  updateFormData({ options: opts });
                }}
              >
                <div className="space-y-2">
                  {(formData.options || []).map((option, index) => (
                    <div key={option.id} className="flex items-center gap-2">
                      <RadioGroupItem value={option.id} id={option.id} />
                      <Input
                        value={option.text}
                        onChange={(e) => handleUpdateOption(index, { text: e.target.value })}
                        placeholder={`Option ${index + 1}`}
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveOption(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            ) : (
              <div className="space-y-2">
                {(formData.options || []).map((option, index) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={option.isCorrect}
                      onCheckedChange={(checked) =>
                        handleUpdateOption(index, { isCorrect: checked as boolean })
                      }
                    />
                    <Input
                      value={option.text}
                      onChange={(e) => handleUpdateOption(index, { text: e.target.value })}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveOption(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleAddOption}>
              <Plus className="mr-2 h-3 w-3" />
              Add Option
            </Button>
            <p className="text-xs text-muted-foreground">
              {formData.type === "single"
                ? "Minimum 2 options required. Select one correct answer."
                : "Minimum 3 options required. Select at least one correct answer."}
            </p>
          </div>
        )}

        {formData.type === "trueFalse" && (
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Correct Answer</Label>
            <RadioGroup
              value={formData.correctAnswer ? "true" : "false"}
              onValueChange={(value) => updateFormData({ correctAnswer: value === "true" })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id="true" />
                <Label htmlFor="true" className="cursor-pointer">True</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id="false" />
                <Label htmlFor="false" className="cursor-pointer">False</Label>
              </div>
            </RadioGroup>
          </div>
        )}

        {formData.type === "shortAnswer" && (
          <div className="space-y-3">
            <Label className="text-sm font-semibold">
              Accepted Answers <span className="text-red-500">*</span>
            </Label>
            <div className="space-y-2">
              {(formData.acceptedAnswers || []).map((answer, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Badge variant="secondary" className="flex-1 justify-between px-3 py-2">
                    <span>{answer}</span>
                    <button 
                      type="button"
                      onClick={() => handleRemoveAcceptedAnswer(index)}
                      className="hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                id="new-answer-input"
                placeholder="Type an answer and press Enter or click Add..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const input = e.currentTarget;
                    if (input.value.trim()) {
                      handleAddAcceptedAnswer(input.value);
                      input.value = "";
                    }
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const input = document.getElementById('new-answer-input') as HTMLInputElement;
                  if (input?.value.trim()) {
                    handleAddAcceptedAnswer(input.value);
                    input.value = "";
                    input.focus();
                  }
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            <div className="space-y-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="use-regex"
                  checked={formData.useRegex}
                  onCheckedChange={(checked) => updateFormData({ useRegex: checked as boolean })}
                />
                <Label htmlFor="use-regex" className="text-sm cursor-pointer font-medium">
                  🔍 Use regex pattern matching
                </Label>
              </div>
              {formData.useRegex && (
                <div className="ml-6 space-y-2 p-3 bg-cyan-500/10 rounded border border-cyan-500/30">
                  <p className="text-xs font-semibold text-cyan-400">Regex Examples:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• IP: <code className="bg-background px-1 rounded">^(\d{'{1,3}'}\.){'{3}'}\d{'{1,3}'}$</code></li>
                    <li>• Flag: <code className="bg-background px-1 rounded">^FLAG{'{'}{'{'}[a-f0-9]{'{32}'}{'}'}{'}'}$</code></li>
                    <li>• Multiple: <code className="bg-background px-1 rounded">^(admin|root|administrator)$</code></li>
                  </ul>
                  <p className="text-xs text-amber-400">⚠️ Test your patterns! Invalid regex will fall back to exact match.</p>
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="case-sensitive"
                  checked={(formData as any).caseSensitive}
                  onCheckedChange={(checked) => updateFormData({ ...formData, caseSensitive: checked as boolean } as any)}
                />
                <Label htmlFor="case-sensitive" className="text-sm cursor-pointer font-medium">
                  🔤 Case-sensitive matching
                </Label>
              </div>
              {(formData as any).caseSensitive && (
                <div className="ml-6 p-2 bg-orange-500/10 rounded border border-orange-500/30">
                  <p className="text-xs text-orange-400">"FLAG{'{'}secret{'}'}" ≠ "flag{'{'}secret{'}'}"</p>
                </div>
              )}
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-400 mb-1">💡 Matching Behavior:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• <strong>Default</strong>: Trimmed, case-insensitive ("admin" = "ADMIN" = " Admin ")</li>
                <li>• <strong>Regex ON</strong>: Pattern matching (flexible variations)</li>
                <li>• <strong>Case-sensitive ON</strong>: Exact case required</li>
                <li>• <strong>Both ON</strong>: Regex with case-sensitive mode</li>
              </ul>
            </div>
          </div>
        )}

        {formData.type === "matching" && (
          <div className="space-y-3">
            <Label className="text-sm font-semibold">
              Matching Pairs <span className="text-red-500">*</span>
            </Label>
            <div className="space-y-2">
              {(formData.matchingPairs || []).map((pair, index) => (
                <div key={pair.id} className="grid grid-cols-2 gap-2 items-center">
                  <Input
                    value={pair.left}
                    onChange={(e) => {
                      const pairs = [...(formData.matchingPairs || [])];
                      pairs[index] = { ...pairs[index], left: e.target.value };
                      updateFormData({ matchingPairs: pairs });
                    }}
                    placeholder="Left item"
                  />
                  <div className="flex gap-2">
                    <Input
                      value={pair.right}
                      onChange={(e) => {
                        const pairs = [...(formData.matchingPairs || [])];
                        pairs[index] = { ...pairs[index], right: e.target.value };
                        updateFormData({ matchingPairs: pairs });
                      }}
                      placeholder="Right match"
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const pairs = [...(formData.matchingPairs || [])];
                        pairs.splice(index, 1);
                        updateFormData({ matchingPairs: pairs });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const pairs = formData.matchingPairs || [];
                updateFormData({
                  matchingPairs: [...pairs, { id: `pair-${Date.now()}`, left: "", right: "" }],
                });
              }}
            >
              <Plus className="mr-2 h-3 w-3" />
              Add Pair
            </Button>
            <p className="text-xs text-muted-foreground">
              Create pairs that solvers must match correctly
            </p>
          </div>
        )}

        {formData.type === "ordering" && (
          <div className="space-y-3">
            <Label className="text-sm font-semibold">
              Items to Order <span className="text-red-500">*</span>
            </Label>
            <div className="space-y-2">
              {(formData.orderingItems || []).map((item, index) => (
                <div key={item.id} className="flex items-center gap-2">
                  <Badge variant="secondary" className="w-8 text-center">
                    {index + 1}
                  </Badge>
                  <Input
                    value={item.text}
                    onChange={(e) => {
                      const items = [...(formData.orderingItems || [])];
                      items[index] = { ...items[index], text: e.target.value };
                      updateFormData({ orderingItems: items });
                    }}
                    placeholder={`Step ${index + 1}`}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const items = [...(formData.orderingItems || [])];
                      items.splice(index, 1);
                      // Re-index
                      items.forEach((it, idx) => it.correctOrder = idx + 1);
                      updateFormData({ orderingItems: items });
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const items = formData.orderingItems || [];
                updateFormData({
                  orderingItems: [
                    ...items,
                    { id: `item-${Date.now()}`, text: "", correctOrder: items.length + 1 },
                  ],
                });
              }}
            >
              <Plus className="mr-2 h-3 w-3" />
              Add Item
            </Button>
            <p className="text-xs text-muted-foreground">
              List items in the correct order. Solvers will be asked to reorder them.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={!isValid()}
            className="flex-1"
          >
            <Check className="mr-2 h-4 w-4" />
            Save Question
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

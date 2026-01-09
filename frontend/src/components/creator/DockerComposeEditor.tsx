import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, AlertTriangle, XCircle, Lightbulb, Wand2 } from 'lucide-react';
import { httpClient } from '../../api/httpClient';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  autoCorrections: string[];
}

interface DockerComposeEditorProps {
  scenarioId: string;
  initialContent?: string;
  onSave: (content: string) => void;
}

export function DockerComposeEditor({ scenarioId, initialContent = '', onSave }: DockerComposeEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [correctedYaml, setCorrectedYaml] = useState<string>('');
  const [hints, setHints] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<'single-container' | 'multi-container' | 'network-challenge' | null>(null);

  // Auto-validate on content change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (content.trim()) {
        validateCompose();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [content]);

  const validateCompose = async () => {
    if (!content.trim()) return;

    setIsValidating(true);
    try {
      const response = await httpClient.post('/creator/testing/validate-compose', {
        dockerCompose: content,
      });

      setValidation(response.data.validation);
      setCorrectedYaml(response.data.correctedYaml || '');
      setHints(response.data.hints || []);
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const loadTemplate = async (type: 'single-container' | 'multi-container' | 'network-challenge') => {
    try {
      const response = await httpClient.get(`/creator/testing/template/${type}`);
      setContent(response.data.template);
      setSelectedTemplate(type);
    } catch (error) {
      console.error('Failed to load template:', error);
    }
  };

  const applyCorrectedVersion = () => {
    if (correctedYaml) {
      setContent(correctedYaml);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>docker-compose.yml Editor</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadTemplate('single-container')}
              >
                Single Container
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadTemplate('multi-container')}
              >
                Multi-Container
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadTemplate('network-challenge')}
              >
                Network Challenge
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="editor" className="w-full">
            <TabsList>
              <TabsTrigger value="editor">Editor</TabsTrigger>
              <TabsTrigger value="validation">Validation Results</TabsTrigger>
              {correctedYaml && <TabsTrigger value="corrected">Auto-Corrected</TabsTrigger>}
            </TabsList>

            <TabsContent value="editor" className="space-y-4">
              <Textarea
                className="font-mono text-sm min-h-[400px]"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="version: '3.8'&#10;services:&#10;  challenge:&#10;    image: kalilinux/kali-rolling:latest&#10;    ..."
              />

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {isValidating ? 'Validating...' : 'Auto-validation enabled'}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={validateCompose}>
                    Validate Now
                  </Button>
                  <Button onClick={() => onSave(content)}>
                    Save
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="validation" className="space-y-4">
              {validation ? (
                <>
                  {/* Validation Status */}
                  <Alert className={validation.valid ? 'border-green-500' : 'border-red-500'}>
                    <AlertDescription className="flex items-center gap-2">
                      {validation.valid ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span>Validation passed! Your docker-compose.yml is valid.</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span>Validation failed. Please fix the errors below.</span>
                        </>
                      )}
                    </AlertDescription>
                  </Alert>

                  {/* Errors */}
                  {validation.errors.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2 text-red-600 flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        Errors ({validation.errors.length})
                      </h4>
                      <div className="space-y-1">
                        {validation.errors.map((error, idx) => (
                          <Alert key={idx} variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                          </Alert>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warnings */}
                  {validation.warnings.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2 text-yellow-600 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Warnings ({validation.warnings.length})
                      </h4>
                      <div className="space-y-1">
                        {validation.warnings.map((warning, idx) => (
                          <Alert key={idx} className="border-yellow-500">
                            <AlertDescription>{warning}</AlertDescription>
                          </Alert>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Auto-Corrections */}
                  {validation.autoCorrections.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2 text-blue-600 flex items-center gap-2">
                        <Wand2 className="h-4 w-4" />
                        Auto-Corrections Available ({validation.autoCorrections.length})
                      </h4>
                      <div className="space-y-1">
                        {validation.autoCorrections.map((correction, idx) => (
                          <Alert key={idx} className="border-blue-500">
                            <AlertDescription>{correction}</AlertDescription>
                          </Alert>
                        ))}
                      </div>
                      {correctedYaml && (
                        <Button
                          className="mt-2"
                          variant="default"
                          onClick={applyCorrectedVersion}
                        >
                          Apply All Corrections
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Hints */}
                  {hints.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2 text-purple-600 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4" />
                        Helpful Tips
                      </h4>
                      <div className="space-y-1">
                        {hints.map((hint, idx) => (
                          <Alert key={idx} className="border-purple-500">
                            <AlertDescription>{hint}</AlertDescription>
                          </Alert>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <Alert>
                  <AlertDescription>
                    Start typing or paste your docker-compose.yml content to see validation results.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            {correctedYaml && (
              <TabsContent value="corrected" className="space-y-4">
                <Alert className="border-blue-500">
                  <AlertDescription>
                    This is the auto-corrected version with resource limits enforced and security issues fixed.
                  </AlertDescription>
                </Alert>

                <Textarea
                  className="font-mono text-sm min-h-[400px]"
                  value={correctedYaml}
                  readOnly
                />

                <Button onClick={applyCorrectedVersion} className="w-full">
                  Use This Corrected Version
                </Button>
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

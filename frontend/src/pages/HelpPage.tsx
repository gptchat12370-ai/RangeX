import React from "react";
import { HelpCircle, BookOpen, Video, MessageSquare, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

export function HelpPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
          <HelpCircle className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Help & Support</h1>
          <p className="text-muted-foreground">
            Get help with RangeX and learn how to make the most of the platform
          </p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cyber-border cursor-pointer hover:border-primary/50 transition-colors">
          <CardContent className="pt-6 text-center">
            <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-primary/20 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-bold mb-1">Documentation</h3>
            <p className="text-sm text-muted-foreground">Browse guides and tutorials</p>
          </CardContent>
        </Card>

        <Card className="cyber-border cursor-pointer hover:border-primary/50 transition-colors">
          <CardContent className="pt-6 text-center">
            <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-accent/20 flex items-center justify-center">
              <Video className="h-6 w-6 text-accent" />
            </div>
            <h3 className="font-bold mb-1">Video Tutorials</h3>
            <p className="text-sm text-muted-foreground">Watch walkthroughs</p>
          </CardContent>
        </Card>

        <Card className="cyber-border cursor-pointer hover:border-primary/50 transition-colors">
          <CardContent className="pt-6 text-center">
            <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-green-500/20 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-green-400" />
            </div>
            <h3 className="font-bold mb-1">Community Forum</h3>
            <p className="text-sm text-muted-foreground">Ask questions</p>
          </CardContent>
        </Card>

        <Card className="cyber-border cursor-pointer hover:border-primary/50 transition-colors">
          <CardContent className="pt-6 text-center">
            <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-orange-500/20 flex items-center justify-center">
              <FileText className="h-6 w-6 text-orange-400" />
            </div>
            <h3 className="font-bold mb-1">Submit Ticket</h3>
            <p className="text-sm text-muted-foreground">Get support</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="faq" className="space-y-6">
        <TabsList>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="getting-started">Getting Started</TabsTrigger>
          <TabsTrigger value="troubleshooting">Troubleshooting</TabsTrigger>
        </TabsList>

        <TabsContent value="faq">
          <Card className="cyber-border">
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
              <CardDescription>Find answers to common questions</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>How do I start my first challenge?</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-muted-foreground">
                      <p>To start your first challenge:</p>
                      <ol className="list-decimal list-inside space-y-1 ml-4">
                        <li>Navigate to "Challenges" in the sidebar</li>
                        <li>Browse available challenges or use filters</li>
                        <li>Click on a challenge to view details</li>
                        <li>Click "Start Challenge" button</li>
                        <li>Wait for the environment to provision</li>
                        <li>Click "Start" in the ready modal</li>
                      </ol>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-2">
                  <AccordionTrigger>What are the different question types?</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 text-muted-foreground">
                      <div>
                        <p className="font-medium text-foreground">Multiple Choice (MCQ)</p>
                        <p className="text-sm">Select the correct answer from provided options.</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Short Answer</p>
                        <p className="text-sm">Type in your answer. Can be exact match, regex, or case-insensitive.</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Practical Task</p>
                        <p className="text-sm">Multi-step challenges where you perform actions and verify results.</p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-3">
                  <AccordionTrigger>How does scoring work?</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-muted-foreground">
                      <p>Scoring depends on the challenge's policy:</p>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li><strong>All or Nothing:</strong> Full points for correct answer, zero for incorrect</li>
                        <li><strong>Partial:</strong> Points awarded per step or attempt</li>
                        <li>Using hints may reduce your score</li>
                        <li>Attempt limits may apply to some questions</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-4">
                  <AccordionTrigger>Can I pause a challenge and resume later?</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-muted-foreground">
                      <p>Yes! When you click Exit, you have two options:</p>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li><strong>Exit & Keep Running:</strong> Your environment stays active and you can resume from where you left off</li>
                        <li><strong>Exit & Terminate:</strong> Ends the session completely and tears down the environment</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-5">
                  <AccordionTrigger>How do I access lab machines?</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-muted-foreground">
                      <p>In the challenge environment:</p>
                      <ol className="list-decimal list-inside space-y-1 ml-4">
                        <li>Go to the "Servers" tab</li>
                        <li>Find the machine you want to access</li>
                        <li>Check if "solverCanAccess" is enabled</li>
                        <li>Click the access method (SSH/RDP/Web)</li>
                        <li>Use the provided credentials (click copy icon)</li>
                      </ol>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-6">
                  <AccordionTrigger>What if a machine stops responding?</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-muted-foreground">
                      <p>You have two options in the Servers tab:</p>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li><strong>Restart:</strong> Gracefully reboots the machine</li>
                        <li><strong>Reset:</strong> Completely rebuilds the machine to initial state</li>
                      </ul>
                      <p className="mt-2">Note: Resetting will lose any progress on that machine.</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="getting-started">
          <Card className="cyber-border">
            <CardHeader>
              <CardTitle>Getting Started Guide</CardTitle>
              <CardDescription>Learn the basics of RangeX</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-bold mb-3">1. Understanding Roles</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-card/50 rounded-lg border">
                    <h4 className="font-medium mb-2 text-blue-400">Solver</h4>
                    <p className="text-sm text-muted-foreground">
                      Take challenges, earn points, join teams, and compete on leaderboards.
                    </p>
                  </div>
                  <div className="p-4 bg-card/50 rounded-lg border">
                    <h4 className="font-medium mb-2 text-purple-400">Creator</h4>
                    <p className="text-sm text-muted-foreground">
                      All Solver features plus create challenges, host events, and share scenarios.
                    </p>
                  </div>
                  <div className="p-4 bg-card/50 rounded-lg border">
                    <h4 className="font-medium mb-2 text-red-400">Admin</h4>
                    <p className="text-sm text-muted-foreground">
                      All Creator features plus manage users, images catalog, and platform settings.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold mb-3">2. Your First Challenge</h3>
                <div className="space-y-2 text-muted-foreground">
                  <p>We recommend starting with "Introduction to Nmap":</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Difficulty: Easy</li>
                    <li>Duration: 60 minutes</li>
                    <li>Category: Networking</li>
                    <li>What you'll learn: Network scanning basics with Nmap</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="font-bold mb-3">3. Career Paths</h3>
                <p className="text-muted-foreground mb-3">
                  Follow structured learning paths designed by experts:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-muted-foreground">
                  <li>SOC Analyst Career Path</li>
                  <li>Penetration Tester Path</li>
                  <li>Incident Response Path</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold mb-3">4. Earning Badges</h3>
                <p className="text-muted-foreground">
                  Complete challenges to unlock badges and achievements. Check your progress in the Account page.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="troubleshooting">
          <Card className="cyber-border">
            <CardHeader>
              <CardTitle>Troubleshooting</CardTitle>
              <CardDescription>Common issues and solutions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-card/50 rounded-lg border">
                <h3 className="font-bold mb-2">Environment won't load</h3>
                <p className="text-sm text-muted-foreground">
                  If the loading screen is stuck:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-sm text-muted-foreground mt-2">
                  <li>Refresh the page and try again</li>
                  <li>Check your internet connection</li>
                  <li>Clear browser cache and cookies</li>
                  <li>Try a different browser</li>
                </ul>
              </div>

              <div className="p-4 bg-card/50 rounded-lg border">
                <h3 className="font-bold mb-2">Can't connect to machine</h3>
                <p className="text-sm text-muted-foreground">
                  If you can't access a lab machine:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-sm text-muted-foreground mt-2">
                  <li>Verify "solverCanAccess" is enabled</li>
                  <li>Check credentials are correct</li>
                  <li>Try restarting the machine</li>
                  <li>Check if the machine is still running</li>
                </ul>
              </div>

              <div className="p-4 bg-card/50 rounded-lg border">
                <h3 className="font-bold mb-2">Answer marked incorrect but I'm sure it's right</h3>
                <p className="text-sm text-muted-foreground">
                  For short answer questions:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-sm text-muted-foreground mt-2">
                  <li>Check for extra spaces or special characters</li>
                  <li>Verify capitalization if case-sensitive</li>
                  <li>Look at the question format requirements</li>
                  <li>Use hints if available</li>
                </ul>
              </div>

              <div className="p-4 bg-card/50 rounded-lg border">
                <h3 className="font-bold mb-2">Timer ran out before I finished</h3>
                <p className="text-sm text-muted-foreground">
                  When time expires:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-sm text-muted-foreground mt-2">
                  <li>Your progress is automatically saved</li>
                  <li>You can retake the challenge</li>
                  <li>Previous attempts are recorded in your history</li>
                  <li>Consider easier challenges to build skills</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Contact Support */}
      <Card className="cyber-border cyber-glow">
        <CardContent className="pt-6">
          <div className="text-center">
            <h3 className="font-bold mb-2">Still need help?</h3>
            <p className="text-muted-foreground mb-4">
              Our support team is here to assist you
            </p>
            <Button className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Contact Support
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

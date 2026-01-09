import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getAssetUrl } from "../utils/assetUrl";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Trophy,
  Target,
  Bell,
  MapPin,
  Info,
  Play,
  Gamepad2,
  Users,
} from "lucide-react";
import { Event, Scenario, RegistrationStatus } from "../types";
import { creatorApi } from "../api/creatorApi";
import { eventsApi } from "../api/eventsApi";
import { solverApi } from "../api/solverApi";
import { useStore } from "../lib/store";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Progress } from "../components/ui/progress";
import { Skeleton } from "../components/ui/skeleton";
import { ScenarioCard } from "../components/ScenarioCard";
import { EventLeaderboard } from "../components/EventLeaderboard";
import { TeamRegistrationModal } from "../components/TeamRegistrationModal";
import { formatDate, getDifficultyColor } from "../lib/utils";
import { toast } from "sonner";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useStore();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<any | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isRegistered, setIsRegistered] = useState(false);
  const [eventProgress, setEventProgress] = useState<Record<string, { points: number; completed: boolean }>>({});
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus | null>(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any | null>(null);
 

  const loadEvent = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [evData, solverScenarios] = await Promise.all([
        eventsApi.getEvent(id), // Use public events API instead of creator API
        solverApi.listScenarios(),
      ]);
      if (!evData) {
        throw new Error("Event not found");
      }
      setEvent(evData as any);
      if (evData?.scenarios) {
        const mapped = (evData.scenarios as any[])
          .map((s: any) => {
            const found = solverScenarios.find((ss: any) => ss.id === (s.scenarioVersionId || s));
            if (!found) return null;
            // Use coverImageUrl directly
            return {
              ...found,
              coverImageUrl: found.coverImageUrl,
            };
          })
          .filter((s: any) => s && s.status === 'PUBLISHED' && !s.isArchived);
        setScenarios(mapped as any);
      } else {
        setScenarios([]);
      }
      const regList: any[] = (evData as any)?.registrations || (evData as any)?.participants || [];
      const currentUserId = currentUser?.id;
      setIsRegistered(currentUserId ? regList.some((r) => r.userId === currentUserId || r === currentUserId) : false);
    } catch (err: any) {
      const is404 = err?.response?.status === 404;
      if (is404) {
        toast.error("Event not found");
        navigate("/events", { replace: true });
        return;
      }
      setEvent(null);
      setScenarios([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (id && currentUser) {
      loadRegistrationStatus();
      loadParticipants();
      loadActiveSession();
      loadEventProgress();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentUser]);

  useEffect(() => {
    if ((location.state as any)?.refetch) {
      loadEvent();
      loadEventProgress();
      loadActiveSession();
      navigate(location.pathname, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, location.pathname]);

  const loadParticipants = async () => {
    if (!id) return;
    try {
      const data = await eventsApi.getEventParticipants(id);
      setParticipants(data || []);
    } catch (error) {
      console.error('Failed to load participants');
      setParticipants([]);
    }
  };

  const loadRegistrationStatus = async () => {
    if (!id) return;
    try {
      const status = await eventsApi.getRegistrationStatus(id);
      setRegistrationStatus(status);
      setIsRegistered(status.registered);
    } catch (error) {
      console.error('Failed to load registration status');
    }
  };

  const loadActiveSession = async () => {
    if (!id) return;
    try {
      const response = await eventsApi.getActiveEventSession(id);
      if (response.hasActiveSession) {
        setActiveSession(response.session);
      } else {
        setActiveSession(null);
      }
    } catch (error) {
      console.error('Failed to load active session');
      setActiveSession(null);
    }
  };

  const loadEventProgress = async () => {
    if (!id) return;
    try {
      const response = await eventsApi.getMyEventSessions(id);
      const sessions = response.sessions || [];
      
      // Map sessions to scenario IDs for progress tracking
      const progressMap: Record<string, { points: number; completed: boolean }> = {};
      
      sessions.forEach((session: any) => {
        const scenarioId = session.scenarioVersionId;
        if (!progressMap[scenarioId]) {
          progressMap[scenarioId] = { points: 0, completed: false };
        }
        
        // Accumulate points and mark as completed if any session is completed
        progressMap[scenarioId].points += session.score || 0;
        if (session.status === 'Completed') {
          progressMap[scenarioId].completed = true;
        }
      });
      
      setEventProgress(progressMap);
    } catch (error) {
      console.error('Failed to load event progress:', error);
      setEventProgress({});
    }
  };

  const handleRegister = async () => {
    if (!id || !event) return;

    // Validate event hasn't ended
    if (event.endDate && new Date(event.endDate) < new Date()) {
      toast.error('This event has already ended. Registration is closed.');
      return;
    }

    // Check event format
    if (event.format === 'Team vs Team') {
      setShowTeamModal(true); // Show team selection modal
    } else {
      // Player vs Player - register directly
      try {
        await eventsApi.registerPlayerForEvent(id);
        toast.success('Successfully registered for the event!');
        await loadEvent();
        await loadRegistrationStatus();
        await loadParticipants();
      } catch (error: any) {
        const message = error.response?.data?.message || 'Registration failed';
        if (message.includes('already ended')) {
          toast.error('This event has already ended.');
        } else if (message.includes('full')) {
          toast.error('This event is full. No more spots available.');
        } else if (message.includes('Already registered')) {
          toast.info('You are already registered for this event.');
        } else {
          toast.error(message);
        }
      }
    }
  };

  const handleUnregister = async () => {
    if (!id) return;
    try {
      await eventsApi.unregisterFromEventNew(id);
      await loadEvent();
      await loadRegistrationStatus();
      await loadParticipants();
      toast.success("Unregistered from event");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to unregister");
    }
  };

  const handleStartScenario = (scenarioId: string, isMultiplayer: boolean = false) => {
    console.log('[EventDetailPage] handleStartScenario', { scenarioId, isMultiplayer, isRegistered, registrationStatus });
    
    // Use registrationStatus.registered directly (more reliable than isRegistered state)
    const actuallyRegistered = registrationStatus?.registered || isRegistered || currentUser?.roleAdmin;
    
    if (isMultiplayer && !actuallyRegistered) {
      console.error('[EventDetailPage] Registration check failed', { isRegistered, registrationStatus, actuallyRegistered });
      toast.error("You must be registered for the event to compete");
      return;
    }
    
    // Check if event is active for competition mode
    if (isMultiplayer) {
      const now = new Date();
      if (event?.startDate && now < new Date(event.startDate)) {
        toast.error("Event hasn't started yet. Competition mode will be available when the event begins.");
        return;
      }
      if (event?.endDate && now > new Date(event.endDate)) {
        toast.error("Event has ended. Competition mode is no longer available.");
        return;
      }
      
      // If there's an active session for this scenario, navigate directly to the challenge
      if (activeSession && (activeSession.scenarioVersionId === scenarioId || activeSession.scenarioId === scenarioId)) {
        toast.info("Resuming your active event challenge session!");
        // Navigate to the in-challenge page with the environment session ID
        if (activeSession.environmentSessionId) {
          navigate(`/in-challenge/${activeSession.environmentSessionId}/${scenarioId}`);
        } else {
          // Fallback: try to start normally if no environment session found
          navigate(`/launching/${scenarioId}?event=${id}`);
        }
        return;
      }
      
      toast.info("Starting challenge in competition mode - your progress will count towards the leaderboard!");
    }
    
    navigate(`/launching/${scenarioId}${isMultiplayer ? '?event=' + id : ''}`);
  };

  const handleViewScenario = (scenarioId: string) => {
    navigate(`/challenges/${scenarioId}`);
  };

  const getTotalEventPoints = () => {
    return Object.values(eventProgress).reduce((acc: number, progress: { points: number; completed: boolean }) => acc + progress.points, 0);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Event not found</p>
          <Button
            variant="link"
            onClick={() => navigate("/events")}
            className="mt-4"
          >
            Go back to events
          </Button>
        </div>
      </div>
    );
  }

  const registrationCount = event.registrations?.length ?? event.participants?.length ?? 0;
  const isUpcoming = event.startDate ? new Date(event.startDate) > new Date() : false;
  const isActive =
    event.startDate && event.endDate
      ? new Date(event.startDate) <= new Date() && new Date(event.endDate) >= new Date()
      : false;
  const isPast = event.endDate ? new Date(event.endDate) < new Date() : false;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        className="gap-2"
        onClick={() => navigate("/events")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Events
      </Button>

      {/* Event Header */}
      <div className="cyber-border rounded-lg p-6 bg-gradient-to-br from-card to-card/50 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <Badge
                className={
                  isActive
                    ? "bg-green-500/20 text-green-400 border-green-500/50"
                    : isUpcoming
                    ? "bg-blue-500/20 text-blue-400 border-blue-500/50"
                    : "bg-muted-foreground/20 text-muted-foreground"
                }
              >
                {isActive ? "Live Now" : isUpcoming ? "Upcoming" : "Ended"}
              </Badge>
              <Badge variant="outline">{event.format}</Badge>
            </div>
            <h1 className="text-4xl font-bold">{event.name}</h1>
            <p className="text-lg text-muted-foreground max-w-3xl">
              {event.description}
            </p>
          </div>

          {(isUpcoming || isActive) && !isPast ? (
            <div className="flex gap-2">
              {(registrationStatus?.registered || isRegistered) ? (
                <Button
                  size="lg"
                  variant="destructive"
                  className="gap-2"
                  onClick={handleUnregister}
                >
                  <Bell className="h-4 w-4" />
                  Unregister
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="gap-2"
                  onClick={handleRegister}
                  disabled={registrationCount >= event.maxParticipants}
                >
                  <Bell className="h-4 w-4" />
                  Register
                </Button>
              )}
            </div>
          ) : isPast ? (
            <Badge variant="secondary" className="text-muted-foreground">
              Event Ended
            </Badge>
          ) : null}
        </div>

        {/* Event Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">Start Date</span>
            </div>
            <p className="font-medium">{formatDate(event.startDate)}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm">End Date</span>
            </div>
            <p className="font-medium">{formatDate(event.endDate)}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Target className="h-4 w-4" />
              <span className="text-sm">Challenges</span>
            </div>
            <p className="font-medium">{event.scenarios.length}</p>
          </div>
        </div>

        {/* Registration Progress */}
        {(isUpcoming || isActive) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Registration</span>
              <span className="text-primary">
                {Math.round(
                  (registrationCount / event.maxParticipants) * 100
                )}
                %
              </span>
            </div>
            <Progress
              value={(registrationCount / event.maxParticipants) * 100}
              className="h-2"
            />
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="challenges" className="space-y-6">
        <TabsList>
          <TabsTrigger value="challenges">Challenges</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
        </TabsList>

        <TabsContent value="challenges" className="space-y-6">
          {isRegistered && (
            <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border border-primary/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Trophy className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">Your Event Progress</h3>
                    <p className="text-sm text-muted-foreground">
                      Total points earned: <span className="text-primary font-bold">{getTotalEventPoints()}</span> | 
                      Completed: <span className="text-primary font-bold">{Object.values(eventProgress).filter((p: { points: number; completed: boolean }) => p.completed).length}/{scenarios.length}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Event Challenges ({scenarios.length})</h2>
              {isRegistered && isActive && (
                <Badge className="gap-2 bg-green-500/20 text-green-400 border-green-500/50">
                  <Clock className="h-3 w-3" />
                  Event is Live - Multiplayer Mode Active
                </Badge>
              )}
            </div>
            
            {scenarios.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {scenarios.map((scenario) => (
                  <Card key={scenario.id} className="group overflow-hidden hover:border-primary/50 transition-all duration-300 cyber-border flex flex-col">
                    {/* Cover Image */}
                    <div className="relative h-48 overflow-hidden bg-gradient-to-br from-primary/10 to-accent/10">
                      {scenario.coverImageUrl ? (
                        <img
                          src={getAssetUrl(scenario.coverImageUrl)}
                          alt={scenario.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center cyber-grid">
                          <Play className="h-16 w-16 text-primary/30" />
                        </div>
                      )}
                      <div className="absolute top-3 right-3 flex flex-col gap-2">
                        <Badge className={
                          scenario.difficulty === "Easy"
                            ? "bg-green-500/20 text-green-400 border-green-500/50"
                            : scenario.difficulty === "Intermediate"
                            ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
                            : scenario.difficulty === "Hard"
                            ? "bg-orange-500/20 text-orange-400 border-orange-500/50"
                            : "bg-red-500/20 text-red-400 border-red-500/50"
                        }>
                          {scenario.difficulty}
                        </Badge>
                        {eventProgress[scenario.id]?.completed && (
                          <Badge className="gap-1 bg-green-500/20 text-green-400 border-green-500/50">
                            <Trophy className="h-3 w-3" />
                            +{eventProgress[scenario.id].points}
                          </Badge>
                        )}
                      </div>
                      {/* Event Challenge Badge */}
                      <div className="absolute top-3 left-3">
                        <Badge className="gap-1 bg-purple-500/20 text-purple-400 border-purple-500/50">
                          <Trophy className="h-3 w-3" />
                          Event
                        </Badge>
                      </div>
                    </div>

                    {/* Content */}
                    <CardContent className="p-4 flex-1 flex flex-col">
                      <div className="space-y-3 flex-1">
                        {/* Title & Author */}
                        <div>
                          <h3
                            className="font-bold text-lg line-clamp-1 group-hover:text-primary transition-colors cursor-pointer"
                            onClick={() => handleViewScenario(scenario.id)}
                          >
                            {scenario.title}
                          </h3>
                          <p className="text-sm text-muted-foreground">by {scenario.author}</p>
                        </div>

                        {/* Description */}
                        <p className="text-sm text-muted-foreground line-clamp-2">{scenario.shortDesc}</p>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1">
                          {scenario.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {scenario.tags.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{scenario.tags.length - 2}
                            </Badge>
                          )}
                        </div>

                        {/* Meta Info */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{scenario.durationMinutes}m</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Trophy className="h-3 w-3" />
                            <span>{scenario.questions.reduce((acc, q) => acc + q.points, 0)} pts</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-4">
                        <Button
                          className="flex-1 gap-2"
                          variant="outline"
                          onClick={() => handleStartScenario(scenario.id, false)}
                        >
                          <Play className="h-4 w-4" />
                          Practice
                        </Button>
                        {(isRegistered || currentUser?.roleAdmin) ? (
                          <Button
                            className="flex-1 gap-2"
                            onClick={() => handleStartScenario(scenario.id, true)}
                            disabled={!isActive || eventProgress[scenario.id]?.completed}
                            variant={eventProgress[scenario.id]?.completed ? "secondary" : "default"}
                          >
                            {eventProgress[scenario.id]?.completed ? (
                              <>
                                <Trophy className="h-4 w-4" />
                                Completed
                              </>
                            ) : activeSession && (activeSession.scenarioVersionId === scenario.id || activeSession.scenarioId === scenario.id) ? (
                              <>
                                <Gamepad2 className="h-4 w-4" />
                                Continue
                              </>
                            ) : isActive ? (
                              <>
                                <Gamepad2 className="h-4 w-4" />
                                Compete
                              </>
                            ) : isUpcoming ? (
                              <>
                                <Clock className="h-4 w-4" />
                                Upcoming
                              </>
                            ) : (
                              <>
                                <Clock className="h-4 w-4" />
                                Ended
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button className="flex-1" disabled>
                            <Gamepad2 className="h-4 w-4 mr-2" />
                            Register
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    No challenges available for this event
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-4">
          {event && <EventLeaderboard eventId={id!} format={event.format} />}
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Event Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Description</h3>
                <p className="text-muted-foreground">{event.description}</p>
              </div>
              <div>
                <h3 className="font-medium mb-2">Rules & Guidelines</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Complete challenges to earn points</li>
                  <li>Each challenge has a time limit</li>
                  <li>Points are awarded based on difficulty and completion time</li>
                  <li>The top performers will be featured on the leaderboard</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium mb-2">Prizes</h3>
                <p className="text-muted-foreground">
                  Top 3 participants will receive special badges and recognition!
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="participants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Participants ({participants.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {participants.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No participants yet. Be the first to register!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {participants.map((participant: any, index: number) => (
                    <div
                      key={participant.id || index}
                      className="rounded-lg bg-card/50 border overflow-hidden"
                    >
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                            <span className="font-bold">{index + 1}</span>
                          </div>
                          <div>
                            <p className="font-medium">
                              {participant.participantType === 'team' 
                                ? participant.participantName || `Team ${participant.participantId?.slice(0, 8)}`
                                : participant.participantName || `Player ${participant.participantId?.slice(0, 8)}`
                              }
                              {participant.participantType === 'team' && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  Team
                                </Badge>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Registered {new Date(participant.registeredAt).toLocaleDateString()}
                              {participant.teamMembers && (
                                <span> • {participant.teamMembers.length} members</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">{participant.totalPoints || 0} pts</p>
                          <p className="text-xs text-muted-foreground">{participant.challengesCompleted || 0} challenges</p>
                        </div>
                      </div>
                      
                      {/* Show completed challenges for teams */}
                      {participant.participantType === 'team' && participant.completedChallenges?.length > 0 && (
                        <div className="border-t bg-muted/20 p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Completed Challenges:</p>
                          <div className="space-y-1">
                            {participant.completedChallenges.map((challenge: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <Trophy className="h-3 w-3 text-primary" />
                                  <span>{challenge.scenarioTitle}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {challenge.completedBy && (
                                    <span>by {challenge.completedBy.displayName}</span>
                                  )}
                                  <span className="font-medium text-primary">{challenge.score} pts</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Team Registration Modal */}
      {event && (
        <TeamRegistrationModal
          eventId={id!}
          eventName={event.name}
          isOpen={showTeamModal}
          onClose={() => setShowTeamModal(false)}
          onSuccess={() => {
            loadEvent();
            loadRegistrationStatus();
            loadParticipants();
            setShowTeamModal(false);
          }}
        />
      )}
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { ScrollArea } from "../components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { toast } from "sonner";
import { solverApi } from "../api/solverApi";
import { creatorApi } from "../api/creatorApi";

export function CreateEventPage() {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("15:00");
  const [challenges, setChallenges] = useState<{ id: string; title: string; difficulty?: string; category?: string }[]>([]);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    format: "Player vs Player",
    maxParticipants: "100",
    durationMinutes: "180",
    scenarios: [] as string[],
    tags: "",
    registrationRequired: true,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const scenarios = await solverApi.listScenarios();
        const opts = (scenarios || []).map((s: any) => ({
          id: s.id,
          title: s.title || s.slug,
          difficulty: s.difficulty,
          category: s.category,
        }));
        setChallenges(opts);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load challenges");
      }
    };
    load();
  }, []);

  const toggleChallenge = (challengeId: string) => {
    setFormData({
      ...formData,
      scenarios: formData.scenarios.includes(challengeId)
        ? formData.scenarios.filter((id) => id !== challengeId)
        : [...formData.scenarios, challengeId],
    });
  };

  const handleCreate = async () => {
    if (!formData.name) {
      toast.error("Please enter an event name");
      return;
    }

    if (!startDate) {
      toast.error("Please select a start date");
      return;
    }

    if (formData.scenarios.length === 0) {
      toast.error("Please select at least one challenge");
      return;
    }

    const maxParticipantsNum = Number(formData.maxParticipants || 0);
    if (Number.isNaN(maxParticipantsNum) || maxParticipantsNum <= 0) {
      toast.error("Max participants must be a positive number");
      return;
    }

    const durationNum = Number(formData.durationMinutes || 0);
    if (Number.isNaN(durationNum) || durationNum < 15 || durationNum > 1440) {
      toast.error("Duration must be between 15 and 1440 minutes");
      return;
    }

    if (endDate && startDate && endDate < startDate) {
      toast.error("End date must be after start date");
      return;
    }

    // Combine date and time
    const startDateTime = startDate ? new Date(startDate) : null;
    if (startDateTime && startTime) {
      const [hours, minutes] = startTime.split(':');
      startDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    }

    const endDateTime = endDate ? new Date(endDate) : null;
    if (endDateTime && endTime) {
      const [hours, minutes] = endTime.split(':');
      endDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    }

    if (endDateTime && startDateTime && endDateTime <= startDateTime) {
      toast.error("End date/time must be after start date/time");
      return;
    }

    try {
      setIsCreating(true);
      await creatorApi.createEvent({
        name: formData.name,
        description: formData.description,
        startDate: startDateTime?.toISOString(),
        endDate: endDateTime?.toISOString(),
        timezone: "UTC",
        maxParticipants: maxParticipantsNum,
        format: formData.format,
        registrationRequired: formData.registrationRequired,
        scenarios: formData.scenarios.map((id, idx) => ({ scenarioVersionId: id, sortOrder: idx })),
      });
      toast.success("Event created successfully!");
      navigate("/events", { state: { refetch: true } });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Failed to create event");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/events")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Events
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
          <CalendarIcon className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl">Create Event</h1>
          <p className="text-muted-foreground">
            Create a competitive event for the community
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="cyber-border">
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
            <CardDescription>Basic information about your event</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Event Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Summer CTF Championship 2025"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your event, rules, and prizes"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="format">Event Format</Label>
                <Select
                  value={formData.format}
                  onValueChange={(value) => setFormData({ ...formData, format: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Player vs Player">Player vs Player</SelectItem>
                    <SelectItem value="Team vs Team">Team vs Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="maxParticipants">Max Participants</Label>
                  {formData.format === "Team vs Team" && (
                    <span className="text-xs text-muted-foreground italic">
                      (1 team = 1 participant)
                    </span>
                  )}
                </div>
                <Input
                  id="maxParticipants"
                  type="number"
                  value={formData.maxParticipants}
                  onChange={(e) => setFormData({ ...formData, maxParticipants: e.target.value })}
                  placeholder="100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date & Time</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex-1 justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? startDate.toLocaleDateString() : <span>Date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="time"
                    className="w-32"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>End Date & Time</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex-1 justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? endDate.toLocaleDateString() : <span>Date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="time"
                    className="w-32"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button onClick={handleCreate} disabled={isCreating || !formData.name || !startDate}>
                {isCreating ? "Creating..." : "Create Event"}
              </Button>
              <Button variant="outline" onClick={() => navigate("/events")}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Available Challenges Section */}
        <Card className="cyber-border">
          <CardHeader>
            <CardTitle>Available Challenges</CardTitle>
            <CardDescription>
              Select challenges for this event ({formData.scenarios.length} selected)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {challenges.length === 0 && (
                  <p className="text-sm text-muted-foreground">No challenges available</p>
                )}
                {challenges.map((challenge) => (
                  <div
                    key={challenge.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/10 cursor-pointer"
                    onClick={() => toggleChallenge(challenge.id)}
                  >
                    <Checkbox
                      checked={formData.scenarios.includes(challenge.id)}
                      onCheckedChange={() => toggleChallenge(challenge.id)}
                    />
                    <div className="flex-1">
                      <h4 className="font-medium">{challenge.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        {challenge.difficulty && (
                          <Badge variant="outline" className="text-xs">
                            {challenge.difficulty}
                          </Badge>
                        )}
                        {challenge.category && (
                          <Badge variant="outline" className="text-xs">
                            {challenge.category}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

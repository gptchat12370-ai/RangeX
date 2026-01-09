import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Calendar, Users, Clock, Trophy, Plus, Trash2, Search } from "lucide-react";
import { EventSettings } from "../types";
import { eventsApi } from "../api/eventsApi";
import { getAssetUrl } from "../utils/assetUrl";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { formatDate } from "../lib/utils";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { toast } from "sonner";
import { SafeImage } from "../lib/imageUtils";
import { useStore } from "../lib/store";

export function EventsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useStore((state) => state.currentUser);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventSettings[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formatFilter, setFormatFilter] = useState<string>("all");

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if ((location.state as any)?.refetch) {
      loadEvents();
      // Clear the refetch flag
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, location.pathname, navigate]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await eventsApi.listEvents();
      setEvents(data || []);
    } catch (err) {
      toast.error("Failed to load events");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await eventsApi.deleteEvent(deleteId);
      await loadEvents();
      toast.success("Event deleted");
    } catch {
      toast.error("Failed to delete event");
    } finally {
      setDeleteId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Live":
        return "bg-green-500/20 text-green-400";
      case "Scheduled":
        return "bg-blue-500/20 text-blue-400";
      case "Ended":
        return "bg-gray-500/20 text-gray-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  const getEventStatus = (event: EventSettings) => {
    const now = new Date();
    const start = event.startDate ? new Date(event.startDate) : null;
    const end = event.endDate ? new Date(event.endDate) : null;
    
    if (end && now > end) return "Ended";
    if (start && now >= start && (!end || now <= end)) return "Live";
    if (start && now < start) return "Scheduled";
    return "Unknown";
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         event.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const eventStatus = getEventStatus(event);
    const matchesStatus = statusFilter === "all" || eventStatus.toLowerCase() === statusFilter.toLowerCase();
    const matchesFormat = formatFilter === "all" || event.format === formatFilter;
    
    return matchesSearch && matchesStatus && matchesFormat;
  });

  // Group events by status: Live, Scheduled, Ended
  const liveEvents = filteredEvents.filter(e => getEventStatus(e) === "Live");
  const scheduledEvents = filteredEvents.filter(e => getEventStatus(e) === "Scheduled");
  const endedEvents = filteredEvents.filter(e => getEventStatus(e) === "Ended");

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-muted-foreground">
            Join competitive events and challenge other security professionals
          </p>
        </div>
        <Button onClick={() => navigate("/events/new")} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Event
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="scheduled">Upcoming</SelectItem>
            <SelectItem value="ended">Ended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={formatFilter} onValueChange={setFormatFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Formats</SelectItem>
            <SelectItem value="Player vs Player">Player vs Player</SelectItem>
            <SelectItem value="Team vs Team">Team vs Team</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card className="p-8 text-center">
          <CardTitle className="text-xl mb-2">No events yet</CardTitle>
          <p className="text-muted-foreground mb-4">Create your first event to engage the community.</p>
          <Button onClick={() => navigate("/events/new")} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Event
          </Button>
        </Card>
      ) : filteredEvents.length === 0 ? (
        <Card className="p-8 text-center">
          <CardTitle className="text-xl mb-2">No events found</CardTitle>
          <p className="text-muted-foreground">Try adjusting your search or filters.</p>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Live Events */}
          {liveEvents.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <h2 className="text-2xl font-bold text-green-400">Live Now</h2>
                <Badge className="bg-green-500/20 text-green-400">{liveEvents.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {liveEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          )}

          {/* Scheduled Events */}
          {scheduledEvents.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-400" />
                <h2 className="text-2xl font-bold text-blue-400">Upcoming</h2>
                <Badge className="bg-blue-500/20 text-blue-400">{scheduledEvents.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {scheduledEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          )}

          {/* Ended Events */}
          {endedEvents.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-gray-400" />
                <h2 className="text-2xl font-bold text-gray-400">Completed</h2>
                <Badge className="bg-gray-500/20 text-gray-400">{endedEvents.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {endedEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete this event? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // Event card component for reuse
  function EventCard({ event }: { event: EventSettings }) {
    return (
      <Card 
        className="cyber-border hover:border-primary/50 transition-colors cursor-pointer overflow-hidden"
        onClick={() => navigate(`/events/${event.id}`)}
      >
        <SafeImage
          src={event.coverImageUrl}
          alt={event.name}
          className="w-full h-48 object-cover"
          fallbackType="event"
          fallbackClassName="h-48"
        />
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg">{event.name}</CardTitle>
            <div className="flex flex-col gap-1">
              <Badge className={getStatusColor(getEventStatus(event))}>
                {getEventStatus(event)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {event.format}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-1">
            {(event.tags || []).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(event.startAt)}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{event.durationMinutes} minutes</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>
                {event.participants.length}/{event.maxParticipants} participants
              </span>
            </div>
          </div>

          {event.isCommunityEvent && (
            <Badge variant="outline" className="text-primary">
              <Trophy className="h-3 w-3 mr-1" />
              Community Event
            </Badge>
          )}
        </CardContent>
        <CardFooter>
          {getEventStatus(event) === "Scheduled" && (
            <div className="flex w-full gap-2">
              <Button 
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/events/${event.id}`);
                }}
              >
                Register
              </Button>
              {currentUser?.roleAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                  onClick={(e) => { e.stopPropagation(); setDeleteId(event.id); }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          {getEventStatus(event) === "Live" && (
            <Button 
              className="w-full bg-green-500 hover:bg-green-600"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/events/${event.id}`);
              }}
            >
              Join Now
            </Button>
          )}
          {getEventStatus(event) === "Ended" && (
            <Button 
              variant="outline"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/events/${event.id}`);
              }}
            >
              View Results
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  }
}

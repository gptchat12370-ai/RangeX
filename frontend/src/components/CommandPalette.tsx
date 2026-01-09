import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Target, Calendar, Users, Trophy, Compass } from "lucide-react";
import { useStore } from "../lib/store";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
// Data now comes from backend elsewhere; keep palette empty until wired
const mockScenarios: any[] = [];
const mockPlaylists: any[] = [];
const mockEvents: any[] = [];
const mockTeams: any[] = [];

export function CommandPalette() {
  const navigate = useNavigate();
  const { commandPaletteOpen, setCommandPaletteOpen } = useStore();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredScenarios = mockScenarios
    .filter((s) => s.title.toLowerCase().includes(searchTerm.toLowerCase()))
    .slice(0, 5);

  const filteredPlaylists = mockPlaylists
    .filter((p) => p.title.toLowerCase().includes(searchTerm.toLowerCase()))
    .slice(0, 3);

  const filteredEvents = mockEvents
    .filter((e) => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .slice(0, 3);

  const filteredTeams = mockTeams
    .filter((t) => t.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .slice(0, 3);

  return (
    <CommandDialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <CommandInput
        placeholder="Search challenges, playlists, events..."
        value={searchTerm}
        onValueChange={setSearchTerm}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {filteredScenarios.length > 0 && (
          <CommandGroup heading="Challenges">
            {filteredScenarios.map((scenario) => (
              <CommandItem 
                key={scenario.id} 
                className="gap-2"
                onSelect={() => {
                  navigate(`/challenges/${scenario.id}`);
                  setCommandPaletteOpen(false);
                }}
              >
                <Target className="h-4 w-4 text-primary" />
                <div className="flex-1">
                  <div className="font-medium">{scenario.title}</div>
                  <div className="text-xs text-muted-foreground">{scenario.shortDesc}</div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredPlaylists.length > 0 && (
          <CommandGroup heading="Playlists">
            {filteredPlaylists.map((playlist) => (
              <CommandItem 
                key={playlist.id} 
                className="gap-2"
                onSelect={() => {
                  navigate(`/playlists/${playlist.id}`);
                  setCommandPaletteOpen(false);
                }}
              >
                <Compass className="h-4 w-4 text-accent" />
                <div className="flex-1">
                  <div className="font-medium">{playlist.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {playlist.scenarios.length} challenges
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredEvents.length > 0 && (
          <CommandGroup heading="Events">
            {filteredEvents.map((event) => (
              <CommandItem 
                key={event.id} 
                className="gap-2"
                onSelect={() => {
                  navigate(`/events/${event.id}`);
                  setCommandPaletteOpen(false);
                }}
              >
                <Calendar className="h-4 w-4 text-purple-400" />
                <div className="flex-1">
                  <div className="font-medium">{event.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {event.participants.length}/{event.maxParticipants} participants
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredTeams.length > 0 && (
          <CommandGroup heading="Teams">
            {filteredTeams.map((team) => (
              <CommandItem 
                key={team.id} 
                className="gap-2"
                onSelect={() => {
                  navigate(`/teams/${team.id}`);
                  setCommandPaletteOpen(false);
                }}
              >
                <Users className="h-4 w-4 text-green-400" />
                <div className="flex-1">
                  <div className="font-medium">{team.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {team.members.length} members
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

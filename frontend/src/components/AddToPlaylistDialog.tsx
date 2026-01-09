import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ListPlus, Library, Check } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { Switch } from "./ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { toast } from "sonner";
import { creatorApi } from "../api/creatorApi";
import { useStore } from "../lib/store";

interface AddToPlaylistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challengeId: string;
  challengeTitle: string;
}

export function AddToPlaylistDialog({
  open,
  onOpenChange,
  challengeId,
  challengeTitle,
}: AddToPlaylistDialogProps) {
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<string[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlaylist, setNewPlaylist] = useState({
    title: "",
    description: "",
    isPublic: false,
  });

  useEffect(() => {
    if (open) {
      loadPlaylists();
    }
  }, [open]);

  const loadPlaylists = async () => {
    setLoading(true);
    try {
      const data = await creatorApi.listPlaylists();
      // Filter to user's playlists only and exclude Favorites
      const userPlaylists = (data || []).filter(
        (p: any) => 
          p.ownerUserId === currentUser?.id && 
          p.title?.toLowerCase() !== 'favorites'
      );
      setPlaylists(userPlaylists);
    } catch (error) {
      console.error('Failed to load playlists:', error);
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  };

  const togglePlaylist = (playlistId: string) => {
    setSelectedPlaylistIds((prev) =>
      prev.includes(playlistId)
        ? prev.filter((id) => id !== playlistId)
        : [...prev, playlistId]
    );
  };

  const handleAddToExisting = async () => {
    if (selectedPlaylistIds.length === 0) {
      toast.error("Please select at least one playlist");
      return;
    }
    
    console.log('[AddToPlaylist] Adding to playlists:', selectedPlaylistIds);
    console.log('[AddToPlaylist] Challenge ID:', challengeId);
    
    try {
      // Add challenge to each selected playlist
      for (const playlistId of selectedPlaylistIds) {
        const playlist = playlists.find(p => p.id === playlistId);
        if (!playlist) {
          console.warn('[AddToPlaylist] Playlist not found:', playlistId);
          continue;
        }
        
        console.log('[AddToPlaylist] Processing playlist:', playlist.title);
        console.log('[AddToPlaylist] Existing items:', playlist.items?.length || 0);
        
        // Get existing items and add new one
        const existingItems = playlist.items || [];
        const newItems = [
          ...existingItems.map((item: any, idx: number) => ({
            scenarioVersionId: item.scenarioVersionId,
            sortOrder: idx
          })),
          {
            scenarioVersionId: challengeId,
            sortOrder: existingItems.length
          }
        ];
        
        console.log('[AddToPlaylist] New items array:', newItems);
        
        // Use the replaceItems endpoint (POST :id/items) instead of update
        const result = await creatorApi.replacePlaylistItems(playlistId, newItems);
        console.log('[AddToPlaylist] Result:', result);
      }
      
      toast.success(
        `Added "${challengeTitle}" to ${selectedPlaylistIds.length} playlist${
          selectedPlaylistIds.length > 1 ? "s" : ""
        }`
      );
      onOpenChange(false);
      setSelectedPlaylistIds([]);
      await loadPlaylists(); // Reload to see updated counts
    } catch (error) {
      console.error('[AddToPlaylist] Failed to add to playlists:', error);
      toast.error('Failed to add to playlists');
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newPlaylist.title) {
      toast.error("Please enter a playlist title");
      return;
    }

    try {
      await creatorApi.createPlaylist({
        title: newPlaylist.title,
        description: newPlaylist.description,
        isPublic: newPlaylist.isPublic,
        items: [{ scenarioVersionId: challengeId, sortOrder: 0 }]
      });
      
      toast.success(`Created playlist "${newPlaylist.title}" and added challenge`);
      onOpenChange(false);
      setShowCreateForm(false);
      setNewPlaylist({ title: "", description: "", isPublic: false });
    } catch (error) {
      console.error('Failed to create playlist:', error);
      toast.error('Failed to create playlist');
    }
  };

  const handleCreatePlaylistPage = () => {
    onOpenChange(false);
    navigate("/playlists/new");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cyber-border max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="h-5 w-5" />
            Add to Playlist
          </DialogTitle>
          <DialogDescription>
            Add &quot;{challengeTitle}&quot; to your playlists
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="existing" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Add to Existing</TabsTrigger>
            <TabsTrigger value="new">Create New</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="space-y-4 mt-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                <p className="mt-4 text-sm text-muted-foreground">Loading playlists...</p>
              </div>
            ) : playlists.length === 0 ? (
              <div className="text-center py-8 space-y-4">
                <Library className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground mb-4">
                    You don&apos;t have any playlists yet
                  </p>
                  <Button onClick={handleCreatePlaylistPage} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Your First Playlist
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-2">
                    {playlists.map((playlist) => (
                      <div
                        key={playlist.id}
                        onClick={() => togglePlaylist(playlist.id)}
                        className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted transition-colors ${
                          selectedPlaylistIds.includes(playlist.id)
                            ? "bg-muted border-primary"
                            : ""
                        }`}
                      >
                        <div
                          className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                            selectedPlaylistIds.includes(playlist.id)
                              ? "border-primary bg-primary"
                              : "border-muted-foreground"
                          }`}
                        >
                          {selectedPlaylistIds.includes(playlist.id) && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{playlist.title}</span>
                            <Badge variant={playlist.isPublic ? "default" : "secondary"}>
                              {playlist.isPublic ? "Public" : "Private"}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {playlist.items?.length || 0} challenges
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <DialogFooter>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddToExisting}
                    disabled={selectedPlaylistIds.length === 0}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add to {selectedPlaylistIds.length > 0 ? selectedPlaylistIds.length : ""}{" "}
                    Playlist{selectedPlaylistIds.length !== 1 ? "s" : ""}
                  </Button>
                </DialogFooter>
              </>
            )}
          </TabsContent>

          <TabsContent value="new" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-playlist-title">Playlist Title</Label>
                <Input
                  id="new-playlist-title"
                  value={newPlaylist.title}
                  onChange={(e) => setNewPlaylist({ ...newPlaylist, title: e.target.value })}
                  placeholder="e.g., Web Security Fundamentals"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-playlist-description">Description (Optional)</Label>
                <Textarea
                  id="new-playlist-description"
                  value={newPlaylist.description}
                  onChange={(e) =>
                    setNewPlaylist({ ...newPlaylist, description: e.target.value })
                  }
                  placeholder="Describe your playlist"
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="new-playlist-public">Public Playlist</Label>
                  <p className="text-xs text-muted-foreground">
                    Allow others to view and use this playlist
                  </p>
                </div>
                <Switch
                  id="new-playlist-public"
                  checked={newPlaylist.isPublic}
                  onCheckedChange={(checked) =>
                    setNewPlaylist({ ...newPlaylist, isPublic: checked })
                  }
                />
              </div>

              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm">
                  This playlist will be created with &quot;{challengeTitle}&quot; as the first
                  challenge.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAndAdd} disabled={!newPlaylist.title} className="gap-2">
                <Plus className="h-4 w-4" />
                Create & Add
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
